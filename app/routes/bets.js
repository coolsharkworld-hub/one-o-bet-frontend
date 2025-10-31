const express = require("express");
const useragent = require('express-useragent');
const { validationResult } = require("express-validator");
let config = require("config");
const Bets = require("../models/bets");
const User = require("../models/user");
const SubMarketType = require("../models/subMarketTypes");
const loginRouter = express.Router();
const betValidator = require("../validators/bets");
const userBetSizes = require("../models/userBetSizes");
const betRates = require("../models/betRate");
const Odds = require("../models/odds");
const AsianTable = require("../models/asianTable");
const Events = require("../models/events");
const RaceOdds = require("../models/raceOdds");
const axios = require("axios");
const currentPosition = require("../models/CurrentPosition");
const FancyOdds = require("../models/fancyOdds");
const Session = require("../models/Session");
const Cash = require("../../app/models/deposits");
const BetPlaceHold = require("../models/betaPlaceHold");
const Exposure = require("../models/ExpRec")
const AsianMarketOdd = require("../models/asianOdds")
const { v4: uuidv4 } = require('uuid');
const { MongoClient } = require('mongodb');
const Crickets = require('../models/Crickets')
const CasinoCalls = require('../models/casinoCalls')
const { LIVE_BET_TV_URL } = require("../global/constants");
const message_result = "cannot place bet due to result check";
const MarketIDS = require("../models/marketIds")
const { fetchSession } = require("../../helper/api/sessionAPIHelper");
const { fetchBookmakerOdds } = require("../../helper/api/sessionAPIHelper");
const moment = require("moment");
const { SCORE_API_STATUS_BLOCK_LIST } = require("../../helper/api/scoreApiHelper");
const { GetAllBets, CasinoList } = require("./admin/bets");
const { getDiffBackAndLay, getRaceDiffBackAndLay } = require("../../helper/bet");
require('dotenv').config()

global.activeBettors = new Map()
activeBettors.set(6508127, { status: true })

const handleLimitValue = async (selectedRate, marketId) => {
  if (selectedRate?.toString()?.split(".")?.length == 1 && selectedRate >= 30)
    return 6;
  else if (
    selectedRate?.toString()?.split(".")?.length == 1 &&
    selectedRate >= 20
  )
    return 3;
  else if (selectedRate >= 10) return 1.5;
  else if (selectedRate >= 6) return 0.6;
  else if (selectedRate >= 4) return 0.3;
  else if (selectedRate >= 3) return 0.15;
  else if (selectedRate >= 2) return 0.06;
  else if (selectedRate >= 1) return 0.03;
};

const getParents = async (userId) => {
  const parentUserIds = [];
  let currentUserId = userId;

  while (currentUserId) {
    const parentUser = await User.findOne({ userId: currentUserId });

    if (
      !parentUser ||
      !parentUser.createdBy ||
      parentUser.createdBy == currentUserId
    ) {
      break;
    }
    parentUserIds.push(parentUser.createdBy);
    currentUserId = parentUser.createdBy;
  }
  return parentUserIds;
};

const updateParentUserBalance = async (parentUsersIds, winningAmount, matchId = 0, Id = 0, selectionId = 0, marketId = "0", subMarketId = "0") => {
  const parentUser = await User.find({
    userId: {
      $in: [...parentUsersIds],
    },
    isDeleted: false,
  }).sort({ userId: -1 });
  let prev = 0;

  for (const user of parentUser) {
    let current = user.downLineShare;
    let commission = current - prev;
    user["commission"] = commission;
    prev = current;
  }

  for (const user of parentUser) {
    const amountToBeSub = (user.commission / 100) * winningAmount;
    const finalAmount = Number(amountToBeSub.toFixed(3));
    user.exposure -= finalAmount;
    user.availableBalance -= finalAmount;
    await user.save();
    if (matchId != 0) {
      let position = await new currentPosition({
        userId: user.userId,
        description: "Match Current Position",
        amount: -finalAmount,
        betId: Id,
        matchsId: matchId,
        marketId: marketId,
        subMarketId: subMarketId,
        share: user.commission,
      });
      await position.save();
    }
  }
};

const activeBetPlacing = async (userId) => {
  await User.findOneAndUpdate(
    { userId: userId },
    { activeBetPlacing: false }
  );
}

const apiCallForOdds = async (marketId) => {
  const url = `${config.sportsAPIUrl}/listMarketBook`;
  const data = { marketIds: [marketId] }
  const header = {
    headers: {
      'accept': 'application/json',
      'Content-Type': 'application/json',
      'X-App': process.env.XAPP_NAME,
    },
  }
  const response = await axios.post(
    url,
    data,
    header
  );
  return response?.data?.result;
}

const stopbetStatusChecker = async (id) => {
  try {
    const scores = await Crickets.findOne({ eventId: id });
    //console.log(`Score details ====================== `, scores);
    if (scores && scores?.result && scores?.result?.length) {
      const result = scores?.result.toLowerCase();
      // const stopbetStatus = ["no ball", "noball", "free hit", "freehit",
      //   "thirdumpire", "third umpire", "review", "stumps", "bad", "crowed",
      //   "rain", "suspend", "delay", "pitch", "plood", "injured",
      //   "rain stops play", "bowling review", "stumped", "Run Out Check",
      //   "Bowling Review", "No Ball Check", "LBW Check", "Catch Check",];
      const stopBetStatus = SCORE_API_STATUS_BLOCK_LIST
      const regexPattern = new RegExp(stopBetStatus.map(word => `\\b${word.replace(/\s+/g, '\\s+')}\\b`).join('|'), 'i');
      if (regexPattern.test(result)) {
        return 400
      }
    }
    return 200;
  } catch (error) {
    console.warn(`Error: ${error}`);
    return 200;
  }
}

const checkMarketActiveForBets = async (marketId) => {
  const marketStatus = await MarketIDS({ marketId: marketId });
  if (marketStatus.status === "OPEN") {
    return 200
  } else {
    return 400
  }
}

const placeBet = async (req, res) => {
  const errors = validationResult(req);
  let statusForRes = {
    betPlaceTime: moment().format('YYYY/MM/DD HH:mm:ss')
  }
  if (errors.errors.length != 0) {
    return res.status(400).send({ errors: errors.errors });
  }
  try {
    if (req.decoded.login.role != "5") {
      return res.status(401).send({ message: "You are not allowed to bet" });
    }
    /* =============================  Base Settings   ============================== */
    let runnerName;
    let currentSession;
    let subMarketDetail;
    let marketId;
    let {
      selectionId,
      betAmount,
      betRate,
      matchId,
      subMarketName,
      type,
      oddsId,
      fancyRate,
      overunderMarketId,
      selectedAmount,
      asianOdd,
      roundId,
      asianMarketId
    } = req.body;
    let randomStr = uuidv4();

    // if (parseInt(betRate) > 50) {
    //   return res.status(404).send({
    //     message: `Winning amount can not be more than 50 times than loosing amount`,
    //   });
    // }

    const selectedBetRate = selectedAmount;
    const userId = req.decoded.userId;
    let ApiResponseOdds;
    let matchedIndex;
    let winningAmount = 0;
    let loosingAmount = 0;
    let isFancyOrBookMaker = false;
    let _3rdPartyMarketId = 0;
    let TargetScore = 0;
    let fancyData = null;
    let runnerForSaveInbets = null;
    let expoisureType = 1;
    const multipeResponse = [];
    const multipeResponseForSecurityCheck = [];
    const BetTime = new Date().getTime();
    let id = 0;
    let isManuel = true;
    let delay = 5200;
    let asianTableName = "";
    let delayAddition = 0
    /* ====================================================================== */

    /* ============================== Innitial Checks  ============================== */

    if (subMarketName.toUpperCase() == "ZA" || subMarketName.toUpperCase() == "RSA") {
      return res.status(404).send({ message: "Betting disabled" });
    }
    if (betAmount < config.betMinimumAmount) {
      return res
        .status(404)
        .send({ message: `minimum bet should be ${config.betMinimumAmount}` });
    }
    const user = await User.findOne({ userId }).exec();
    if (!user) {
      return res.status(404).send({ message: "illegal user betting" });
    }

    if (activeBettors.has(userId)) {
      return res.status(404).send({ message: "Please wait few seconds " });
    } else {
      activeBettors.set(userId, { status: true })
    }

    // if(user.activeBetPlacing){
    //   return res.status(404).send({ message: "Please wait few seconds " });
    // }else {
    //   user.activeBetPlacing = true;
    //   await user.save();
    // }

    if (user.bettingAllowed == false) {
      activeBettors.delete(userId)
      return res.status(404).send({ message: "Bet not allowed" });
    }
    let parentUserIds = await getParents(user.userId);

    const blockedUsersCount = await User.countDocuments({ userId: { $in: parentUserIds }, bettingAllowed: false })
    if (blockedUsersCount > 0) {
      activeBettors.delete(userId)
      return res.status(404).send({ message: "Beting disbaled" });
    }

    const marketIds = await User.distinct("blockedMarketPlaces", {
      userId: { $in: parentUserIds },
      isDeleted: false,
    });

    const subMarketId1 = await User.distinct("blockedSubMarkets", {
      userId: { $in: parentUserIds },
      isDeleted: false,
    });

    const subMarketId2 = await User.distinct("blockedSubMarketsByParent", {
      userId: { $in: parentUserIds },
      isDeleted: false,
    });
    const subMarketId = subMarketId1.concat(subMarketId2);
    let eventDetail;

    if (asianOdd) {
      marketId = "8";
    } else {
      eventDetail = await Events.findById(matchId);
      if (!eventDetail) {
        activeBettors.delete(userId)
        return res.status(404).send({ message: "EVENT COULD NOT FOUND" });
      }


      if (!eventDetail.betAllowed) {
        activeBettors.delete(userId)
        return res
          .status(404)
          .send({ message: "Batting Not Allowd on this Match1", data: eventDetail.betAllowed });
      }
      if (eventDetail.status.toUpperCase() != "OPEN") {
        activeBettors.delete(userId)
        return res
          .status(404)
          .send({ message: "Batting Not Allowd on this Match2", data: eventDetail.status.toUpperCase() });
      }
      if (eventDetail.matchStopStatus) {
        activeBettors.delete(userId)
        return res
          .status(404)
          .send({ message: "Batting Not Allowd on this Match3", data: eventDetail.matchStopStatus });
      }

      if (eventDetail.matchStopStatus) {
        activeBettors.delete(userId)
        return res
          .status(404)
          .send({ message: "Batting Not Allowd on this Match" });
      }

      marketId = eventDetail?.sportsId;
    }

    const Digitaddition = await handleLimitValue(betRate, marketId);

    /**
     * checks for Market Sub Market
     * Checks for OpenTime before Start Event
     */
    if (config.raceMarkets.includes(marketId)) {
      const DBOddDetails = await RaceOdds.findById(oddsId);
      if (!DBOddDetails) {
        console.warn(`Error : Odds not found !`)
        activeBettors.delete(userId)
        return res.status(404).send({
          message: `Bet Miss Matched `,
        });
      }
      const idDetails = await MarketIDS.findOne({ marketId: DBOddDetails.marketId, eventId: eventDetail.Id })
      if (!idDetails) {
        console.warn(`Error : Market details Not found !`)
        activeBettors.delete(userId)
        return res.status(404).send({
          message: `Bet Miss Matched `,
        });
      }
      const requiredTime = new Date().getTime() + config.raceOpenBefore;
      const remainingTimeFromEvent = idDetails.openDate - requiredTime;
      if (remainingTimeFromEvent > 0) {
        activeBettors.delete(userId)
        return res.status(404).send({
          status: true,
          message: `Bets will Allow in : ${Math.ceil(remainingTimeFromEvent / 60000)} min`,
        });
      }
      const now = new Date().getTime()
      const remainingTimeFromMarketStart = idDetails.openDate - now
      if (remainingTimeFromMarketStart < 0) {
        activeBettors.delete(userId)
        return res.status(404).send({ message: "Bet not allowed" });
      }
      id = idDetails.marketId;
      _3rdPartyMarketId = id;
      subMarketDetail = await SubMarketType.findOne({ countryCode: subMarketName, marketId: marketId }).exec();
      if (!subMarketDetail) {
        activeBettors.delete(userId)
        return res.status(404).send({ message: "Bet not allowed" });
      }
    } else if (asianOdd) {
      subMarketDetail = await SubMarketType.findOne({ name: subMarketName, marketId: marketId }).exec();
      if (!subMarketDetail) {
        activeBettors.delete(userId)
        return res.status(404).send({ message: "you cannot place bet" });
      }
    } else {
      let thirdPartyMarketName = subMarketName;
      subMarketDetail = await SubMarketType.findOne({ name: subMarketName, marketId: marketId }).exec();
      const requiredTime = new Date().getTime() + config.sportsOpenBefore;
      const remainingTimeFromEvent = eventDetail.openDate - requiredTime;

      if (subMarketName === "Toss") {
        const remainingTimeFromEventStart = eventDetail.openDate - new Date().getTime();
        thirdPartyMarketName = "To Win the Toss";
        const requiredTime = new Date().getTime() - config.tossCloseTime;
        if (subMarketDetail.Id == config.Toss && config.tossCloseTime >= remainingTimeFromEventStart) {
          activeBettors.delete(userId)
          return res.status(404).send({
            status: true,
            message: `Bets are not Allowed Now In this market`,
          });
        }
      }

      if (["Winner", "Cup Winner", "Cup"].includes(subMarketName)) {
        subMarketName = "Cup Winner";
      }

      const currentMarket = eventDetail?.marketIds?.find(
        (market) => market.marketName == thirdPartyMarketName
      );
      id = currentMarket?.id;
      _3rdPartyMarketId = id;
      subMarketDetail = await SubMarketType.findOne({
        name: subMarketName,
        marketId: marketId,
      }).exec();

      if (!subMarketDetail) {
        activeBettors.delete(userId)
        return res.status(404).send({ message: "you cannot place bet" });
      }
      if (subMarketDetail.Id != config.Toss && remainingTimeFromEvent > 0) {
        activeBettors.delete(userId)
        return res.status(404).send({
          status: true,
          message: `Bets will Allow in : ${Math.ceil(remainingTimeFromEvent / 60000)} min`,
        });
      }
    }

    // const resStatus = await checkMarketActiveForBets(id);
    // if(resStatus === 400){
    //   return res.status(404).send({message: "Betting disabled"});
    // }

    /**
     * Is market Blocked from any Flow
     */
    if (marketIds.includes(marketId) || subMarketId.includes(subMarketDetail.Id) || user.betLockStatus == true || user.blockedSubMarketsByParent.includes(subMarketDetail.Id)) {
      activeBettors.delete(userId)
      return res.status(404).send({ message: "Betting disabled" });
    }

    let maxExp = 0;
    /* ==================================================================== */

    /* ================================== Market Specific Checks ================================== */

    // Soccer Match Odds
    if (config.sportMarkets.includes(marketId) && config.soccerOdds == subMarketDetail.Id) {

      const userMaxBetSize = await userBetSizes.findOne({
        userId: userId,
        sportsId: marketId,
      });
      if (!userMaxBetSize) {
        activeBettors.delete(userId)
        return res.status(404).send({
          error: "User Max Bet Size Not Found",
          message: `something went wrong !`
        });
      }
      maxExp = userMaxBetSize.ExpAmount ? userMaxBetSize.ExpAmount : 0;
      if (userMaxBetSize && betAmount > userMaxBetSize.amount) {
        activeBettors.delete(userId)
        return res.status(404).send({ message: `max bet size is 1: ${userMaxBetSize.amount}` });
      }
      if (userMaxBetSize && betAmount < userMaxBetSize.minAmount) {
        activeBettors.delete(userId)
        return res.status(404).send({ message: `min bet size is : ${userMaxBetSize.minAmount}` });
      }

      const DBOddDetails = await Odds.findById(oddsId);
      if (!DBOddDetails) {
        activeBettors.delete(userId)
        return res.status(404).send({
          message: `Frontend provided odds _id do not found in db & _id =  ${oddsId}`,
        });
      }
      let runners = DBOddDetails?.runners;
      runnerForSaveInbets = runners.map((runner) => ({
        runner: runner.SelectionId,
        amount: 0,
      }));
      const OddDetailsTeam = DBOddDetails.runners.find(
        (runner) => runner.SelectionId == selectionId
      );
      const diff = getDiffBackAndLay(OddDetailsTeam)
      if (diff > 0.03) {
        delayAddition = 4
      }
      runnerName = OddDetailsTeam?.runnerName;

      if (selectedBetRate == betRate) {
        for (let i = 1; i < 5 + delayAddition; i++) {
          setTimeout(async () => {
            const oddsData = await apiCallForOdds(id);
            // const response = await axios.get(url);
            // const oddsData = response.data;
            const runnerFromAPI = oddsData[0]?.runners.find(
              (runner) => runner.selectionId == selectionId
            );
            let selectedOddsValue = 0;
            if (type == 0) {
              const ApiResponseOdds = runnerFromAPI?.ex?.availableToBack;
              if (ApiResponseOdds && ApiResponseOdds.length > 0) {
                selectedOddsValue = ApiResponseOdds[0].price;
              }
              if (selectedOddsValue != 0 && betRate <= selectedOddsValue) {
                multipeResponse.push(selectedOddsValue);
              }
              multipeResponseForSecurityCheck.push(selectedOddsValue);
            } else if (type == 1) {
              const ApiResponseOdds = runnerFromAPI.ex?.availableToLay;
              if (ApiResponseOdds && ApiResponseOdds.length > 0) {
                selectedOddsValue = ApiResponseOdds[0]?.price;
              }
              if (selectedOddsValue != 0 && betRate >= selectedOddsValue) {
                multipeResponse.push(selectedOddsValue);
              }
              multipeResponseForSecurityCheck.push(selectedOddsValue);
            }
          }, 1000 * i);
        }
      } else if (type == 1 && betRate > selectedBetRate && betRate - Digitaddition > selectedBetRate) {
        activeBettors.delete(userId)
        return res.status(404).send({
          message: `Bet Miss Matched `,
        });
      } else if (type == 0 && selectedBetRate < betRate && selectedBetRate - Digitaddition > betRate) {
        activeBettors.delete(userId)
        return res.status(404).send({
          message: `Bet Miss Matched `,
        });
      } else if (type == 1 && betRate < selectedBetRate) {
        activeBettors.delete(userId)
        return res.status(404).send({
          message: `Bet Miss Matched `,
        });
      } else if (type == 0 && betRate > selectedBetRate) {
        activeBettors.delete(userId)
        return res.status(404).send({
          message: `Bet Miss Matched `,
        });
      } else if (type == 1 && selectedBetRate != betRate) {
        for (let i = 0; i < 4 + delayAddition; i++) {
          setTimeout(async () => {
            // const url = `${config.sportsAPIUrl}/odds/?ids=${id}`;
            // const response = await axios.get(url);
            // const oddsData = response.data;
            const oddsData = await apiCallForOdds(id);
            const runnerFromAPI = oddsData[0]?.runners.find(
              (runner) => runner.selectionId == selectionId
            );
            ApiResponseOdds = runnerFromAPI?.ex?.availableToLay;
            let selectedOddsValue = ApiResponseOdds[0]?.price;
            if (selectedOddsValue <= betRate) {
              multipeResponse.push(selectedOddsValue);
            }
            multipeResponseForSecurityCheck.push(selectedOddsValue);
          }, 1000 * i);
        }
      } else if (type == 0 && selectedBetRate != betRate) {
        for (let i = 0; i < 4 + delayAddition; i++) {
          setTimeout(async () => {
            // const url = `${config.sportsAPIUrl}/odds/?ids=${id}`;
            // const response = await axios.get(url);
            // const oddsData = response.data;
            const oddsData = await apiCallForOdds(id);
            const runnerFromAPI = oddsData[0]?.runners.find(
              (runner) => runner.selectionId == selectionId
            );
            ApiResponseOdds = runnerFromAPI?.ex?.availableToBack;
            let selectedOddsValue = ApiResponseOdds[0]?.price;
            if (selectedOddsValue >= betRate) {
              multipeResponse.push(selectedOddsValue);
            }
            multipeResponseForSecurityCheck.push(selectedOddsValue);
          }, 1000 * i);
        }
      }
    }

    // Tennis Match Odds
    else if (config.sportMarkets.includes(marketId) && config.tennisOdds == subMarketDetail.Id) {

      const userMaxBetSize = await userBetSizes.findOne({
        userId: userId,
        sportsId: marketId,
      });

      if (!userMaxBetSize) {
        activeBettors.delete(userId)
        return res.status(404).send({
          error: "User Max Bet Size Not Found",
          message: `something went wrong !`
        });
      }
      maxExp = userMaxBetSize.ExpAmount ? userMaxBetSize.ExpAmount : 0;
      if (userMaxBetSize && betAmount > userMaxBetSize.amount) {
        activeBettors.delete(userId)
        return res.status(404).send({ message: `max bet size is 2: ${userMaxBetSize.amount}` });
      }

      if (userMaxBetSize && betAmount < userMaxBetSize.minAmount) {
        activeBettors.delete(userId)
        return res.status(404).send({ message: `min bet size is : ${userMaxBetSize.minAmount}` });
      }

      const DBOddDetails = await Odds.findById(oddsId);
      if (!DBOddDetails) {
        activeBettors.delete(userId)
        return res.status(404).send({
          message: `Frontend provided odds _id do not found in db & _id =  ${oddsId}`,
        });
      }
      let runners = DBOddDetails?.runners;
      runnerForSaveInbets = runners.map((runner) => ({
        runner: runner.SelectionId,
        amount: 0,
      }));
      const OddDetailsTeam = DBOddDetails.runners.find(
        (runner) => runner.SelectionId == selectionId
      );

      const diff = getDiffBackAndLay(OddDetailsTeam)
      if (diff > 0.03) {
        delayAddition = 4
      }

      runnerName = OddDetailsTeam?.runnerName;

      if (selectedBetRate == betRate) {
        for (let i = 1; i < 5 + delayAddition; i++) {
          setTimeout(async () => {
            // const url = `${config.sportsAPIUrl}/odds/?ids=${id}`;
            // const response = await axios.get(url);
            // const oddsData = response.data;
            const oddsData = await apiCallForOdds(id);
            const runnerFromAPI = oddsData[0]?.runners.find(
              (runner) => runner.selectionId == selectionId
            );
            let selectedOddsValue = 0;
            if (type == 0) {
              const ApiResponseOdds =
                runnerFromAPI?.ex?.availableToBack;
              if (ApiResponseOdds && ApiResponseOdds.length > 0) {
                selectedOddsValue = ApiResponseOdds[0].price;
              }
              if (selectedOddsValue != 0 && betRate <= selectedOddsValue) {
                multipeResponse.push(selectedOddsValue);
              }
              multipeResponseForSecurityCheck.push(selectedOddsValue);
            } else if (type == 1) {
              const ApiResponseOdds =
                runnerFromAPI.ex?.availableToLay;
              if (ApiResponseOdds && ApiResponseOdds.length > 0) {
                selectedOddsValue = ApiResponseOdds[0]?.price;
              }
              if (selectedOddsValue != 0 && betRate >= selectedOddsValue) {
                multipeResponse.push(selectedOddsValue);
              }
              multipeResponseForSecurityCheck.push(selectedOddsValue);
            }
          }, 1000 * i);
        }
      } else if (type == 1 && betRate > selectedBetRate && betRate - Digitaddition > selectedBetRate) {
        activeBettors.delete(userId)
        return res.status(404).send({
          message: `Bet Miss Matched `,
        });
      } else if (type == 0 && selectedBetRate < betRate && selectedBetRate - Digitaddition > betRate) {
        activeBettors.delete(userId)
        return res.status(404).send({
          message: `Bet Miss Matched `,
        });
      } else if (type == 1 && betRate < selectedBetRate) {
        activeBettors.delete(userId)
        return res.status(404).send({
          message: `Bet Miss Matched `,
        });
      } else if (type == 0 && betRate > selectedBetRate) {
        activeBettors.delete(userId)
        return res.status(404).send({
          message: `Bet Miss Matched `,
        });
      } else if (type == 1 && selectedBetRate != betRate) {
        for (let i = 0; i < 4 + delayAddition; i++) {
          setTimeout(async () => {
            // const url = `${config.sportsAPIUrl}/odds/?ids=${id}`;
            // const response = await axios.get(url);
            // const oddsData = response.data;
            const oddsData = await apiCallForOdds(id);
            const runnerFromAPI = oddsData[0]?.runners.find(
              (runner) => runner.selectionId == selectionId
            );
            ApiResponseOdds = runnerFromAPI?.ex?.availableToLay;
            /**
             *
             * selectedRate 30
             * Bet Rate 29
             *
             */

            let selectedOddsValue = ApiResponseOdds[0]?.price;
            if (selectedOddsValue <= betRate) {
              multipeResponse.push(selectedOddsValue);
            }
            multipeResponseForSecurityCheck.push(selectedOddsValue);
          }, 1000 * i);
        }

        // LAY:
        // BetRate: 33
        // SelectedRate: 30

        // {

        // 4second API=>
        // 1st second=> 35 => save into array
        // 2nd       => 34 => save into array or donot save
        // 3rd       => 75 => save and move next
        // 4th       => 36 => save or do not save

        // }
        // if array has some values which are lesser than SeleectedRate then take the latest/top most index value.
        // ELSE
        // mistmatch.....
      } else if (type == 0 && selectedBetRate != betRate) {
        for (let i = 0; i < 4 + delayAddition; i++) {
          setTimeout(async () => {
            // const url = `${config.sportsAPIUrl}/odds/?ids=${id}`;
            // const response = await axios.get(url);
            // const oddsData = response.data;
            const oddsData = await apiCallForOdds(id);
            const runnerFromAPI = oddsData[0]?.Runners.find(
              (runner) => runner.selectionId == selectionId
            );
            ApiResponseOdds = runnerFromAPI?.ex?.availableToBack;
            let selectedOddsValue = ApiResponseOdds[0]?.price;
            if (selectedOddsValue >= betRate) {
              multipeResponse.push(selectedOddsValue);
            }
            multipeResponseForSecurityCheck.push(selectedOddsValue);
          }, 1000 * i);
        }
      }
    }

    // Cricket Match Odds
    else if (config.sportMarkets.includes(marketId) && config.cricketOdds == subMarketDetail.Id) {
      
      const userMaxBetSize = await userBetSizes.findOne({
        userId: userId,
        sportsId: marketId,
      });
      
      if (!userMaxBetSize) {
        activeBettors.delete(userId)
        return res.status(404).send({
          error: "User Max Bet Size Not Found",
          message: `something went wrong !`
        });
      }
      maxExp = userMaxBetSize.ExpAmount ? userMaxBetSize.ExpAmount : 0;
      console.log(userMaxBetSize, "userMaxBetSize",marketId)
      if (userMaxBetSize && betAmount > userMaxBetSize.amount) {
        activeBettors.delete(userId)
        return res
          .status(404)
          .send({ message: `max bet size is 3: ${userMaxBetSize.amount}` });
      }
      if (userMaxBetSize && betAmount < userMaxBetSize.minAmount) {
        activeBettors.delete(userId)
        return res
          .status(404)
          .send({ message: `min bet size is : ${userMaxBetSize.minAmount}` });
      }

      const resultCheck = await stopbetStatusChecker(eventDetail.Id);
      if (resultCheck === 400) {
        activeBettors.delete(userId)
        return res.status(404).send({
          message: `${message_result}`,
        });
      }

      const DBOddDetails = await Odds.findById(oddsId);
      if (!DBOddDetails) {
        activeBettors.delete(userId)
        return res.status(404).send({
          message: `Frontend provided odds _id do not found in db & _id =  ${oddsId}`,
        });
      }
      let runners = DBOddDetails?.runners;
      runnerForSaveInbets = runners.map((runner) => ({
        runner: runner.SelectionId,
        amount: 0,
      }));

      const OddDetailsTeam = DBOddDetails.runners.find(
        (runner) => runner.SelectionId == selectionId
      );

      const diff = getDiffBackAndLay(OddDetailsTeam)
      if (diff > 0.03) {
        delayAddition = 4
      }

      runnerName = OddDetailsTeam?.runnerName;
      /* start of code by qaiser */
      const BetPlaceData = await BetPlaceHold.findOne({
        eventId: DBOddDetails.eventId,
      });

      /*end of code by qaiser*/
      delay = (BetPlaceData.secondsValue + delayAddition) * 1000 + 200;
      if (selectedBetRate == betRate) {
        for (let i = 1; i < BetPlaceData.secondsValue + delayAddition; i++) {
          setTimeout(async () => {

            const oddsData = await apiCallForOdds(id);
            const runnerFromAPI = oddsData[0]?.runners?.find(
              (runner) => runner.selectionId == selectionId
            );
            let selectedOddsValue = 0;
            if (type == 0) {

              const ApiResponseOdds = runnerFromAPI?.ex?.availableToBack;
              if (ApiResponseOdds && ApiResponseOdds.length > 0) {
                selectedOddsValue = ApiResponseOdds[0].price;
              }

              if (selectedOddsValue != 0 && betRate <= selectedOddsValue) {
                multipeResponse.push(selectedOddsValue);
              }

              multipeResponseForSecurityCheck.push(selectedOddsValue);
            } else if (type == 1) {
              const ApiResponseOdds =
                runnerFromAPI.ex?.availableToLay;
              if (ApiResponseOdds && ApiResponseOdds.length > 0) {
                selectedOddsValue = ApiResponseOdds[0]?.price;
              }
              if (selectedOddsValue != 0 && betRate >= selectedOddsValue) {
                multipeResponse.push(selectedOddsValue);
              }
              multipeResponseForSecurityCheck.push(selectedOddsValue);
            }

          }, 1000 * i);
        }
      } else if (type == 1 && betRate < selectedBetRate) {
        activeBettors.delete(userId)
        return res.status(404).send({
          message: `Bet Miss Matched `,
        });
      } else if (type == 0 && betRate > selectedBetRate) {
        activeBettors.delete(userId)
        return res.status(404).send({
          message: `Bet Miss Matched `,
        });
      } else if (type == 1 && selectedBetRate != betRate) {
        // activeBettors.delete(userId)
        // return res.status(404).send({
        //   message: `Bet Miss Matched `,
        // });
        for (let i = 0; i < 4 + delayAddition; i++) {
          setTimeout(async () => {
            // const url = `${config.sportsAPIUrl}/odds/?ids=${id}`;
            // const response = await axios.get(url);
            // const oddsData = response.data;
            const oddsData = await apiCallForOdds(id);
            const runnerFromAPI = oddsData[0]?.runners.find(
              (runner) => runner.selectionId == selectionId
            );
            ApiResponseOdds = runnerFromAPI?.ex?.availableToLay;
            /**
             *
             * selectedRate 30
             * Bet Rate 29
             *
             */

            let selectedOddsValue = ApiResponseOdds[0]?.price;
            if (selectedOddsValue <= betRate) {
              multipeResponse.push(selectedOddsValue);
            }
            multipeResponseForSecurityCheck.push(selectedOddsValue);
          }, 1000 * i);
        }

        // LAY:
        // BetRate: 33
        // SelectedRate: 30

        // {

        // 4second API=>
        // 1st second=> 35 => save into array
        // 2nd       => 34 => save into array or donot save
        // 3rd       => 75 => save and move next
        // 4th       => 36 => save or do not save

        // }
        // if array has some values which are lesser than SeleectedRate then take the latest/top most index value.
        // ELSE
        // mistmatch.....
      } else if (type == 0 && selectedBetRate != betRate) {
        // activeBettors.delete(userId)
        // return res.status(404).send({
        //   message: `Bet Miss Matched `,
        // });
        for (let i = 0; i < 4 + delayAddition; i++) {
          setTimeout(async () => {
            // const url = `${config.sportsAPIUrl}/odds/?ids=${id}`;
            // const response = await axios.get(url);
            // const oddsData = response.data;
            const oddsData = await apiCallForOdds(id);
            const runnerFromAPI = oddsData[0]?.runners?.find(
              (runner) => runner.selectionId == selectionId
            );
            ApiResponseOdds = runnerFromAPI?.ex?.availableToBack;
            let selectedOddsValue = ApiResponseOdds[0]?.price;
            if (selectedOddsValue >= betRate) {
              multipeResponse.push(selectedOddsValue);
            }
            multipeResponseForSecurityCheck.push(selectedOddsValue);
          }, 1000 * i);
        }

        // Selected Rate: 30
        // BetRate      : 27

        // {

        // 4second API=>
        // 1st second=> 32 => save or do not save
        // 2nd       => 23 => rejected
        // 3rd       => 31 => save and move next
        // 4th       => 36 => save and move next
        // }

        // if array has some values which are lesser than Selected Rate then take the latest/top most index value.
        // ELSE
        // mismatch.....
      }
    }

    // GH HR Match Odds
    else if (config.raceMarkets.includes(marketId)) {
      if (betRate > 50) {
        activeBettors.delete(userId)
        return res.status(404).send({
          message: `Winning amount can not be more than 50 times than loosing amount`,
        });
      }
      //isManuel = false;
      const userMaxBetSize = await userBetSizes.findOne({
        userId: userId,
        sportsId: marketId,
      });
      if (!userMaxBetSize) {
        activeBettors.delete(userId)
        return res.status(404).send({
          error: "User Max Bet Size Not Found",
          message: `something went wrong !`
        });
      }
      maxExp = userMaxBetSize.ExpAmount ? userMaxBetSize.ExpAmount : 0;
      if (userMaxBetSize && betAmount > userMaxBetSize.amount) {
        activeBettors.delete(userId)
        return res
          .status(404)
          .send({ message: `max bet size is 4: ${userMaxBetSize.amount}` });
      }
      if (userMaxBetSize && betAmount < userMaxBetSize.minAmount) {
        activeBettors.delete(userId)
        return res
          .status(404)
          .send({ message: `min bet size is : ${userMaxBetSize.minAmount}` });
      }

      runnerName = req.body.runnerName;
      const DBOddDetails = await RaceOdds.findById(oddsId);
      if (!DBOddDetails) {
        activeBettors.delete(userId)
        return res.status(404).send({
          message: `Bet Miss Matched `,
        });
      }
      const OddDetailsTeam = DBOddDetails?.runners.find(
        (runner) => runner.selectionId == selectionId
      );

      const diff = getRaceDiffBackAndLay(OddDetailsTeam)
      if (diff > 3) {
        delayAddition = 4
      }

      let runners = DBOddDetails?.runners;
      runnerForSaveInbets = runners.map((runner) => ({
        runner: runner.selectionId,
        amount: 0,
      }));

      if (selectedBetRate == betRate) {
        for (let i = 1; i < 5 + delayAddition; i++) {
          setTimeout(async () => {
            // const url = `${config.horseRaceUrl}/odds/?ids=${id}`;
            // const response = await axios.get(url);
            // const oddsData = response.data;
            const oddsData = await apiCallForOdds(id);
            const runnerFromAPI = oddsData[0]?.runners.find(
              (runner) => runner.selectionId == selectionId
            );
            let selectedOddsValue = 0;
            if (type == 0) {
              const ApiResponseOdds = runnerFromAPI?.ex?.availableToBack;
              if (ApiResponseOdds && ApiResponseOdds.length > 0) {
                selectedOddsValue = ApiResponseOdds[0].price;
              }
              if (selectedOddsValue != 0 && betRate <= selectedOddsValue) {
                multipeResponse.push(selectedOddsValue);
              }
              multipeResponseForSecurityCheck.push(selectedOddsValue);
            } else if (type == 1) {
              const ApiResponseOdds = runnerFromAPI.ex?.availableToLay;
              if (ApiResponseOdds && ApiResponseOdds.length > 0) {
                selectedOddsValue = ApiResponseOdds[0].price;
              }
              if (selectedOddsValue != 0 && betRate >= selectedOddsValue) {
                multipeResponse.push(selectedOddsValue);
              }
              multipeResponseForSecurityCheck.push(selectedOddsValue);
            }
          }, 1000 * i);
        }
      } else if (type == 1 && betRate > selectedBetRate && betRate - Digitaddition > selectedBetRate) {
        activeBettors.delete(userId)
        return res.status(404).send({
          message: `Bet Miss Matched `,
        });
      } else if (type == 0 && selectedBetRate < betRate && selectedBetRate - Digitaddition > betRate) {
        activeBettors.delete(userId)
        return res.status(404).send({
          message: `Bet Miss Matched `,
        });
      } else if (type == 1 && betRate < selectedBetRate) {
        activeBettors.delete(userId)
        return res.status(404).send({
          message: `Bet Miss Matched `,
        });
      } else if (type == 0 && betRate > selectedBetRate) {
        activeBettors.delete(userId)
        return res.status(404).send({
          message: `Bet Miss Matched `,
        });
      } else if (type == 1 && selectedBetRate != betRate) {
        for (let i = 0; i < 4 + delayAddition; i++) {
          setTimeout(async () => {
            // const url = `${config.horseRaceUrl}/odds/?ids=${id}`;
            // const response = await axios.get(url);
            // const oddsData = response.data;

            const oddsData = await apiCallForOdds(id);

            const runnerFromAPI = oddsData[0]?.runners.find(
              (runner) => runner.selectionId == selectionId
            );

            const ApiResponseOdds = runnerFromAPI?.ex?.availableToLay;

            let selectedOddsValue = ApiResponseOdds[0]?.price;
            if (selectedOddsValue <= betRate) {
              multipeResponse.push(selectedOddsValue);
            }
            multipeResponseForSecurityCheck.push(selectedOddsValue);
          }, 1000 * i);
        }

        // LAY:
        // BetRate: 33
        // SelectedRate: 30

        // {

        // 4second API=>
        // 1st second=> 35 => save into array
        // 2nd       => 34 => save into array or donot save
        // 3rd       => 75 => save and move next
        // 4th       => 36 => save or do not save

        // }
        // if array has some values which are lesser than SeleectedRate then take the latest/top most index value.
        // ELSE
        // mistmatch.....
      } else if (type == 0 && selectedBetRate != betRate) {
        for (let i = 0; i < 4 + delayAddition; i++) {
          setTimeout(async () => {
            // const url = `${config.horseRaceUrl}/odds/?ids=${id}`;
            // const response = await axios.get(url);
            // const oddsData = response.data;
            const oddsData = await apiCallForOdds(id);
            const runnerFromAPI = oddsData[0]?.runners.find(
              (runner) => runner.selectionId == selectionId
            );

            const ApiResponseOdds = runnerFromAPI?.ex?.availableToBack;

            let selectedOddsValue = ApiResponseOdds[0]?.price;
            if (selectedOddsValue >= betRate) {
              multipeResponse.push(selectedOddsValue);
            }
            multipeResponseForSecurityCheck.push(selectedOddsValue);
          }, 1000 * i);
        }
      }
    }

    // Soccer Over Under
    else if (config.sportMarkets.includes(marketId) && subMarketDetail.Id == config.overUnder) {
      if (parseInt(betRate) > 50) {
        return res.status(404).send({
          message: `Winning amount can not be more than 50 times than loosing amount`,
        });
      }

      const userMaxBetSize = await userBetSizes.findOne({
        userId: userId,
        sportsId: marketId,
      });
      if (!userMaxBetSize) {
        activeBettors.delete(userId)
        return res.status(404).send({
          error: "User Max Bet Size Not Found",
          message: `something went wrong !`
        });
      }
      maxExp = userMaxBetSize.ExpAmount ? userMaxBetSize.ExpAmount : 0;
      if (userMaxBetSize && betAmount > userMaxBetSize.amount) {
        activeBettors.delete(userId)
        return res
          .status(404)
          .send({ message: `max bet size is 5: ${userMaxBetSize.amount}` });
      }
      if (userMaxBetSize && betAmount < userMaxBetSize.minAmount) {
        activeBettors.delete(userId)
        return res
          .status(404)
          .send({ message: `min bet size is : ${userMaxBetSize.minAmount}` });
      }

      _3rdPartyMarketId = overunderMarketId;
      const DBOddDetails = await Odds.findById(oddsId);
      if (!DBOddDetails) {
        activeBettors.delete(userId)
        return res.status(404).send({
          message: `Frontend provided odds _id do not found in db & _id =  ${oddsId}`,
        });
      }
      let runners = DBOddDetails?.runners;
      runnerForSaveInbets = runners.map((runner) => ({
        runner: runner.SelectionId,
        amount: 0,
      }));
      const OddDetailsTeam = DBOddDetails.runners.find(
        (runner) => runner.SelectionId == selectionId
      );

      const diff = getDiffBackAndLay(OddDetailsTeam)
      if (diff > 0.03) {
        delayAddition = 4
      }

      runnerName = OddDetailsTeam?.runnerName;
      if (selectedBetRate == betRate) {
        for (let i = 1; i < 5 + delayAddition; i++) {
          setTimeout(async () => {
            // const url = `${config.sportsAPIUrl}/odds/?ids=${overunderMarketId}`;
            // const response = await axios.get(url);
            // const oddsData = response.data;
            const oddsData = await apiCallForOdds(overunderMarketId);

            const runnerFromAPI = oddsData[0]?.runners.find(
              (runner) => runner.selectionId == selectionId
            );
            let selectedOddsValue = 0;
            if (type == 0) {
              const ApiResponseOdds =
                runnerFromAPI?.ex?.availableToBack;
              if (ApiResponseOdds && ApiResponseOdds.length > 0) {
                selectedOddsValue = ApiResponseOdds[0].price;
              }
              if (
                selectedOddsValue &&
                selectedOddsValue != 0 &&
                betRate <= selectedOddsValue
              ) {
                multipeResponse.push(selectedOddsValue);
              }
              multipeResponseForSecurityCheck.push(selectedOddsValue);
            } else if (type == 1) {
              const ApiResponseOdds =
                runnerFromAPI.ex?.availableToLay;
              if (ApiResponseOdds && ApiResponseOdds.length > 0) {
                selectedOddsValue = ApiResponseOdds[0]?.price;
              }
              if (
                selectedOddsValue &&
                selectedOddsValue != 0 &&
                betRate >= selectedOddsValue
              ) {
                multipeResponse.push(selectedOddsValue);
              }
              multipeResponseForSecurityCheck.push(selectedOddsValue);
            }
          }, 1000 * i);
        }
      } else if (type == 1 && betRate > selectedBetRate && betRate - Digitaddition > selectedBetRate) {
        activeBettors.delete(userId)
        return res.status(404).send({
          message: `Bet Miss Matched `,
        });
      } else if (type == 0 && selectedBetRate < betRate && selectedBetRate - Digitaddition > betRate) {
        activeBettors.delete(userId)
        return res.status(404).send({
          message: `Bet Miss Matched `,
        });
      } else if (type == 1 && betRate < selectedBetRate) {
        activeBettors.delete(userId)
        return res.status(404).send({
          message: `Bet Miss Matched `,
        });
      } else if (type == 0 && betRate > selectedBetRate) {
        activeBettors.delete(userId)
        return res.status(404).send({
          message: `Bet Miss Matched `,
        });
      } else if (type == 1 && selectedBetRate != betRate) {
        for (let i = 0; i < 4 + delayAddition; i++) {
          setTimeout(async () => {
            // const url = `${config.sportsAPIUrl}/odds/?ids=${overunderMarketId}`;
            // const response = await axios.get(url);
            // const oddsData = response.data;
            const oddsData = await apiCallForOdds(overunderMarketId);

            const runnerFromAPI = oddsData[0]?.runners.find(
              (runner) => runner.selectionId == selectionId
            );
            ApiResponseOdds = runnerFromAPI?.ex?.availableToLay;
            /**
             *
             * selectedRate 30
             * Bet Rate 29
             *
             */

            let selectedOddsValue = ApiResponseOdds[0]?.price;
            if (selectedOddsValue <= betRate) {
              multipeResponse.push(selectedOddsValue);
            }
            multipeResponseForSecurityCheck.push(selectedOddsValue);
          }, 1000 * i);
        }

        // LAY:
        // BetRate: 33
        // SelectedRate: 30

        // {

        // 4second API=>
        // 1st second=> 35 => save into array
        // 2nd       => 34 => save into array or donot save
        // 3rd       => 75 => save and move next
        // 4th       => 36 => save or do not save

        // }
        // if array has some values which are lesser than SeleectedRate then take the latest/top most index value.
        // ELSE
        // mistmatch.....
      } else if (type == 0 && selectedBetRate != betRate) {
        for (let i = 0; i < 4 + delayAddition; i++) {
          setTimeout(async () => {
            // const url = `${config.sportsAPIUrl}/odds/?ids=${overunderMarketId}`;
            // const response = await axios.get(url);
            // const oddsData = response.data;
            const oddsData = await apiCallForOdds(overunderMarketId);

            const runnerFromAPI = oddsData[0]?.runners.find(
              (runner) => runner.selectionId == selectionId
            );
            ApiResponseOdds = runnerFromAPI?.ex?.availableToBack;
            let selectedOddsValue = ApiResponseOdds[0]?.price;
            if (selectedOddsValue >= betRate) {
              multipeResponse.push(selectedOddsValue);
            }
            multipeResponseForSecurityCheck.push(selectedOddsValue);
          }, 1000 * i);
        }

        // Selected Rate: 30
        // BetRate      : 27

        // {

        // 4second API=>
        // 1st second=> 32 => save or do not save
        // 2nd       => 23 => rejected
        // 3rd       => 31 => save and move next
        // 4th       => 36 => save and move next
        // }

        // if array has some values which are lesser than SeleectedRate then take the latest/top most index value.
        // ELSE
        // mistmatch.....
      }
    }

    // Cricket Tied Match
    else if (config.sportMarkets.includes(marketId) && subMarketDetail.Id == config.tiedMatch) {
      // if (eventDetail.matchType === 'TEST' && (parseInt(betRate) > 50)) {
      if ((parseInt(betRate) > 50)) {
        return res.status(404).send({
          message: `Winning amount can not be more than 50 times than loosing amount`,
        });
      }

      const userMaxBetSize = await userBetSizes.findOne({
        userId: userId,
        sportsId: marketId,
        subarket: subMarketDetail.Id
      });
      if (!userMaxBetSize) {
        activeBettors.delete(userId)
        return res.status(404).send({
          error: "User Max Bet Size Not Found",
          message: `something went wrong !`
        });
      }
      maxExp = userMaxBetSize.ExpAmount ? userMaxBetSize.ExpAmount : 0;
      if (userMaxBetSize && betAmount > userMaxBetSize.amount) {
        activeBettors.delete(userId)
        return res
          .status(404)
          .send({ message: `max bet size is 6: ${userMaxBetSize.amount}` });
      }
      if (userMaxBetSize && betAmount < userMaxBetSize.minAmount) {
        activeBettors.delete(userId)
        return res
          .status(404)
          .send({ message: `min bet size is : ${userMaxBetSize.minAmount}` });
      }

      const resultcheck = await stopbetStatusChecker(eventDetail.Id);
      if (resultcheck === 400) {
        activeBettors.delete(userId)
        return res.status(404).send({
          message: `${message_result}`,
        });
      }
      const DBOddDetails = await Odds.findById(oddsId);
      if (!DBOddDetails) {
        activeBettors.delete(userId)
        return res.status(404).send({
          message: `Frontend provided odds _id do not found in db & _id =  ${oddsId}`,
        });
      }
      let runners = DBOddDetails?.runners;
      runnerForSaveInbets = runners.map((runner) => ({
        runner: runner.SelectionId,
        amount: 0,
      }));
      const OddDetailsTeam = DBOddDetails.runners.find(
        (runner) => runner.SelectionId == selectionId
      );
      runnerName = OddDetailsTeam?.runnerName;

      const BetPlaceData = await BetPlaceHold.findOne({
        eventId: DBOddDetails.eventId,
      });
      delay = BetPlaceData.secondsValue * 1000 + 200;

      if (selectedBetRate == betRate) {
        for (let i = 1; i < 5; i++) {
          setTimeout(async () => {
            // const url = `${config.sportsAPIUrl}/odds/?ids=${id}`;
            // const response = await axios.get(url);
            // const oddsData = response.data;
            const oddsData = await apiCallForOdds(id);

            const runnerFromAPI = oddsData[0]?.runners.find(
              (runner) => runner.selectionId == selectionId
            );
            let selectedOddsValue = 0;
            if (type == 0) {
              const ApiResponseOdds =
                runnerFromAPI?.ex?.availableToBack;
              if (ApiResponseOdds && ApiResponseOdds.length > 0) {
                selectedOddsValue = ApiResponseOdds[0].price;
              }
              if (selectedOddsValue != 0 && betRate <= selectedOddsValue) {
                multipeResponse.push(selectedOddsValue);
              }
              multipeResponseForSecurityCheck.push(selectedOddsValue);
            } else if (type == 1) {
              const ApiResponseOdds =
                runnerFromAPI.ex?.availableToLay;
              if (ApiResponseOdds && ApiResponseOdds.length > 0) {
                selectedOddsValue = ApiResponseOdds[0]?.price;
              }
              if (selectedOddsValue != 0 && betRate >= selectedOddsValue) {
                multipeResponse.push(selectedOddsValue);
              }
              multipeResponseForSecurityCheck.push(selectedOddsValue);
            }
          }, 1000 * i);
        }
      } else if (type == 1 && betRate < selectedBetRate) {
        activeBettors.delete(userId)
        return res.status(404).send({
          message: `Bet Miss Matched `,
        });
      } else if (type == 0 && betRate > selectedBetRate) {
        activeBettors.delete(userId)
        return res.status(404).send({
          message: `Bet Miss Matched `,
        });
      } else if (type == 1 && selectedBetRate != betRate) {
        // activeBettors.delete(userId)
        // return res.status(404).send({
        //   message: `Bet Miss Matched `,
        // });
        for (let i = 0; i < 4; i++) {
          setTimeout(async () => {
            // const url = `${config.sportsAPIUrl}/odds/?ids=${id}`;
            // const response = await axios.get(url);
            // const oddsData = response.data;
            const oddsData = await apiCallForOdds(id);
            const runnerFromAPI = oddsData[0]?.runners.find(
              (runner) => runner.selectionId == selectionId
            );
            ApiResponseOdds = runnerFromAPI?.ex?.availableToLay;
            let selectedOddsValue = ApiResponseOdds[0]?.price;
            if (selectedOddsValue <= betRate) {
              multipeResponse.push(selectedOddsValue);
            }
            multipeResponseForSecurityCheck.push(selectedOddsValue);
          }, 1000 * i);
        }
      } else if (type == 0 && selectedBetRate != betRate) {
        // activeBettors.delete(userId)
        // return res.status(404).send({
        //   message: `Bet Miss Matched `,
        // });
        for (let i = 0; i < 4; i++) {
          setTimeout(async () => {
            // const url = `${config.sportsAPIUrl}/odds/?ids=${id}`;
            // const response = await axios.get(url);
            // const oddsData = response.data;
            const oddsData = await apiCallForOdds(id);
            const runnerFromAPI = oddsData[0]?.runners.find(
              (runner) => runner.selectionId == selectionId
            );
            ApiResponseOdds = runnerFromAPI?.ex?.availableToBack;
            let selectedOddsValue = ApiResponseOdds[0]?.price;
            if (selectedOddsValue >= betRate) {
              multipeResponse.push(selectedOddsValue);
            }
            multipeResponseForSecurityCheck.push(selectedOddsValue);
          }, 1000 * i);
        }
      }
    }

    // Cricket Cup Winner
    else if (config.sportMarkets.includes(marketId) && subMarketDetail.Id == config.Cup) {

      const userMaxBetSize = await userBetSizes.findOne({
        userId: userId,
        sportsId: marketId,
      });
      if (!userMaxBetSize) {
        activeBettors.delete(userId)
        return res.status(404).send({
          error: "User Max Bet Size Not Found",
          message: `something went wrong !`
        });
      }
      maxExp = userMaxBetSize.ExpAmount ? userMaxBetSize.ExpAmount : 0;
      if (userMaxBetSize && betAmount > userMaxBetSize.amount) {
        activeBettors.delete(userId)
        return res
          .status(404)
          .send({ message: `max bet size is 7: ${userMaxBetSize.amount}` });
      }
      if (userMaxBetSize && betAmount < userMaxBetSize.minAmount) {
        activeBettors.delete(userId)
        return res
          .status(404)
          .send({ message: `min bet size is : ${userMaxBetSize.minAmount}` });
      }


      const resultcheck = await stopbetStatusChecker(eventDetail.Id);
      if (resultcheck === 400) {
        activeBettors.delete(userId)
        return res.status(404).send({
          message: `${message_result}`,
        });
      }
      const DBOddDetails = await Odds.findById(oddsId);
      if (!DBOddDetails) {
        activeBettors.delete(userId)
        return res.status(404).send({
          message: `Frontend provided odds _id do not found in db & _id =  ${oddsId}`,
        });
      }
      let runners = DBOddDetails?.runners;
      runnerForSaveInbets = runners.map((runner) => ({
        runner: runner.SelectionId,
        amount: 0,
      }));
      const OddDetailsTeam = DBOddDetails.runners.find(
        (runner) => runner.SelectionId == selectionId
      );
      runnerName = OddDetailsTeam?.runnerName;

      if (selectedBetRate == betRate) {
        for (let i = 1; i < 5; i++) {
          setTimeout(async () => {
            // const url = `${config.sportsAPIUrl}/odds/?ids=${id}`;
            // const response = await axios.get(url);
            // const oddsData = response.data;
            const oddsData = await apiCallForOdds(id);
            const runnerFromAPI = oddsData[0]?.runners.find(
              (runner) => runner.selectionId == selectionId
            );
            let selectedOddsValue = 0;
            if (type == 0) {
              const ApiResponseOdds =
                runnerFromAPI?.ex?.availableToBack;
              if (ApiResponseOdds && ApiResponseOdds.length > 0) {
                selectedOddsValue = ApiResponseOdds[0].price;
              }
              if (selectedOddsValue != 0 && betRate <= selectedOddsValue) {
                multipeResponse.push(selectedOddsValue);
              }
              multipeResponseForSecurityCheck.push(selectedOddsValue);
            } else if (type == 1) {
              const ApiResponseOdds =
                runnerFromAPI.ex?.availableToLay;
              if (ApiResponseOdds && ApiResponseOdds.length > 0) {
                selectedOddsValue = ApiResponseOdds[0]?.price;
              }
              if (selectedOddsValue != 0 && betRate >= selectedOddsValue) {
                multipeResponse.push(selectedOddsValue);
              }
              multipeResponseForSecurityCheck.push(selectedOddsValue);
            }
          }, 1000 * i);
        }
      } else if (type == 1 && betRate < selectedBetRate) {
        activeBettors.delete(userId)
        return res.status(404).send({
          message: `Bet Miss Matched `,
        });
      } else if (type == 0 && betRate > selectedBetRate) {
        activeBettors.delete(userId)
        return res.status(404).send({
          message: `Bet Miss Matched `,
        });
      } else if (type == 1 && selectedBetRate != betRate) {
        for (let i = 0; i < 4; i++) {
          setTimeout(async () => {
            // const url = `${config.sportsAPIUrl}/odds/?ids=${id}`;
            // const response = await axios.get(url);
            // const oddsData = response.data;
            const oddsData = await apiCallForOdds(id);
            const runnerFromAPI = oddsData[0]?.runners.find(
              (runner) => runner.selectionId == selectionId
            );
            ApiResponseOdds = runnerFromAPI?.ex?.availableToLay;
            let selectedOddsValue = ApiResponseOdds[0]?.price;
            if (selectedOddsValue <= betRate) {
              multipeResponse.push(selectedOddsValue);
            }
            multipeResponseForSecurityCheck.push(selectedOddsValue);
          }, 1000 * i);
        }
      } else if (type == 0 && selectedBetRate != betRate) {
        for (let i = 0; i < 4; i++) {
          setTimeout(async () => {
            // const url = `${config.sportsAPIUrl}/odds/?ids=${id}`;
            // const response = await axios.get(url);
            // const oddsData = response.data;
            const oddsData = await apiCallForOdds(id);
            const runnerFromAPI = oddsData[0]?.runners.find(
              (runner) => runner.selectionId == selectionId
            );
            ApiResponseOdds = runnerFromAPI?.ex?.availableToBack;
            let selectedOddsValue = ApiResponseOdds[0]?.price;
            if (selectedOddsValue >= betRate) {
              multipeResponse.push(selectedOddsValue);
            }
            multipeResponseForSecurityCheck.push(selectedOddsValue);
          }, 1000 * i);
        }
      }
    }

    // Cricket Toss
    else if (config.sportMarkets.includes(marketId) && subMarketDetail.Id == config.Toss) {

      const userMaxBetSize = await userBetSizes.findOne({
        userId: userId,
        sportsId: marketId,
      });
      if (!userMaxBetSize) {
        activeBettors.delete(userId)
        return res.status(404).send({
          error: "User Max Bet Size Not Found",
          message: `something went wrong !`
        });
      }
      maxExp = userMaxBetSize.ExpAmount ? userMaxBetSize.ExpAmount : 0;
      if (userMaxBetSize && betAmount > userMaxBetSize.amount) {
        activeBettors.delete(userId)
        return res
          .status(404)
          .send({ message: `max bet size is 8: ${userMaxBetSize.amount}` });
      }
      if (userMaxBetSize && betAmount < userMaxBetSize.minAmount) {
        activeBettors.delete(userId)
        return res
          .status(404)
          .send({ message: `min bet size is : ${userMaxBetSize.minAmount}` });
      }

      const resultcheck = await stopbetStatusChecker(eventDetail.Id);
      if (resultcheck === 400) {
        activeBettors.delete(userId)
        return res.status(404).send({
          message: `${message_result}`,
        });
      }
      const DBOddDetails = await Odds.findById(oddsId);
      if (!DBOddDetails) {
        activeBettors.delete(userId)
        return res.status(404).send({
          message: `Frontend provided odds _id do not found in db & _id =  ${oddsId}`,
        });
      }
      let runners = DBOddDetails?.runners;
      runnerForSaveInbets = runners.map((runner) => ({
        runner: runner.SelectionId,
        amount: 0,
      }));
      const OddDetailsTeam = DBOddDetails.runners.find(
        (runner) => runner.SelectionId == selectionId
      );
      runnerName = OddDetailsTeam?.runnerName;

      if (selectedBetRate == betRate) {
        for (let i = 1; i < 5; i++) {
          setTimeout(async () => {
            // const url = `${config.sportsAPIUrl}/odds/?ids=${id}`;
            // const response = await axios.get(url);
            // const oddsData = response.data;
            const oddsData = await apiCallForOdds(id);
            const runnerFromAPI = oddsData[0]?.runners.find(
              (runner) => runner.selectionId == selectionId
            );
            let selectedOddsValue = 0;
            if (type == 0) {
              const ApiResponseOdds =
                runnerFromAPI?.ex?.availableToBack;
              if (ApiResponseOdds && ApiResponseOdds.length > 0) {
                selectedOddsValue = ApiResponseOdds[0].price;
              }
              if (selectedOddsValue != 0 && betRate <= selectedOddsValue) {
                multipeResponse.push(selectedOddsValue);
              }
              multipeResponseForSecurityCheck.push(selectedOddsValue);
            } else if (type == 1) {
              const ApiResponseOdds =
                runnerFromAPI.ex?.availableToLay;
              if (ApiResponseOdds && ApiResponseOdds.length > 0) {
                selectedOddsValue = ApiResponseOdds[0]?.price;
              }
              if (selectedOddsValue != 0 && betRate >= selectedOddsValue) {
                multipeResponse.push(selectedOddsValue);
              }
              multipeResponseForSecurityCheck.push(selectedOddsValue);
            }
          }, 1000 * i);
        }
      } else {
        activeBettors.delete(userId)
        return res.status(404).send({
          message: `Bet miss matched`,
        });
      }
    }

    // For Fancy
    else if (subMarketDetail.Id == config.Fancy) {

      const userMaxBetSize = await userBetSizes.findOne({
        userId: userId,
        sportsId: marketId,
        subarket: subMarketDetail.Id
      });
      //console.log("Fancy  Max BetSize =============", userMaxBetSize);
      if (!userMaxBetSize) {
        activeBettors.delete(userId)
        return res.status(404).send({
          error: "User Max Bet Size Not Found",
          message: `something went wrong !`
        });
      }
      maxExp = userMaxBetSize.ExpAmount ? userMaxBetSize.ExpAmount : 0;
      if (userMaxBetSize && betAmount > userMaxBetSize.amount) {
        activeBettors.delete(userId)
        return res
          .status(404)
          .send({ message: `max bet size is 9: ${userMaxBetSize.amount}` });
      }
      if (userMaxBetSize && betAmount < userMaxBetSize.minAmount) {
        activeBettors.delete(userId)
        return res
          .status(404)
          .send({ message: `min bet size is : ${userMaxBetSize.minAmount}` });
      }

      isManuel = false;
      const fancyBetLimit = await userBetSizes.findOne({
        userId: userId,
        sportsId: marketId,
        subarket: config.Fancy
      }).exec();
      if (!userMaxBetSize) {
        console.warn("Fancy userMaxBetSize not found ");
        activeBettors.delete(userId)
        return res.status(404).send({ message: `something went wrong !` });
      }
      const resultcheck = await stopbetStatusChecker(eventDetail.Id);
      if (resultcheck === 400) {
        activeBettors.delete(userId)
        return res.status(404).send({
          message: `${message_result}`,
        });
      }
      if (fancyBetLimit && betAmount > fancyBetLimit.amount) {
        activeBettors.delete(userId)
        return res.status(404).send({ message: `max bet size is 10: ${fancyBetLimit.amount}` });
      }

      isFancyOrBookMaker = true;

      const buildFancyOdd = (apiFancyOddsRes) => {
        let odds = []
        for (const odd of apiFancyOddsRes) {
          odds.push({
            b1: odd.BackPrice1,
            b2: odd.BackPrice2,
            b3: odd.BackPrice3,
            bs1: odd.BackSize1,
            bs2: odd.BackSize2,
            bs3: odd.BackSize3,
            l1: odd.LayPrice1,
            l2: odd.LayPrice2,
            l3: odd.LayPrice3,
            ls1: odd.LaySize1,
            ls2: odd.LaySize2,
            ls3: odd.LaySize3,
            nat: odd.RunnerName,
            gstatus: odd.GameStatus,
            sid: odd.SelectionId,
          })
        }
        return odds
      }

      // const eventId = eventDetail.Id;
      // const url = `${FANCY_URL}/bm_fancy/${eventId}`;
      // const response = await axios.get(url);
      // const apiFancyOddsRes = await getFancyOdds([selectionId])
      let apiFancyOddsRes = await fetchSession(eventDetail.Id)
      apiFancyOddsRes = apiFancyOddsRes.filter(item => item.SelectionId === selectionId)
      if (apiFancyOddsRes[0]?.GameStatus === 'SUSPENDED' || apiFancyOddsRes[0]?.GameStatus === 'Ball Running') {
        activeBettors.delete(userId)
        return res.status(404).send({
          message: `Status not available for selected team ${selectionId}`,
        })
      }
      // const apiFancyOdds = response?.data?.data?.t3;
      const apiFancyOdds = buildFancyOdd(apiFancyOddsRes)
      const DBOddDetails = await FancyOdds.findById(oddsId);
      const dbFancyOdds = DBOddDetails?.data?.data?.t3;
      /* bookmaker check start */
      const dbBookmakerMarketId = DBOddDetails?.data?.data?.t2[0]?.bm1[0]?.ssid;
      if (!dbBookmakerMarketId) {
        activeBettors.delete(userId)
        return res.status(404).send({
          message: `Bookmaker market not available for selected team ${selectionId}`,
        })
      }
      // const apiBookmakerOddRes = await getBookmakerOdds([dbBookmakerMarketId])
      let apiBookmakerOddRes = await fetchBookmakerOdds(dbBookmakerMarketId)
      // const apiBookmakerOddRes = await getBookmakerOdds([dbBookmakerMarketId])

      const bookmakerStatus = apiBookmakerOddRes[0]?.runners.some((item) => item?.status === "ACTIVE")
      const bookmakerBallRunningStatus = apiBookmakerOddRes[0]?.runners.some((item) => ['Ball Running', 'BALL_RUNNING'].includes(item?.status))
      const bookmakerSuspendedStatus = apiBookmakerOddRes[0]?.runners.every((item) => item?.status === 'SUSPENDED')
      console.error('bookmaker status in fancy', bookmakerStatus, bookmakerBallRunningStatus, bookmakerSuspendedStatus)
      statusForRes.bookmakerStatus = bookmakerStatus
      statusForRes.bookmakerBallRunningStatus = bookmakerBallRunningStatus
      statusForRes.bookmakerSuspendedStatus = bookmakerSuspendedStatus
      statusForRes.fancyBMCheckTime = moment().format('YYYY/MM/DD HH:mm:ss')

      if (bookmakerSuspendedStatus) {
        activeBettors.delete(userId)
        return res.status(404).send({
          message: `Bookmaker all runners are in SUSPENDED status for selected team ${selectionId}`,
        })
      }
      if (bookmakerBallRunningStatus) {
        activeBettors.delete(userId)
        return res.status(404).send({
          message: `Bookmaker runner is in Ball Running status for selected team ${selectionId}`,
        })
      }
      if (!bookmakerStatus) {
        activeBettors.delete(userId)
        return res.status(404).send({
          message: `Bookmaker runner not available for selected team ${selectionId}`,
        })
      }
      /* bookmaker check end */
      if (apiFancyOdds?.length && dbFancyOdds?.length) {
        const apiSelectedOdds = apiFancyOdds.find(
          (runner) => runner.sid == selectionId
        );
        const dbSelectedOdds = dbFancyOdds.find(
          (runner) => runner.sid == selectionId
        );

        if (!apiSelectedOdds || !dbSelectedOdds) {
          activeBettors.delete(userId)
          return res.status(404).send({
            message: `Odds not available for the selected team ${selectionId}`,
          });
        }
        // Get the runner name from the 'nat' field
        fancyData = dbSelectedOdds.nat;
        runnerName = dbSelectedOdds.nat;
        _3rdPartyMarketId = dbSelectedOdds.nat;
        let oddsInsex = 0;
        if (req.body.type == 0) {
          if (betRate != apiSelectedOdds.l1) {
            activeBettors.delete(userId)
            return res.status(404).send({ message: `Bet miss matched ` });
          }
          const apiBackOdds2 = [apiSelectedOdds.l1, apiSelectedOdds.l2, apiSelectedOdds.l3];
          const apiBackOdds = apiBackOdds2.map((item) => Number(item));
          const DbBackOdds2 = [dbSelectedOdds.l1, dbSelectedOdds.l2, dbSelectedOdds.l3];
          const DbBackOdds = DbBackOdds2.map((item) => Number(item));
          const DbBackScores2 = [dbSelectedOdds.ls1, dbSelectedOdds.ls2, dbSelectedOdds.ls3];
          const DbBackScores = DbBackScores2.map((item) => Number(item));
          const index = DbBackOdds.indexOf(betRate);
          oddsInsex = index;
          TargetScore = betRate;

          if (index == -1) {
            activeBettors.delete(userId)
            return res.status(404).send({ message: `Bet miss matched` });
          }
          if (apiBackOdds[index] < betRate) {
            activeBettors.delete(userId)
            return res.status(404).send({ message: `Bet miss matched ` });
          }
        } else if (req.body.type == 1) {
          if (betRate != apiSelectedOdds.b1) {
            activeBettors.delete(userId)
            return res.status(404).send({ message: `Bet miss matched ` });
          }
          const apiBackOdds2 = [apiSelectedOdds.b1, apiSelectedOdds.b2, apiSelectedOdds.b3];
          const apiBackOdds = apiBackOdds2.map((item) => Number(item));
          const DbBackOdds2 = [dbSelectedOdds.b1, dbSelectedOdds.b2, dbSelectedOdds.b3];
          const DbBackOdds = DbBackOdds2.map((item) => Number(item));
          const DbBackScores2 = [dbSelectedOdds.bs1, dbSelectedOdds.bs2, dbSelectedOdds.bs3];
          const DbBackScores = DbBackScores2.map((item) => Number(item));

          const index = DbBackOdds.indexOf(betRate);
          oddsInsex = index;
          TargetScore = betRate;

          if (index == -1) {
            activeBettors.delete(userId)
            return res.status(404).send({ message: `Index miss matched` });
          }
          if (apiBackOdds[index] < betRate) {
            activeBettors.delete(userId)
            return res.status(404).send({ message: `Bet miss matched` });
          }
        } else {
          activeBettors.delete(userId)
          return res
            .status(400)
            .send({ message: "Invalid type value. Type should be 0 or 1." });
        }
        // layFancyRate = [ apiSelectedOdds.l1, apiSelectedOdds.l2, apiSelectedOdds.l3][0]; 
        // backFancyRate  = [apiSelectedOdds.b1,apiSelectedOdds.b2, apiSelectedOdds.b3][0];
      } else {
        activeBettors.delete(userId)
        return res.status(404).send({
          message: `Odds not available for the selected team ${req.body.selectionId}`,
        });
      }
    }

    // For Bookmaker
    else if (subMarketDetail.Id == config.BookMaker) {
      const userMaxBetSize = await userBetSizes.findOne({
        userId: userId,
        sportsId: marketId,
        subarket: subMarketDetail.Id
      });
      //console.log("Bookmaker  Max BetSize =============", userMaxBetSize);
      if (!userMaxBetSize) {
        activeBettors.delete(userId)
        return res.status(404).send({
          error: "User Max Bet Size Not Found",
          message: `something went wrong !`
        });
      }
      maxExp = userMaxBetSize.ExpAmount ? userMaxBetSize.ExpAmount : 0;
      if (userMaxBetSize && betAmount > userMaxBetSize.amount) {
        activeBettors.delete(userId)
        return res
          .status(404)
          .send({ message: `max bet size is 11: ${userMaxBetSize.amount}` });
      }
      if (userMaxBetSize && betAmount < userMaxBetSize.minAmount) {
        activeBettors.delete(userId)
        return res
          .status(404)
          .send({ message: `min bet size is : ${userMaxBetSize.minAmount}` });
      }

      const resultCheck = await stopbetStatusChecker(eventDetail.Id);
      if (resultCheck === 400) {
        activeBettors.delete(userId)
        return res.status(404).send({
          message: `${message_result}`,
        });
      }

      isFancyOrBookMaker = true;
      // const eventId = eventDetail.Id;
      // const url = `${FANCY_URL}/bm_fancy/${eventId}`;
      // const response = await axios.get(url);
      const DBOddDetails = await FancyOdds.findById(oddsId);
      const dbFancyOdds = DBOddDetails?.data?.data?.t2[0]?.bm1;
      const selectedMarketId = dbFancyOdds[0]?.ssid
      if (!selectedMarketId) {
        activeBettors.delete(userId)
        return res.status(404).send({
          message: `Bookmaker Odds not available for the selected team ${selectionId}`,
        });
      }
      // const bookmakerOddsRes = await getBookmakerOdds([selectedMarketId])
      let bookmakerOddsRes = await fetchBookmakerOdds(selectedMarketId)

      if (bookmakerOddsRes.length === 0) {
        activeBettors.delete(userId)
        return res.status(404).send({
          message: `Bookmaker Odds not available for the selected team ${selectionId}`,
        });
      }

      const bookmakerStatus = bookmakerOddsRes[0]?.runners.some((item) => item?.status === "ACTIVE")
      const bookmakerBallRunningStatus = bookmakerOddsRes[0]?.runners.some((item) => ['Ball Running', 'BALL_RUNNING'].includes(item?.status))
      const bookmakerSuspendedStatus = bookmakerOddsRes[0]?.runners.every((item) => item?.status === 'SUSPENDED')
      statusForRes.bookmakerStatus = bookmakerStatus
      statusForRes.bookmakerBallRunningStatus = bookmakerBallRunningStatus
      statusForRes.bookmakerSuspendedStatus = bookmakerSuspendedStatus
      statusForRes.bookmakerBMCheckTime = moment().format('YYYY/MM/DD HH:mm:ss')
      if (bookmakerSuspendedStatus) {
        activeBettors.delete(userId)
        return res.status(404).send({
          message: `Bookmaker all runners are in SUSPENDED status for selected team ${selectionId}`,
        })
      }
      if (bookmakerBallRunningStatus) {
        activeBettors.delete(userId)
        return res.status(404).send({
          message: `Bookmaker runner is in Ball Running status for selected team ${selectionId}`,
        })
      }
      if (!bookmakerStatus) {
        activeBettors.delete(userId)
        return res.status(404).send({
          message: `Bookmaker runner not available for selected team ${selectionId}`,
        })
      }

      const buildBookmakerOdd = (bookmakerOddsRes) => {
        let odds = []
        const bookmakerOdd = bookmakerOddsRes[0]
        for (const runner of bookmakerOdd.runners) {
          odds.push({
            b1: runner.back[0].price,
            b2: runner.back[1].price,
            b3: runner.back[2].price,
            bs1: runner.back[0].size,
            bs2: runner.back[1].size,
            bs3: runner.back[2].size,
            l1: runner.lay[0].price,
            l2: runner.lay[0].price,
            l3: runner.lay[0].price,
            ls1: runner.lay[0].size,
            ls2: runner.lay[0].size,
            ls3: runner.lay[0].size,
            s: runner.status,
            sid: runner.selectionId,
            ssid: bookmakerOdd?.marketId,
            nat: runner.runnerName,
          })
        }
        return odds
      }
      const apiBookmakerOdds = buildBookmakerOdd(bookmakerOddsRes)

      let runners = dbFancyOdds;
      // _3rdPartyMarketId = "Bookmaker";
      _3rdPartyMarketId = selectedMarketId;
      runnerForSaveInbets = runners.map((runner) => ({
        runner: runner.sid,
        amount: 0,
      }));

      if (apiBookmakerOdds.length && dbFancyOdds.length) {
        const apiSelectedOdds = apiBookmakerOdds.find(
          (runner) => runner.sid === selectionId
        );
        const dbSelectedOdds = dbFancyOdds.find(
          (runner) => runner.sid === selectionId
        );

        if (!apiSelectedOdds || !dbSelectedOdds) {
          activeBettors.delete(userId)
          return res.status(404).send({
            message: `Odds not available for the selected team ${selectionId}`,
          });
        }
        fancyData = null;
        runnerName = dbSelectedOdds.nat;
        if (req.body.type == 0) {
          if (betRate != apiSelectedOdds.b1) {
            activeBettors.delete(userId)
            return res.status(404).send({
              message: `Odds not available for the selected team ${selectionId}`,
            });
          }
          const apiBackOdds2 = [
            apiSelectedOdds.b1,
            apiSelectedOdds.b2,
            apiSelectedOdds.b3,
          ];
          const apiBackOdds = apiBackOdds2.map((item) => Number(item));

          const DbBackOdds2 = [
            dbSelectedOdds.b1,
            dbSelectedOdds.b2,
            dbSelectedOdds.b3,
          ];
          const DbBackOdds = DbBackOdds2.map((item) => Number(item));

          const DbBackScores2 = [
            dbSelectedOdds.bs1,
            dbSelectedOdds.bs2,
            dbSelectedOdds.bs3,
          ];
          const DbBackScores = DbBackScores2.map((item) => Number(item));

          const index = DbBackOdds.indexOf(betRate);
          TargetScore = DbBackScores[index];
          if (index === -1) {
            activeBettors.delete(userId)
            return res.status(404).send({ message: `Index didn't Match` });
          }
          if (apiBackOdds[index] < betRate) {
            activeBettors.delete(userId)
            return res.status(404).send({ message: `Bet miss matched` });
          }
        } else if (req.body.type == 1) {
          if (betRate != apiSelectedOdds.l1) {
            activeBettors.delete(userId)
            return res.status(404).send({
              message: `Odds not available for the selected team ${selectionId}`,
            });
          }
          const apiBackOdds2 = [
            apiSelectedOdds.l1,
            apiSelectedOdds.l2,
            apiSelectedOdds.l3,
          ];
          const apiBackOdds = apiBackOdds2.map((item) => Number(item));

          const DbBackOdds2 = [
            dbSelectedOdds.l1,
            dbSelectedOdds.l2,
            dbSelectedOdds.l3,
          ];
          const DbBackOdds = DbBackOdds2.map((item) => Number(item));

          const DbBackScores2 = [
            dbSelectedOdds.ls1,
            dbSelectedOdds.ls2,
            dbSelectedOdds.ls3,
          ];
          const DbBackScores = DbBackScores2.map((item) => Number(item));

          const index = DbBackOdds.indexOf(betRate);
          TargetScore = DbBackScores[index];

          if (index === -1) {
            activeBettors.delete(userId)
            return res.status(404).send({ message: `Index miss matched` });
          }
          if (apiBackOdds[index] < betRate) {
            activeBettors.delete(userId)
            return res.status(404).send({ message: `Bet miss matched` });
          }
        } else {
          return res
            .status(400)
            .send({ message: "Invalid type value. Type should be 0 or 1." });
        }
      }
    }

    // Figure Even Odd & Small Big
    else if (config.FigureEvenOddSmallBig.includes(subMarketDetail.Id)) {
      const userMaxBetSize = await userBetSizes.findOne({
        userId: userId,
        sportsId: marketId,
        subarket: subMarketDetail.Id
      });
      if (!userMaxBetSize) {
        activeBettors.delete(userId)
        return res.status(404).send({
          error: "User Max Bet Size Not Found",
          message: `something went wrong !`
        });
      }
      maxExp = userMaxBetSize.ExpAmount ? userMaxBetSize.ExpAmount : 0;
      if (userMaxBetSize && betAmount > userMaxBetSize.amount) {
        activeBettors.delete(userId)
        return res
          .status(404)
          .send({ message: `max bet size is 12: ${userMaxBetSize.amount}` });
      }
      if (userMaxBetSize && betAmount < userMaxBetSize.minAmount) {
        activeBettors.delete(userId)
        return res
          .status(404)
          .send({ message: `min bet size is : ${userMaxBetSize.minAmount}` });
      }

      const resultcheck = await stopbetStatusChecker(eventDetail.Id);
      if (resultcheck === 400) {
        activeBettors.delete(userId)
        return res.status(404).send({
          message: `${message_result}`,
        });
      }
      const FigureEvenOddSmallBig = await userBetSizes.findOne({
        userId: userId,
        sportsId: marketId,
        subarket: subMarketDetail.Id,
      }).exec();
      if (FigureEvenOddSmallBig && betAmount > FigureEvenOddSmallBig.amount) {
        activeBettors.delete(userId)
        return res.status(404).send({
          message: `max bet size is 13: ${FigureEvenOddSmallBig.amount}`,
        });
      }
      const dbscore = await Crickets.find({ eventId: eventDetail.Id }).sort({ _id: -1 }).limit(1)
      const scores = dbscore[0];
      if (!scores) {
        activeBettors.delete(userId)
        return res.status(404).json({
          status: false,
          message: `Bet Not Allowed`,
        });
      }
      //console.log(` scores =================== `, scores);
      let type = eventDetail.matchType;
      let inning = parseInt(scores.inning);
      let currentOver = (scores.activeTeam === scores.team1ShortName) ? scores.over1 : scores.over2
      let score = (scores.activeTeam === scores.team1ShortName) ? scores.score1 : scores.score2
      const wikets = score.split('/')[1];
      if (Number(wikets) === 10) {
        console.warn("Error : Wikets are 10");
        activeBettors.delete(userId)
        return res.status(404).send({
          success: false,
          message: "betting not allowed on 10 wikets !"
        });
      }
      let sessionAddition = 0;
      const sessionAdditionTimes = inning - 1
      if (inning !== 1) {
        if (type === "TEST") {
          sessionAddition = 9 * sessionAdditionTimes;
        } else if (type === "ODI") {
          sessionAddition = 10 * sessionAdditionTimes;
        } else if (type === "T20") {
          sessionAddition = 4 * sessionAdditionTimes;
        } else if (type === "T10") {
          sessionAddition = 2 * sessionAdditionTimes;
        }
      }
      let totalSessions = 0;
      TargetScore = currentOver;
      if (type == "TEST" && currentOver % 10 == 0) {
        activeBettors.delete(userId)
        console.warn("Error : Overs are 10");
        return res.status(404).send({
          success: false,
          message: "betting not allowed in Session 10th over !"
        });
      } else if (type != "TEST" && currentOver % 5 == 0) {
        activeBettors.delete(userId)
        console.warn("Error : Overs are 5");
        return res.status(404).send({
          success: false,
          message: "betting not allowed in Session 5th over !"
        });
      }

      let currentSessionOver = Math.ceil(currentOver % 5);

      currentSession = Math.ceil(currentOver / 5) + sessionAddition;

      switch (eventDetail.matchType) {
        case "T10":
          totalSessions = 2;
          break;
        case "T20":
          totalSessions = 4;
          break;
        case "ODI":
          totalSessions = 10;
          break;
        case "TEST":
          totalSessions = 9;
          currentSessionOver = Math.ceil(currentOver % 10);
          currentSession = Math.ceil(currentOver / 10) + sessionAddition;
          break;
        default:
          activeBettors.delete(userId)
          return res.json(404, {
            success: false,
            message: `Match Type is not defined : ${eventDetail.matchType}`,
          });
          break;
      }

      if (inning == 2 && currentSession >= (totalSessions + sessionAddition)) {
        activeBettors.delete(userId)
        console.warn("Error : Sessions  are going Over");
        return res.status(404).send({
          success: false,
          message: "betting not allowed in last session !"
        });
      } else if ((type == "TEST" && currentSessionOver > 8) || (type != "TEST" && currentSessionOver > 3)) {
        activeBettors.delete(userId)
        return res.status(404).send({
          success: false,
          message: `Betting not Allowed in ${type == "TEST" ? Math.ceil(currentOver % 10) : Math.ceil(currentOver % 5)} over`
        })

      }
      // if (type === "TEST" && scores?.day > 1) {
      //   currentSession = currentSession + 18
      // }
      _3rdPartyMarketId = subMarketDetail.Id;
      //console.log(" ================== currentSession  ", currentSession);
    }

    // For Asian Odd
    else if (marketId == "8") {
      const userMaxBetSize = await userBetSizes.findOne({
        userId: userId,
        sportsId: marketId,
      });
      //console.log(" Asian Casino Max BetSize ============= ", userMaxBetSize);

      if (!userMaxBetSize) {
        console.warn("userMaxBetSize not found ");
        activeBettors.delete(userId)
        return res.status(404).send({ message: `something went wrong !` });
      }
      maxExp = userMaxBetSize.ExpAmount ? userMaxBetSize.ExpAmount : 0;
      if (userMaxBetSize && betAmount > userMaxBetSize.amount) {
        activeBettors.delete(userId)
        return res
          .status(404)
          .send({ message: `max bet size is 14: ${userMaxBetSize.amount}` });
      }

      if (userMaxBetSize && betAmount < userMaxBetSize.minAmount) {
        activeBettors.delete(userId)
        return res
          .status(404)
          .send({ message: `min bet size is : ${userMaxBetSize.minAmount}` });
      }


      const DBOddDetails = await AsianMarketOdd.findOne({ roundId: roundId, marketId: asianMarketId });
      if (!DBOddDetails) {
        activeBettors.delete(userId)
        return res.status(404).send({
          message: `Frontend provided odds _id do not found in db & _id =  ${oddsId}`,
        });
      }

      let runners = DBOddDetails?.runners

      runnerForSaveInbets = runners.map((runner) => ({
        runner: runner.sid,
        amount: 0,
      }));

      const OddDetailsTeam = DBOddDetails.runners.find(
        (runner) => runner.sid == selectionId
      );
      runnerName = OddDetailsTeam?.nation;

      const asianTableDetail = await AsianTable.findOne({ tableId: oddsId });
      asianTableName = asianTableDetail.tableName;

      if (selectedBetRate == betRate) {
        for (let i = 1; i < 5; i++) {
          setTimeout(async () => {
            const url = `${LIVE_BET_TV_URL}/d_rate/${oddsId}`;
            const response = await axios.get(url);
            const oddsData = response.data;
            const playerFromAPI = oddsData.data?.t2.find(
              (player) => player.sid == selectionId
            );
            let selectedOddsValue = playerFromAPI?.rate;
            if (selectedOddsValue != 0 && betRate <= selectedOddsValue) {
              multipeResponse.push(selectedOddsValue);
            }
            multipeResponseForSecurityCheck.push(selectedOddsValue);
          }, 1000 * i);
        }
      } else if (
        type == 1 &&
        betRate > selectedBetRate &&
        betRate - Digitaddition > selectedBetRate
      ) {
        activeBettors.delete(userId)
        return res.status(404).send({
          message: `Bet Miss Matched `,
        });
      } else if (
        type == 0 &&
        selectedBetRate < betRate &&
        selectedBetRate - Digitaddition > betRate
      ) {
        activeBettors.delete(userId)
        return res.status(404).send({
          message: `Bet Miss Matched `,
        });
      } else if (type == 1 && betRate < selectedBetRate) {
        activeBettors.delete(userId)
        return res.status(404).send({
          message: `Bet Miss Matched `,
        });
      } else if (type == 0 && betRate > selectedBetRate) {
        activeBettors.delete(userId)
        return res.status(404).send({
          message: `Bet Miss Matched `,
        });
      } else if (type == 1 && selectedBetRate != betRate) {
        for (let i = 0; i < 4; i++) {
          setTimeout(async () => {
            const url = `${LIVE_BET_TV_URL}/d_rate/${oddsId}`;
            const response = await axios.get(url);
            const oddsData = response.data;
            const playerFromAPI = oddsData.data?.t2.find(
              (player) => player.sid == selectionId
            );
            let selectedOddsValue = playerFromAPI?.rate;
            if (selectedOddsValue <= betRate) {
              multipeResponse.push(selectedOddsValue);
            }
            multipeResponseForSecurityCheck.push(selectedOddsValue);
          }, 1000 * i);
        }
      } else if (type == 0 && selectedBetRate != betRate) {
        for (let i = 0; i < 4; i++) {
          setTimeout(async () => {
            const url = `${LIVE_BET_TV_URL}/d_rate/${oddsId}`;
            const response = await axios.get(url);
            const oddsData = response.data;
            const playerFromAPI = oddsData.data?.t2.find(
              (player) => player.sid == selectionId
            );
            let selectedOddsValue = playerFromAPI?.rate;
            if (selectedOddsValue >= betRate) {
              multipeResponse.push(selectedOddsValue);
            }
            multipeResponseForSecurityCheck.push(selectedOddsValue);
          }, 1000 * i);
        }
      }
      _3rdPartyMarketId = asianMarketId;
      // _3rdPartyMarketId = subMarketDetail.Id;
    } else {
      activeBettors.delete(userId)
      return res
        .status(404)
        .send({ message: `Error Placing bet (Inappropriate Request)` });
    }
    /* ============================================================ =============== */

    const delayExcludedMarkets = [...config.FigureEvenOddSmallBig, ...config.asianSubMarket, config.Fancy, config.BookMaker, config.Toss];
    if (delayExcludedMarkets.includes(subMarketDetail.Id)) {
      delay = 1;
      if (subMarketDetail.Id == config.Fancy || subMarketDetail.Id == config.BookMaker) {
        delay = 2000;
      }
    } else {
      delay += delayAddition * 1000;
    }

    setTimeout(async () => {

      if (multipeResponse.length == 0 && !delayExcludedMarkets.includes(subMarketDetail.Id)) {
        activeBettors.delete(userId)
        return res.status(404).send({
          message: `Bet Miss Matched `,
        });
      } else if (multipeResponse.length > 0 && !delayExcludedMarkets.includes(subMarketDetail.Id)) {
        betRate = multipeResponse[multipeResponse.length - 1];
      }

      /**
       * Winning Loosing Amounts Calculations
       */

      if (type == 4) {
        winningAmount = betAmount;
        loosingAmount = betAmount;
        selectionId == 0 ? (runnerName = `CHOTA`) : (runnerName = `BARA`);
        runnerForSaveInbets = [
          { runner: 1, amount: 0 },
          { runner: 0, amount: 0 },
        ];
        expoisureType = 2;
      } else if (type == 3) {
        winningAmount = betAmount;
        loosingAmount = betAmount;
        selectionId == 0 ? (runnerName = `KALI`) : (runnerName = `JOTTA`);
        runnerForSaveInbets = [
          { runner: 1, amount: 0 },
          { runner: 0, amount: 0 },
        ];
        expoisureType = 2;
      } else if (type == 2) {
        winningAmount = betAmount * betRate;
        loosingAmount = betAmount;
        runnerName = `Figure(${selectionId})`;
        runnerForSaveInbets = [
          { runner: 0, amount: 0 },
          { runner: 1, amount: 0 },
          { runner: 2, amount: 0 },
          { runner: 3, amount: 0 },
          { runner: 4, amount: 0 },
          { runner: 5, amount: 0 },
          { runner: 6, amount: 0 },
          { runner: 7, amount: 0 },
          { runner: 8, amount: 0 },
          { runner: 9, amount: 0 },
        ];
        expoisureType = 2;
      } else if (type == 1 && !config.ExcludedBackLay.includes(subMarketDetail.Id)) {
        winningAmount = betAmount;
        loosingAmount = betAmount * betRate - betAmount;
      } else if (type == 0 && !config.ExcludedBackLay.includes(subMarketDetail.Id)) {
        winningAmount = betAmount * betRate - betAmount;
        loosingAmount = betAmount;
      } else if (type == 1 && subMarketDetail.Id == config.BookMaker) {
        // ((rate) /100 ) * bet_amount = loosing amount
        loosingAmount = (betRate * betAmount) / 100;
        winningAmount = betAmount;
      } else if (type == 0 && subMarketDetail.Id == config.BookMaker) {
        // ((rate) /100 ) * bet_amount = winning amount
        winningAmount = (betRate * betAmount) / 100;
        loosingAmount = betAmount;
      } else if (type == 0 && subMarketDetail.Id == config.Fancy) {
        loosingAmount = (fancyRate / 100) * betAmount;
        winningAmount = betAmount;
        runnerForSaveInbets = [
          { runner: 1, amount: 0 },
          { runner: 0, amount: 0 },
        ];
      } else if (type == 1 && subMarketDetail.Id == config.Fancy) {
        winningAmount = (fancyRate / 100) * betAmount;
        loosingAmount = betAmount;
        runnerForSaveInbets = [
          { runner: 1, amount: 0 },
          { runner: 0, amount: 0 },
        ];
      } else if (type == 1 && marketId == 8) {
        winningAmount = betAmount;
        loosingAmount = betAmount * betRate - betAmount;
      } else if (type == 0 && marketId == 8) {
        winningAmount = betAmount * betRate - betAmount;
        loosingAmount = betAmount;
      }

      /* ------------ */
      /**
       * Current Position Of Runners Calculations on bases of Amounts
       */

      let runnersPosition = [];
      let prevExpAmount = 0;
      let expAmount = 0;

      if (subMarketDetail.Id == config.Fancy) {
        const lastBetsCount = await Bets.countDocuments({
          marketId: _3rdPartyMarketId,
          userId: req.decoded.userId,
          matchId: matchId,
          fancyData: fancyData,
          status: 1,
        });

        if (lastBetsCount > 0) {
          const lastBet = await Bets.find({
            marketId: _3rdPartyMarketId,
            userId: req.decoded.userId,
            matchId: matchId,
            fancyData: fancyData,
            status: 1,
          }).sort({ _id: -1 }).limit(1);

          const AllRunners = lastBet[0].runnersPosition;
          AllRunners.push(...[
            { runner: Number(TargetScore) - 1, position: 0 },
            { runner: Number(TargetScore), position: 0 },
            { runner: Number(TargetScore) + 1, position: 0 }
          ])
          let selectedAllRunners = AllRunners.map((item) => {
            return { runner: item.runner, position: 0 }
          })

          const AllPreviousBets = await Bets.find({
            marketId: _3rdPartyMarketId,
            userId: req.decoded.userId,
            matchId: matchId,
            fancyData: fancyData,
            status: 1,
          })


          for (const bet of AllPreviousBets) {
            const fancyNewPosition = selectedAllRunners.map((item) => {
              if (bet.type == 1 && item.runner < bet.TargetScore) item.position = Number((item.position - Number(bet.loosingAmount.toFixed(3))).toFixed(3));
              if (bet.type == 1 && item.runner >= bet.TargetScore) item.position = Number((item.position + Number(bet.winningAmount.toFixed(3))).toFixed(3));
              if (bet.type == 0 && item.runner < bet.TargetScore) item.position = Number((item.position + Number(bet.winningAmount.toFixed(3))).toFixed(3));
              if (bet.type == 0 && item.runner >= bet.TargetScore) item.position = Number((item.position - Number(bet.loosingAmount.toFixed(3))).toFixed(3));
              return item;
            });
            selectedAllRunners = fancyNewPosition
          }
          const runnerCurrentPosition = selectedAllRunners.map((item) => {
            if (type == 1 && item.runner < TargetScore) item.position = Number((item.position - Number(loosingAmount.toFixed(3))).toFixed(3));
            if (type == 1 && item.runner >= TargetScore) item.position = Number((item.position + Number(winningAmount.toFixed(3))).toFixed(3));
            if (type == 0 && item.runner < TargetScore) item.position = Number((item.position + Number(winningAmount.toFixed(3))).toFixed(3));
            if (type == 0 && item.runner >= TargetScore) item.position = Number((item.position - Number(loosingAmount.toFixed(3))).toFixed(3));
            return item;
          });
          runnersPosition = runnerCurrentPosition;
          prevExpAmount = lastBet[0].exposureAmount;


        } else {
          const runners = [
            { runner: Number(TargetScore) - 1, position: 0 },
            { runner: Number(TargetScore), position: 0 },
            { runner: Number(TargetScore) + 1, position: 0 }
          ]
          const runnerCurrentPosition = runners.map((item) => {
            if (type == 1 && item.runner < TargetScore) item.position = -Number(loosingAmount.toFixed(3));
            if (type == 1 && item.runner >= TargetScore) item.position = Number(winningAmount.toFixed(3));
            if (type == 0 && item.runner < TargetScore) item.position = Number(winningAmount.toFixed(3));
            if (type == 0 && item.runner >= TargetScore) item.position = -Number(loosingAmount.toFixed(3));
            return item;
          });
          runnersPosition = runnerCurrentPosition;
        }

        expAmount = runnersPosition.reduce((min, current) => {
          return current.position < min.position ? current : min;
        }, runnersPosition[0]);
        expAmount = expAmount.position;
        expAmount = expAmount < 0 ? Math.abs(expAmount) : 0;
      } else if (expoisureType == 2) {
        const lastBetsCount = await Bets.countDocuments({
          marketId: _3rdPartyMarketId,
          userId: req.decoded.userId,
          betSession: currentSession,
          matchId: matchId,
          status: 1,
        });
        /*  ============================ */
        if (lastBetsCount > 0) {
          const lastBet = await Bets.find({
            marketId: _3rdPartyMarketId,
            userId: req.decoded.userId,
            betSession: currentSession,
            matchId: matchId,
            status: 1,
          }).sort({ _id: -1 }).limit(1);
          const lastrunnersPosition = lastBet[0].runnersPosition;
          runnersPosition = lastrunnersPosition.map((item) => {
            if (item.runner == selectionId) {
              item.amount = Number((item.amount + Number(winningAmount.toFixed(3))).toFixed(3));
            } else {
              item.amount = Number((item.amount - Number(loosingAmount.toFixed(3))).toFixed(3));
            }
            return item;
          });
          prevExpAmount = lastBet[0].exposureAmount;
        } else {
          runnersPosition = runnerForSaveInbets.map((item) => {
            if (item.runner == selectionId) {
              item.amount = Number((item.amount + Number(winningAmount.toFixed(3))).toFixed(3));
            } else {
              item.amount = Number((item.amount - Number(loosingAmount.toFixed(3))).toFixed(3));
            }
            return item;
          });
        }
        expAmount = runnersPosition.reduce((min, current) => {
          return current.amount < min.amount ? current : min;
        }, runnersPosition[0]);
        expAmount = expAmount.amount;
        expAmount = expAmount < 0 ? Math.abs(expAmount) : 0;
        /* ============================= */
      } else if (marketId == "8") {
        const lastBetsCount = await Bets.countDocuments({
          marketId: _3rdPartyMarketId,
          userId: req.decoded.userId,
          matchId: matchId,
          runner: selectionId,
          status: 1,
        });
        if (lastBetsCount) {
          const resp = await asainCalculateExposure(
            _3rdPartyMarketId,
            req.decoded.userId,
            type,
            selectionId,
            loosingAmount,
            winningAmount,
            expoisureType,
            matchId
          );
          runnersPosition = resp.runnersPosition;
          prevExpAmount = resp.prevExpAmount;
        } else {
          if (type == 0) {
            const runnerCurrentPosition = runnerForSaveInbets.map((item) => {
              if (item.runner == selectionId) {
                item.amount = Number(
                  (item.amount + Number(winningAmount.toFixed(3))).toFixed(3)
                );
              } else {
                item.amount = Number(
                  (item.amount - Number(loosingAmount.toFixed(3))).toFixed(3)
                );
              }
              return item;
            });
            runnersPosition = runnerCurrentPosition;
          } else if (type == 1) {
            runnersPosition = runnerForSaveInbets.map((item) => {
              if (item.runner == selectionId) {
                item.amount = Number(
                  (item.amount - Number(loosingAmount.toFixed(3))).toFixed(3)
                );
              } else {
                item.amount = Number(
                  (item.amount + Number(winningAmount.toFixed(3))).toFixed(3)
                );
              }
              return item;
            });
          }
        }


        expAmount = runnersPosition.reduce((min, current) => {
          return current.amount < min.amount ? current : min;
        }, runnersPosition[0]);
        expAmount = expAmount.amount;
        expAmount = expAmount < 0 ? Math.abs(expAmount) : 0;

      } else {
        const lastBetsCount = await Bets.countDocuments({
          marketId: _3rdPartyMarketId,
          userId: req.decoded.userId,
          matchId: matchId,
          status: 1,
        });
        if (lastBetsCount) {
          const resp = await calculateExposure(_3rdPartyMarketId, req.decoded.userId, type, selectionId, loosingAmount, winningAmount, expoisureType, matchId);
          runnersPosition = resp.runnersPosition;
          prevExpAmount = resp.prevExpAmount;
        } else {
          if (type == 0) {
            const runnerCurrentPosition = runnerForSaveInbets.map((item) => {
              if (item.runner == selectionId) {
                item.amount = Number((item.amount + Number(winningAmount.toFixed(3))).toFixed(3));
              } else {
                item.amount = Number((item.amount - Number(loosingAmount.toFixed(3))).toFixed(3));
              }
              return item;
            });
            runnersPosition = runnerCurrentPosition;
          } else if (type == 1) {
            const runnerCurrentPosition = runnerForSaveInbets.map((item) => {
              if (item.runner == selectionId) {
                item.amount = Number((item.amount - Number(loosingAmount.toFixed(3))).toFixed(3));
              } else {
                item.amount = Number((item.amount + Number(winningAmount.toFixed(3))).toFixed(3));
              }
              return item;
            });
            runnersPosition = runnerCurrentPosition;
          }
        }


        expAmount = runnersPosition.reduce((min, current) => {
          return current.amount < min.amount ? current : min;
        }, runnersPosition[0]);
        expAmount = expAmount.amount;
        expAmount = expAmount < 0 ? Math.abs(expAmount) : 0;
      }

      let source = req.headers['user-agent']
      let ua = useragent.parse(source);

      let device
      if (ua.isMobile || ua.isiPad || ua.isTablet || ua.isiPhone || ua.isAndroid || ua.isMobileNative) {
        device = "Mobile"
      } else {
        device = "Computer"
      }

      const realIP = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

      const geoAPIKey = "2dee49c5aad5906aff30a1d0eb8ae024c548fed9"

      let geo = {
        latitude: 0,
        longitude: 0,
        region: null,
        city: null,
        zipCode: null,
        country: null,
        address: null
      };

      try {
        const getGeoInfoUrl = `http://api.db-ip.com/v2/${geoAPIKey}/${realIP}`

        const getInfo = await axios.get(getGeoInfoUrl)

        if (getInfo?.data) {
          geo.latitude = getInfo.data.latitude;
          geo.longitude = getInfo.data.longitude;
          geo.region = getInfo.data.region;
          geo.city = getInfo.data.city;
          geo.zipCode = getInfo.data.zipCode;
          geo.country = getInfo.data.countryLong;
          geo.address = `${getInfo.data?.district} ${getInfo.data?.city}, ${getInfo.data?.stateProv} ${getInfo.data?.zipCode}, ${getInfo.data?.countryName}`
        }
      } catch (error) {
        console.warn(error);
      }

      /**
       *  Check for Total calculated Exp should not greater then Allowed
       */
      const finalExpAmount = expAmount - prevExpAmount;
      if (finalExpAmount > maxExp) {
        activeBettors.delete(userId)
        return res.status(404).send({ message: `Max Exposure Amount : ${maxExp}` });
      }

      if (runnerName === 'The Draw' && parseInt(betRate) > 50) {
        return res.status(404).send({
          message: `Winning amount can not be more than 50 times than loosing amount`,
        });
      }

      const cricketScore = await Crickets.findOne({ eventId: eventDetail?.Id })
      const matchStatus = cricketScore?.result
      const matchLastUpdate = cricketScore?.updatedAt

      let backFancyRate = 0
      let layFancyRate = 0
      if (oddsId) {
        const DBOdd = await Odds.findById(oddsId);
        if (DBOdd) {
          const runner = DBOdd?.runners?.filter((item) => item.SelectionId === selectionId)[0]
          if (runner) {
            backFancyRate = runner?.ExchangePrices?.AvailableToBack?.length ? [...runner?.ExchangePrices?.AvailableToBack]?.sort((a, b) => b?.price - a?.price)[0]?.price : 0
            layFancyRate = runner?.ExchangePrices?.AvailableToLay?.length ? runner?.ExchangePrices?.AvailableToLay[0]?.price : 0
          }
        }
      }

      const bet = new Bets({
        marketId: _3rdPartyMarketId || 0,
        sportsId: marketId || 0,
        runnerName: runnerName || 0,
        userId,
        betAmount: betAmount || 0,
        betRate: Number(betRate) || 0,
        matchType: eventDetail?.matchType,
        matchStatus: matchStatus,
        matchLastUpdate: matchLastUpdate,
        eventId: eventDetail?.Id,
        selectedBetRate: selectedBetRate || 0,
        TargetScore: TargetScore || 0,
        matchId: matchId || null,
        loosingAmount: loosingAmount ? Number(loosingAmount.toFixed(3)) : 0,
        winningAmount: winningAmount ? Number(winningAmount.toFixed(3)) : 0,
        subMarketId: subMarketDetail ? subMarketDetail.Id : 0,
        betSession: currentSession ? currentSession : null,
        runner: selectionId ? selectionId : "",
        type: type || 0,
        status: 1,
        event: eventDetail ? eventDetail.name : oddsId,
        isfancyOrbookmaker: isFancyOrBookMaker,
        fancyData: fancyData,
        fancyRate: fancyRate,
        exposureAmount: expAmount ? Number(expAmount.toFixed(3)) : 0,
        runnersPosition: runnersPosition ? runnersPosition : [],
        ratesRecord: multipeResponseForSecurityCheck ? multipeResponseForSecurityCheck : [],
        betTime: BetTime,
        multipeResponse: multipeResponse ? multipeResponse : [],
        isManuel: isManuel,
        roundId: roundId,
        asianTableName: asianTableName,
        asianTableId: oddsId,
        randomStr: randomStr,
        locationData: geo,
        ipAddress: realIP,
        device: device,
        backFancyRate,
        layFancyRate,
      });
      
      let nowUser = await User.findOne({ userId }).exec();
      if (nowUser.availableBalance < expAmount - prevExpAmount) {
        activeBettors.delete(userId)
        return res.status(404).send({ message: " Insufficient balance " });
      }

      if (subMarketDetail.Id == config.Fancy) {
        await Bets.updateMany(
          {
            marketId: _3rdPartyMarketId,
            userId: req.decoded.userId,
            matchId: matchId,
            fancyData: fancyData,
            status: 1,
          },
          { calculateExp: false }
        );

        // const latestPreviousbet = await Bets.find(
        //   {
        //     marketId: _3rdPartyMarketId,
        //     userId: req.decoded.userId,
        //     matchId: matchId,
        //     status: 1
        //   }
        // ).sort({_id: -1}).limit(1);
        // await Exposure.deleteOne({trans_from_id: latestPreviousbet._id});

      } else if (config.FigureEvenOddSmallBig.includes(subMarketDetail.Id)) {
        let setCalculateExpFalse = await Bets.updateMany({
            marketId: _3rdPartyMarketId,
            userId: req.decoded.userId,
            matchId: matchId,
            betSession: currentSession,
            status: 1,
          },
          { calculateExp: false }
        );
        // const latestPreviousbet = await Bets.find({
        //     marketId: _3rdPartyMarketId,
        //     userId: req.decoded.userId,
        //     matchId: matchId,
        //     betSession: currentSession,
        //     status: 1,
        //   }
        // ).sort({_id: -1}).limit(1);
        // await Exposure.deleteOne({trans_from_id: latestPreviousbet._id})
      } else if (config.asianSubMarket.includes(subMarketDetail.Id)) {
        await Bets.updateMany(
          {
            marketId: _3rdPartyMarketId,
            userId: req.decoded.userId,
            matchId: matchId,
            roundId: roundId,
            status: 1,
            runner: selectionId
          },
          { calculateExp: false }
        );
        // const latestPreviousbet = await Bets.find(
        //   {
        //     marketId: _3rdPartyMarketId,
        //     userId: req.decoded.userId,
        //     matchId: matchId,
        //     roundId: roundId,
        //     status: 1,
        //     runner: selectionId
        //   }
        // ).sort({_id: -1}).limit(1);
      } else {
        await Bets.updateMany(
          {
            marketId: _3rdPartyMarketId,
            userId: req.decoded.userId,
            matchId: matchId,
            status: 1,
          },
          { calculateExp: false }
        );
        // const latestPreviousbet = await Bets.find(
        //   {
        //     marketId: _3rdPartyMarketId,
        //     userId: req.decoded.userId,
        //     matchId: matchId,
        //     status: 1,
        //   }
        // ).sort({_id: -1}).limit(1);
        // await Exposure.deleteOne({trans_from_id: latestPreviousbet._id});
      }

      bet.save(async (err, result) => {
        if (err) {
          console.warn("Error : ", err);
          activeBettors.delete(userId)
          return res.status(404).send({ message: `Something went wrong !` });
        }
        try {
          const position = new currentPosition({
            userId: userId,
            amount: -Number(loosingAmount.toFixed(3)),
            matchsId: matchId,
            betId: result._id,
          });
          await position.save();

          const nowUser = await User.findOne({ userId }).exec();
          const user_prev_balance = nowUser.balance;
          const user_prev_availableBalance = nowUser.availableBalance;
          const user_prev_exposure = nowUser.exposure;

          const totalExpAmount = expAmount - prevExpAmount;
          const UserExpAmountFix = nowUser.exposure + prevExpAmount - expAmount;
          const UserExpAmount = Number(UserExpAmountFix.toFixed(3));
          const UserAvlBalAmountAmt = nowUser.availableBalance + prevExpAmount - expAmount;
          const UserAvlBalAmount = Number(UserAvlBalAmountAmt.toFixed(3));

          await User.findOneAndUpdate(
            { userId: userId },
            {
              exposure: UserExpAmount,
              availableBalance: UserAvlBalAmount
            }
          );


          /** Start of Qaiser added tracking values in deposits */
            // let newDeposit = new Cash({
            //   userId: userId,
            //   description: `Bet Place`,
            //   betId:randomStr,
            //   addedExpoisureAmount:expAmount ? expAmount.toFixed(3) : 0,
            //   UserPrevexposure:user.exposure,
            //   UpdatedExposure:UserExpAmount,
            //   sourceCodeBlock:'Bet Place',
            //   loosingAmount: loosingAmount ? Number(loosingAmount.toFixed(3)) : 0,
            //   winningAmount: winningAmount ? Number(winningAmount.toFixed(3)) : 0,

            //   amount: betAmount || 0,
            //   balance: user.balance,
            //   availableBalance: UserAvlBalAmount,

            //   cashOrCredit: "Bet",
            //   marketId: _3rdPartyMarketId || 0,
            //   sportsId: marketId || 0,
            //   matchId: matchId || null,
            //   betType: type || 0,
            //   betDateTime: BetTime,
            // });
            // await newDeposit.save()

          const ExpTran = new Exposure({
              userId: userId,
              trans_from: "Bet Place",
              trans_from_id: randomStr,
              user_prev_balance: user_prev_balance,
              user_prev_availableBalance: user_prev_availableBalance,
              user_prev_exposure: user_prev_exposure,
              user_new_balance: nowUser.balance,
              user_new_availableBalance: UserAvlBalAmount,
              user_new_exposure: UserExpAmount,
              marketId: _3rdPartyMarketId || 0,
              sportsId: marketId || 0,
              calculatedExp: expAmount ? Number(expAmount.toFixed(3)) : 0,
              DateTime: new Date(),
              calculateExp: 1,
              exposureAmount: expAmount ? Number(expAmount.toFixed(3)) : 0,
            });

          await ExpTran.save()
          /** End of Qaiser added tracking values in deposits */

          await updateParentUserBalance(
            parentUserIds,
            winningAmount,
            matchId,
            result._id,
            selectionId,
            _3rdPartyMarketId,
            subMarketDetail?.Id
          );

          activeBettors.delete(userId)
          console.log("I am checking.............................................................");
          return res.send({
            success: true,
            message: "Bet placed successfully! ",
            results: result,
            statusForRes,
            delay: delayAddition,
          });
        } catch (error) {
          console.warn("error", error);
          activeBettors.delete(userId)
          return res
            .status(404)
            .send({ message: "Error updating user balance" });
        }
      });

      /* -------------- */
    }, delay);
  } catch (error) {
    console.warn("Error placing bet Catched ", error);
    const userId = req.decoded.userId;
    activeBettors.delete(userId)
    return res.status(404).send({ message: `Something went wrong !` });
  } finally {
    const userId = req.decoded.userId;
    activeBettors.delete(userId)
    await User.findOneAndUpdate(
      { userId: userId },
      { activeBetPlacing: false }
    );
  }
}

async function asainCalculateExposure(
  marketId,
  userId,
  type,
  selectedRunner,
  loosingAmount,
  winningAmount,
  expoisureType,
  matchId
) {
  let lastBet = await Bets.find({
    marketId: marketId,
    userId: userId,
    matchId: matchId,
    status: 1,
    runner: selectedRunner
  })
    .sort({ _id: -1 })
    .limit(1);

  const lastrunnersPosition = lastBet[0].runnersPosition;
  let newPosition;
  if (type == 0) {
    newPosition = lastrunnersPosition.map((item) => {
      if (item.runner == selectedRunner) {
        item.amount = Number(
          (item.amount + Number(winningAmount.toFixed(3))).toFixed(3)
        );
      } else {
        item.amount = Number(
          (item.amount - Number(loosingAmount.toFixed(3))).toFixed(3)
        );
      }
      return item;
    });
  } else if (type == 1) {
    newPosition = lastrunnersPosition.map((item) => {
      if (item.runner == selectedRunner) {
        item.amount = Number(
          (item.amount - Number(loosingAmount.toFixed(3))).toFixed(3)
        );
      } else {
        item.amount = Number(
          (item.amount + Number(winningAmount.toFixed(3))).toFixed(3)
        );
      }
      return item;
    });
  }
  return {
    runnersPosition: newPosition,
    prevExpAmount: lastBet[0].exposureAmount,
  };
}

async function calculateExposure(marketId, userId, type, selectedRunner, loosingAmount, winningAmount, expoisureType, matchId) {
  let lastBet = await Bets.find({
    marketId: marketId,
    userId: userId,
    matchId: matchId,
    status: 1,
  }).sort({ _id: -1 }).limit(1);
  const lastrunnersPosition = lastBet[0].runnersPosition;
  let newPosition;
  if (type == 0) {
    newPosition = lastrunnersPosition.map((item) => {
      if (item.runner == selectedRunner) {
        item.amount = Number((item.amount + Number(winningAmount.toFixed(3))).toFixed(3));
      } else {
        item.amount = Number((item.amount - Number(loosingAmount.toFixed(3))).toFixed(3));
      }
      return item;
    });
  } else if (type == 1) {
    newPosition = lastrunnersPosition.map((item) => {
      if (item.runner == selectedRunner) {
        item.amount = Number((item.amount - Number(loosingAmount.toFixed(3))).toFixed(3));
      } else {
        item.amount = Number((item.amount + Number(winningAmount.toFixed(3))).toFixed(3));
      }
      return item;
    });
  }
  return {
    runnersPosition: newPosition,
    prevExpAmount: lastBet[0].exposureAmount,
  };
}

async function getUserBets(req, res) {
  const errors = validationResult(req);
  if (errors.errors.length != 0) {
    return res.status(400).send({ errors: errors.errors });
  }
  try {
    // Initialize variables with default values
    let query = {};
    let page = 1;
    let sort = -1;
    let sortValue = "createdAt";
    let limit = config.pageSize;
    if (
      req.body.numRecords ||
      isNaN(req.body.numRecords) ||
      req.body.numRecords > 0
    ) {
      limit = Number(req.body.numRecords);
    }
    if (req.body.sortValue) sortValue = req.body.sortValue;
    if (req.body.sort) sort = Number(req.body.sort);
    if (req.body.page) page = Number(req.body.page);
    if (req.body.startDate && req.body.endDate) {
      const startTimestamp = new Date(req.body.startDate).getTime();
      const endTimestamp = new Date(req.body.endDate).getTime();
      query.createdAt = {
        $gte: startTimestamp,
        $lte: endTimestamp,
      };
    }
    query.status = req.body.status;
    if (req.decoded.role != "5") query.userId = req.body.userId;
    else if (req.decoded.role == "5") query.userId = req.decoded.userId;

    if (req.body.status) query.status = req.body.status;
    if (req.body.sportsId) query.sportsId = req.body.sportsId;
    if (req.body.searchValue)
      query.event = { $regex: req.body.searchValue, $options: "i" };

    // if (req.body.searchValue) {
    //   const searchRegex = new RegExp(req.body.searchValue, 'i');
    //   query.$or = [
    //     { name: { $regex: searchRegex } },
    //     {
    //       $expr: {
    //         $regexMatch: { input: { $toString: '$betRate' }, regex: searchRegex },
    //       },
    //     },
    //     {
    //       $expr: {
    //         $regexMatch: {
    //           input: { $toString: '$betAmount' },
    //           regex: searchRegex,
    //         },
    //       },
    //     },
    //   ];
    // }

    Bets.paginate(
      query,
      { page: page, sort: { [sortValue]: sort }, limit: limit },
      (err, results) => {
        if (err)
          return res
            .status(404)
            .send({ message: `Something went wrong  ${err} ` });
        return res.send({
          success: true,
          message: "bets list",
          results: results,
        });
      }
    );
  } catch (error) {
    return res.send({
      success: false,
      message: "Something goes wrong catched",
    });
  }
}

function betFunds(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).send({ errors: errors.array() });
  }

  if (req.decoded.role !== "5") {
    User.find({ createdBy: req.decoded.userId, role: "5" }, (err, users) => {
      if (err || !users) {
        return res
          .status(404)
          .send({ message: "Error occurred while querying users." });
      }

      const userIds = users.map((user) => user.userId);

      Bets.find({ userId: { $in: userIds } }, (err, bets) => {
        if (err || !bets) {
          return res.status(404).send({ message: "Error occurred in bets." });
        }

        const activeBets = bets.filter((bet) => bet.status === 1).length;

        User.findOne({ userId: req.decoded.userId }, (err, user) => {
          if (err || !user) {
            return res.status(404).send({ message: "User Not Found" });
          }

          const results = {
            balance: user.balance,
            liable: user.exposure,
            credit: user.credit,
            available: user.availableBalance,
            activeBets: activeBets,
          };

          return res.send({ message: "Funds Record Found", results: results });
        });
      });
    });
  } else {
    Bets.find({ userId: req.decoded.userId }, (err, bets) => {
      if (err) {
        return res.status(404).send({ message: "Error occurred in bets." });
      }

      User.findOne({ userId: req.decoded.userId }, (err, user) => {
        if (err || !user) {
          return res.send({ message: "User Not Found" });
        }

        const activeBets = bets.filter((bet) => bet.status === 1).length;

        const results = {
          balance: user.balance,
          liable: user.exposure,
          credit: user.credit,
          available: user.availableBalance,
          activeBets: activeBets,
        };

        return res.send({ message: "Funds Record Found", results: results });
      });
    });
  }
}

function createBetRates(req, res) {
  const recordsToCreate = 15;
  const AllbetRates = [];
  let betRate = 1.5;
  for (let i = 0; i < recordsToCreate; i++) {
    const roundedBetRate = Number(betRate.toFixed(1));
    AllbetRates.push(roundedBetRate);
    betRate += 0.2;
  }
  const betRatesData = [
    {
      match: "PAK vs AUS",
      teams: [
        {
          name: "Pakistan",
          back: AllbetRates,
          lay: AllbetRates,
        },
        {
          name: "AUS",
          back: AllbetRates,
          lay: AllbetRates,
        },
        {
          name: "draw",
          back: AllbetRates,
          lay: AllbetRates,
        },
      ],
    },
    {
      match: "PAK vs IND",
      teams: [
        {
          name: "Pakistan",
          back: AllbetRates,
          lay: AllbetRates,
        },
        {
          name: "IND",
          back: AllbetRates,
          lay: AllbetRates,
        },
        {
          name: "draw",
          back: AllbetRates,
          lay: AllbetRates,
        },
      ],
    },
    {
      match: "IND vs AUS",
      teams: [
        {
          name: "IND",
          back: AllbetRates,
          lay: AllbetRates,
        },
        {
          name: "AUS",
          back: AllbetRates,
          lay: AllbetRates,
        },
        {
          name: "draw",
          back: AllbetRates,
          lay: AllbetRates,
        },
      ],
    },
  ];
  betRates
    .insertMany(betRatesData)
    .then(() => {
      res.status(200).json({ message: "Dummy data created successfully." });
    })
    .catch((error) => {
      res.status(500).json({ error: "Error creating dummy data." });
    });
}

async function getBetRates(req, res) {
  const errors = validationResult(req);
  if (errors.errors.length !== 0) {
    return res.status(400).send({ errors: errors.errors });
  }

  const matchId = req.params.id;
  const match = await betRates.findOne({ _id: matchId });
  if (!match) {
    return res.status(404).send({ message: "bets rate not found" });
  }

  const randomRates = getRandomRates(match);

  return res.send({
    success: true,
    message: "bets rate records",
    results: randomRates,
  });
}

function getRandomRates(match) {
  const randomRates = [];

  for (const team of match.teams) {
    const randomBackRates = getRandomSubset(team.back, 3);
    const randomLayRates = getRandomSubset(team.lay, 3);

    randomRates.push({
      name: team.name,
      back: randomBackRates,
      lay: randomLayRates,
    });
  }

  return {
    match: match.match,
    teams: randomRates,
  };
}

function getRandomSubset(arr, size) {
  const shuffled = arr.sort(() => 0.5 - Math.random());
  return shuffled.slice(0, size);
}

async function getAllUserIDs(createdByIDs, processedIDs = new Set()) {
  const userIDs = [];

  if (createdByIDs.length === 0) {
    return userIDs;
  }


  const uniqueIDs = createdByIDs.filter((id) => !processedIDs.has(id));
  processedIDs = new Set([...processedIDs, ...uniqueIDs]);

  const users = await User.find(
    { createdBy: { $in: uniqueIDs } },
    { userId: 1, userName: 1, createdBy: 1 }
  ).lean();

  for (const user of users) {
    userIDs.push(user.userId);
  }


  const subUserIDs = await getAllUserIDs(userIDs, processedIDs);
  userIDs.push(...subUserIDs);

  return userIDs;
}

async function getMatchedBets(req, res) {
  const errors = validationResult(req);
  let relatedEvents = [];
  if (!errors.isEmpty()) {
    return res.status(400).send({ errors: errors.array() });
  }

  try {
    const loginUser = await User.findOne({ userId: req.decoded.userId });
    if (!loginUser) {
      return res.status(404).send({ message: "User not found" });
    }

    const bettorMaster = await User.findOne({ userId: loginUser.createdBy });
    const userOfLoginUser = await User.find({ createdBy: loginUser.userId });
    const createdByIDs = userOfLoginUser.map((user) => user.userId);

    // Fetch all user IDs using optimized function
    const userIDs = await getAllUserIDs(createdByIDs);
    const matchId = req.query.id;

    if (loginUser.role == "5") {
      userIDs.push(loginUser.userId);
    }

    // Use the $lookup aggregation pipeline to fetch matched bets along with user information and related events
    var matchedBets = await Bets.aggregate([
      {
        $match: {
          userId: { $in: [...createdByIDs, ...userIDs, loginUser.userId] },
          status: 1,
          matchId: matchId,
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "userId",
          as: "userDetails",
        },
      },
      { $unwind: "$userDetails" },
      {
        $lookup: {
          from: "users",
          localField: "userDetails.createdBy",
          foreignField: "userId",
          as: "masterDetails",
        },
      },
      {
        $lookup: {
          from: "inplayevents",
          localField: "sportsId",
          foreignField: "sportsId",
          as: "eventDetails",
        },
      },
      {
        $project: {
          _id: 0,
          price: "$betRate",
          runnersPosition: "$runnersPosition",
          calculateExp: "$calculateExp",
          runnerId: "$runnerName",
          createdAt: "$createdAt",
          size: "$betAmount",
          runner: "$runner",
          marketId: "$marketId",
          betRate: "$betRate",
          type: "$type",
          isfancyOrbookmaker: "$isfancyOrbookmaker",
          fancyData: "$fancyData",
          bettor: "$userDetails.userName",
          bettorId: "$userDetails.userId",
          fancyRate: "$fancyRate",
          betSession: "$betSession",
          roundId: "$roundId",
          master: {
            $cond: [
              { $eq: [loginUser.role, "5"] },
              loginUser.userName,
              {
                $ifNull: [{ $arrayElemAt: ["$masterDetails.userName", 0] }, ""],
              },
            ],
          },
          event: {
            $cond: [
              { $eq: [loginUser.role, "5"] },
              {
                $map: {
                  input: { $slice: ["$eventDetails", 5] },
                  as: "event",
                  in: {
                    name: "$$event.name",
                    openDate: "$$event.openDate",
                  },
                },
              },
              "$$REMOVE",
            ],
          },
        },
      },
      { $sort: { _id: -1 } },
    ]).exec();

    // if (!matchedBets || matchedBets.length == 0) {
    //   return res.status(200).send({ message: 'Matched bets not found', data: [] });
    // }

    const eventId = await Events.findById(matchId);
    if (eventId) {
      relatedEvents = await Events.find({
        sportsId: eventId.sportsId,
        openDate: {
          $gt: eventId.openDate,
        },
      }).limit(5);
    }

    if (matchedBets.length > 0) {
      const promises = matchedBets.map(async (item) => {
        const multiplier = await getPercentageSharing(
          item.bettorId,
          loginUser.userId
        );
        return {
          ...item,
          percentage: multiplier,
        };
      });
      matchedBets = await Promise.all(promises);
    }

    return res.send({
      success: true,
      message: "Matched bets record found",
      data: matchedBets,
      events: relatedEvents,
    });
  } catch (err) {
    console.warn("Aggregation error:", err);
    return res
      .status(500)
      .send({ message: "Error retrieving matched bets", error: err });
  }
}

async function FakeBetsList(req, res) {
  try {
    Bets.find({ isFake: 1 }, (err, result) => {
      if (err || !result) {
        return res.status(404).send({ message: "bets rate not found" });
      }
      return res.send({
        success: true,
        message: "Bets List",
        results: result,
      });
    });
  } catch (error) {
    return res.send({
      success: false,
      message: "Some thing went wrong",
      results: error,
    });
  }
}

async function updateFakeBet(req, res) {
  try {
    const betId = req.params.id;
    const updateBet = await Bets.findOneAndUpdate(
      { _id: betId },
      {
        $set: {
          isFake: 0,
        },
      }
    );

    if (!updateBet) {
      return res.status(404).json({ message: "Bet not found" });
    }

    return res
      .status(200)
      .send({ message: "Bet successfully updated", success: true });
  } catch (error) {
    return res.send({
      success: false,
      message: "Some thing went wrong",
      results: error,
    });
  }
}

async function deleteFakeBet(req, res) {
  try {
    const betId = req.params.id;
    const deletedBet = await Bets.findByIdAndDelete(betId);
    if (!deletedBet) {
      return res.status(404).json({ message: "Bet not found" });
    }

    return res
      .status(200)
      .send({ message: "Bet deleted successfully", success: true });
  } catch (error) {
    return res.send({
      success: false,
      message: "Some thing went wrong",
      results: error,
    });
  }
}

async function countFakeBet(req, res) {
  try {
    const fakeCount = await Bets.countDocuments({ isFake: 1 });

    return res.send({
      success: false,
      message: "Some thing went wrong",
      results: {
        totalFakeBets: fakeCount,
      },
    });
  } catch (error) {
    return res.send({
      success: false,
      message: "Some thing went wrong",
      results: error,
    });
  }
}

async function approvedFakeBet(req, res) {
  if (req.decoded.role !== "0") {
    return res
      .status(403)
      .send({ message: "Only company can perform this operation" });
  }

  try {
    const betId = req.params.id;
    const fakeBet = await Bets.findOne({ _id: betId, isFake: 1 });

    if (!fakeBet) {
      return res.status(404).json({ message: "Bet not found" });
    }
    const updatedUser = await User.findOneAndUpdate(
      { userId: fakeBet.userId },
      { $set: { isActive: false } },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    return res
      .status(200)
      .send({ message: "user deactivated successfully", success: true });
  } catch (error) {
    console.warn("Error updating bet:", error);
    return res.status(500).send({
      success: false,
      message: "Something went wrong",
      error: error.message,
    });
  }
}

async function reviewFakeBet(req, res) {
  if (req.decoded.role !== "0") {
    return res
      .status(403)
      .send({ message: "Only company can perform this operation" });
  }

  try {
    const betId = req.params.id;
    const sportsId = req.params.sportsId;

    const fakeBet = await Bets.findOne({
      _id: betId,
      isFake: 1,
      sportsId: sportsId,
    });

    if (!fakeBet) {
      return res.status(404).json({ message: "Bet not found" });
    }

    // Find the odds before the bet's createdAt timestamp
    const oddsBeforeBet = await Odds.find({
      eventId: fakeBet.eventId,
      createdAt: { $lt: fakeBet.createdAt },
    })
      .sort({ createdAt: -1 })
      .limit(200)
      .select("eventId updatetime runners");

    // Find the odds after the bet's createdAt timestamp
    const oddsAfterBet = await Odds.find({
      eventId: fakeBet.eventId,
      createdAt: { $gt: fakeBet.createdAt },
    })
      .sort({ createdAt: 1 })
      .limit(200)
      .select("eventId updatetime runners");

    // Combine the runners into a single array for both oddsBeforeBet and oddsAfterBet
    const BeforeBetOdds = oddsBeforeBet.map((odds) => odds.runners).flat();
    const AfterBetOdds = oddsAfterBet.map((odds) => odds.runners).flat();

    return res.status(200).send({
      message: "Odds successfully retrieved",
      success: true,
      eventId: fakeBet.eventId,
      updatetime: fakeBet.createdAt,
      BeforeBetOdds,
      AfterBetOdds,
    });
  } catch (error) {
    console.warn("Error retrieving odds:", error);
    return res.status(500).send({
      success: false,
      message: "Something went wrong",
      error: error.message,
    });
  }
}

async function cricketLiveScore(id) {
  try {
    const event = await Events.findOne(
      { Id: id },
      { _id: 0, matchType: 1, sportsId: 1 }
    );
    const type = event ? event.sportsId : null;

    if (type == "4") {
      const apiResponse = await axios.get(`${config.sportsLiveScore}${id}`);
      const response = {};
      const data = apiResponse.data;
      if (data[0]?.score != null) {
        const event = await Events.findOne(
          { Id: id },
          { _id: 0, matchType: 1, sportsId: 1 }
        );
        const type = event ? event?.matchType : null;
        // const scoreInfo     = JSON.parse(data).score
        const scoreInfo = data[0].score;
        let day = 1;
        let score = 0;
        let inning = 1;
        let played
        if (scoreInfo.activenation1 == 1) {
          score = scoreInfo.score1;
          played = scoreInfo.score2;
        } else if (scoreInfo.activenation2 == 1) {
          score = scoreInfo.score2;
          played = scoreInfo.score1;
        }
        if (type == "TEST") {
          score = score.split("&");
          day = score.length;
          score = score[score.length - 1].trim();
          played = played.split("&");
          played = played[played.length - 1].trim();
        }

        played = played
          ?.replaceAll(/[\s-]/g, ",")
          .replaceAll(/[())]/g, "")
          .split(",");
        played = played.filter((element) => element != 0).length;
        if (played > 0) {
          inning = 2;
        }

        [response.score, response.wickets, response.overs] = score
          ?.replaceAll(/[\s-]/g, ",")
          .replaceAll(/[())]/g, "")
          .split(",");
        response.inning = inning;
        response.balls = scoreInfo.balls;
        response.type = event.matchType;
        response.day = day;
        return response;
      } else {
        return 0;
      }
    } else {
      return {
        status: false,
        message: "Figure batting not Allowed !",
      };
    }
  } catch (error) {
    console.warn(error);
    return {
      success: false,
      message: "Failed to get data",
      error: error.message,
    };
  }
}

const sessionCalc = async (req, res) => {
  try {
    const eventsIds = await Events.distinct("Id", {
      sportsId: "4",
      inplay: true,
      CompanySetStatus: "OPEN",
      isShowed: true,
      status: { $in: ["OPEN", "open"] },
    });

    for (let Id of eventsIds) {
      const event = await Events.findOne(
        { Id: Id },
        { _id: 0, matchType: 1, sportsId: 1 }
      );
      const type = event.matchType;
      //console.log(type)
      //console.log(config.matchTypes)
      if (config.matchTypes.includes(type)) {
        const score = await cricketLiveScore(Id);
        if (score != 0) {
          let currentScore = Number(score.score);
          const sessionLength = type == "TEST" ? 10 : 5;
          config.balls.includes(score.balls[5])
            ? (currentScore = currentScore - Number(score.balls[5]))
            : "";
          let currentOver = score.overs;
          let ball = currentOver.split(".")[1];
          let inning = score.inning;

          if (currentOver % sessionLength < 1 && ball == 1) {
            let sessionAddition = 0;
            if (inning == 2) {
              if (type == "TEST") {
                sessionAddition = 9;
              } else if (type == "ODI") {
                sessionAddition = 10;
              } else if (type == "T20") {
                sessionAddition = 4;
              } else if (type == "T10") {
                sessionAddition = 2;
              }
            }
            let sessionToResult =
              Math.floor(currentOver / sessionLength) + sessionAddition;
            const update = await Session.findOneAndUpdate(
              {
                eventId: Id,
                sessionNo: sessionToResult,
              },
              {
                $set: {
                  score: currentScore,
                },
              }
            );
          } else {
            console.warn(`Session Not Applicable`);
          }
        }
      } else {
        console.warn("Invalid Match Type ");
      }
    }
  } catch (error) {
    console.warn("Error running odds cron job:", error);
  }
};

async function getPercentageSharing(parent_id, child_id) {
  let currentId = child_id;
  let parent = null;

  if (parent_id == child_id) return 1;

  while (true) {
    parent = await User.findOne({ userId: currentId });
    if (
      !parent ||
      parent.createdBy === null ||
      parent.createdBy === undefined
    ) {
      return 1;
    } else if (parent.userId == parent_id) {
      return parent.downLineShare;
    }
    currentId = parent.createdBy;
  }
}

const profitLose = async (req, res) => {
  if (!req.query.userId) {
    return res.status(404).send({
      success: false,
      message: "Something Went Wrong!",
    });
  }
  try {
    const userId = parseInt(req.query.userId);
    const currentUser = await User.findOne({ userId: userId });
    if (!currentUser) {
      return res.status(404).send({
        success: false,
        message: "Something Went Wrong!",
      });
    }
    if (currentUser.role == "5") {
      const response = await Cash.aggregate([
        {
          $match: {
            userId: userId,
            cashOrCredit: { $in: ["Bet"] },
          },
        },
        {
          $addFields: {
            betsId: { $toObjectId: "$betId" },
          },
        },
        {
          $lookup: {
            from: "markettypes",
            localField: "sportsId",
            foreignField: "Id",
            as: "marketInfo",
          },
        },
        {
          $group: {
            _id: "$sportsId",
            amount: { $sum: "$amount" },
            userId: { $first: "$userId" },
            name: { $first: { $arrayElemAt: ["$marketInfo.name", 0] } },
          },
        },
      ]);
      return res.send({
        success: true,
        message: "Profit Lose reports",
        results: response,
      });
    } else {
      const response = await Cash.aggregate([
        {
          $match: {
            userId: userId,
            cashOrCredit: { $in: ["Bet", "Commission", "loosing"] },
          },
        },
        {
          $lookup: {
            from: "markettypes",
            localField: "sportsId",
            foreignField: "Id",
            as: "marketInfo",
          },
        },
        {
          $group: {
            _id: "$sportsId",
            amount: { $sum: "$amount" },
            userId: { $first: "$userId" },
            name: { $first: { $arrayElemAt: ["$marketInfo.name", 0] } },
          },
        },
      ]);
      return res.send({
        success: true,
        message: "Profit Lose Reports",
        results: response,
      });
    }
  } catch (error) {
    console.warn("Catched", error);
    return res.status(404).send({
      success: false,
      message: "Something Went Wrong!",
    });
  }
};

const EventWiseprofitLose = async (req, res) => {
  if (!req.query.userId || !req.query.sportsId) {
    return res.status(404).send({
      success: false,
      message: "Invalid Request",
    });
  }
  try {
    const userId = parseInt(req.query.userId);
    const sportsId = req.query.sportsId;
    const currentUser = await User.findOne({ userId: userId });
    if (!currentUser) {
      return res.status(404).send({
        success: false,
        message: "Something Went Wrong!",
      });
    }
    if (currentUser.role == "5") {
      const response = await Cash.aggregate([
        {
          $match: {
            userId: userId,
            sportsId: sportsId,
            cashOrCredit: { $in: ["Bet"] },
          },
        },
        {
          $addFields: {
            betsId: { $toObjectId: "$betId" },
          },
        },
        {
          $lookup: {
            from: "bets",
            localField: "betsId",
            foreignField: "_id",
            as: "bets",
          },
        },
        {
          $group: {
            _id: { $arrayElemAt: ["$bets.matchId", 0] },
            amount: { $sum: "$amount" },
            userId: { $first: "$userId" },
            date: { $first: "$date" },
            name: { $first: { $arrayElemAt: ["$bets.event", 0] } },
          },
        },
      ]);
      return res.send({
        success: true,
        message: "Profit Lose reports",
        results: response,
      });
    } else {
      // const users       = [userId];
      // let parents       = [userId];
      // let childUsers;
      // do{
      //   childUsers     = await User.distinct("userId", {
      //     createdBy: {
      //       $in: parents
      //     }
      //   });
      //   if(childUsers.length) users.push(...childUsers)
      //   parents = childUsers
      // }while (childUsers.length > 0)


      const response = await Cash.aggregate([
        {
          $match: {
            userId: userId,
            sportsId: sportsId,
            cashOrCredit: { $in: ["Bet", "Commission", "loosing"] },
          },
        },
        {
          $addFields: {
            betsId: { $toObjectId: "$betId" },
          },
        },
        {
          $lookup: {
            from: "bets",
            localField: "betsId",
            foreignField: "_id",
            as: "bets",
          },
        },
        {
          $group: {
            _id: { $arrayElemAt: ["$bets.matchId", 0] },
            amount: { $sum: "$amount" },
            userId: { $first: "$userId" },
            date: { $first: "$date" },
            name: { $first: { $arrayElemAt: ["$bets.event", 0] } },
          },
        },
      ]);
      return res.send({
        success: true,
        message: "Profit Lose Reports",
        results: response,
      });
    }
  } catch (error) {
    console.warn("Catched", error);
    return res.status(404).send({
      success: false,
      message: "Something Went Wrong!",
    });
  }
};

const dailyMatchWiseprofitLose = async (req, res) => {
  if (!req.query.userId || !req.query.matchId) {
    return res.status(404).send({
      success: false,
      message: "Invalid Request",
    });
  }
  try {
    const userId = parseInt(req.query.userId);
    const matchId = req.query.matchId;
    const currentUser = await User.findOne({ userId: userId });
    const parent = await User.findOne({ userId: currentUser.createdBy });
    const match = await Events.findById(matchId);
    if (currentUser.role == "5") {
      const response = await Cash.aggregate([
        {
          $match: {
            matchId: matchId,
            $or: [
              {
                $and: [
                  {
                    userId: userId,
                  },
                  {
                    cashOrCredit: { $in: ["Bet", "Commission", "loosing"] },
                  },
                ],
              },
              {
                cashOrCredit: { $in: ["Commission"] },
              },
            ],
          },
        },
        {
          $addFields: {
            betsId: { $toObjectId: "$betId" },
          },
        },
        {
          $lookup: {
            from: "bets",
            localField: "betsId",
            foreignField: "_id",
            as: "betsDetails",
          },
        },
        {
          $group: {
            _id: "$betId",
            pl: { $sum: "$amount" },
            sattledAt: { $first: "$date" },
            price: { $first: { $arrayElemAt: ["$betsDetails.betAmount", 0] } },
            name: { $first: { $arrayElemAt: ["$betsDetails.runnerName", 0] } },
            createdAt: {
              $first: { $arrayElemAt: ["$betsDetails.createdAt", 0] },
            },
            size: { $first: { $arrayElemAt: ["$betsDetails.betRate", 0] } },
            type: { $first: { $arrayElemAt: ["$betsDetails.type", 0] } },
            fancyData: {
              $first: { $arrayElemAt: ["$betsDetails.fancyData", 0] },
            },
            isfancyOrbookmaker: {
              $first: { $arrayElemAt: ["$betsDetails.isfancyOrbookmaker", 0] },
            },
          },
        },
      ]);
      return res.send({
        success: true,
        message: "Detailed reports",
        results: response,
        dealer: parent.userName,
        currentUser: currentUser.userName,
        Winner: match?.winner,
        isBattor: true,
      });
    } else {
      const response = await Cash.aggregate([
        {
          $match: {
            matchId: matchId,
            userId: userId,
            cashOrCredit: { $in: ["Bet", "Commission", "loosing"] },
          },
        },
        {
          $addFields: {
            betsId: { $toObjectId: "$betId" },
          },
        },
        {
          $lookup: {
            from: "bets",
            localField: "betsId",
            foreignField: "_id",
            as: "betsDetails",
          },
        },
        {
          $group: {
            _id: "$betId",
            pl: { $sum: "$amount" },
            sattledAt: { $first: "$date" },
            price: { $first: { $arrayElemAt: ["$betsDetails.betAmount", 0] } },
            name: { $first: { $arrayElemAt: ["$betsDetails.runnerName", 0] } },
            createdAt: {
              $first: { $arrayElemAt: ["$betsDetails.createdAt", 0] },
            },
            size: { $first: { $arrayElemAt: ["$betsDetails.betRate", 0] } },
            type: { $first: { $arrayElemAt: ["$betsDetails.type", 0] } },
          },
        },
      ]);
      return res.send({
        success: true,
        message: "Detailed reports",
        results: response,
        dealer: parent?.userName,
        currentUser: currentUser?.userName,
        Winner: match?.winner,
        isBattor: false,
      });
    }
  } catch (error) {
    console.warn("Catched", error);
    return res.status(404).send({
      success: false,
      message: "Something Went Wrong!",
    });
  }
};

const SingleUserAllBets = async (req, res) => {
  try {
    const DBNAME = process.env.DB_NAME;
    const DBHost = process.env.DBHost;
    const client = new MongoClient(`${DBHost}?directConnection=true`, { useUnifiedTopology: true });
    const deposit = client.db(`${DBNAME}`).collection("deposits");

    const result = await Bets.find({
      userId: Number(req.query.userId),
    });
    for (const bet of result) {
      const deposits = await deposit.find({ betId: bet._id, userId: Number(req.query.userId) }).toArray();
      bet.multipeResponse = deposits;
    }

    return res.send({
      status: true,
      message: "Bets List !",
      results: result,
    });

  } catch (err) {
    return res.send({
      message: `Error ${err} !`,
    });
  }
}

const GetBetsByEventId = async (req, res) => {
  try {
    const DBNAME = process.env.DB_NAME;
    const DBHost = process.env.DBHost;
    const client = new MongoClient(`${DBHost}?directConnection=true`, { useUnifiedTopology: true });
    const deposit = client.db(`${DBNAME}`).collection("deposits");

    const result = await Bets.find({
      eventId: Number(req.query.eventId),
      status: 1,
      isfancyOrbookmaker: true
    });

    return res.send({
      status: true,
      message: "Bets List !",
      results: result,
    });

  } catch (err) {
    return res.send({
      message: `Error ${err} !`,
    });
  }
}

const postmanwork_2 = async (req, res) => {

  try {
    const resp = await axios(req.body.url);
    const data = resp.data
    return res.status(200).send({ resp: data });
  } catch (err) {
    console.warn("Query error ======= :", err);
    return res
      .status(500)
      .send({ message: "Error", error: err });
  }
}
const eventsAPICalls = async (req, res) => {

  try {
    const header = {
      headers: {
        'accept': 'application/json',
        'Content-Type': 'application/json',
        'X-App': process.env.XAPP_NAME
      },
    }
    const url = req.body.url
    const requestData = req.body.requestData

    const response = await axios.post(
      url,
      requestData,
      header
    );
    const data = response.data.result;
    return res.status(200).send({ resp: data });
  } catch (err) {
    console.warn("Query error ======= :", err);
    return res
      .status(500)
      .send({ message: "Error", error: err });
  }
}
const postmanwork = async (req, res) => {

  try {
    // const dt = new Date().getTime();
    // const subTime = Number(req.body.days) * 24 * 60 * 60 * 1000;
    // const daysBefore = dt + subTime;
    // if(Number(req.body.type) === 2){
    //   const bets = await Bets.find({ createdAt:  daysBefore });
    //   for (const bet of bets){
    //     const resp = await  Cash.updateMany(
    //       {betId: bet._id},
    //       {
    //         betSession: bet.betSession,
    //         roundId: bet.roundId
    //       }
    //     )
    //   }
    // }
    // else if(Number(req.body.type) === 1){
    //   const casinocallsRecords = await CasinoCalls
    //                                     .find({}).sort({ _id : 1 })
    //                                     .skip(Number(req.body.skip))
    //                                     .limit(Number(req.body.limit));
    //   for (const casinocall of casinocallsRecords){
    //     //console.log(" ======================== casinocall data", casinocall);
    //     const resp = await Cash.updateMany(
    //       { betId: casinocall.transaction_id },
    //       {
    //         betSession: casinocall.game_id,
    //         roundId: casinocall.round_id
    //       }
    //     )
    //   }
    // }


    /**
     * to Update All records in 2 limits
     */
    if (Number(req.body.type) === 1) {
      for (let i = Number(req.body.start); i < Number(req.body.end); i = i + 50) {
        const casinocallsRecords = await CasinoCalls
          .find({}).sort({ _id: 1 })
          .skip(Number(i))
          .limit(Number(50));
        for (const casinocall of casinocallsRecords) {
          //console.log(" ======================== casinocall data", casinocall);
          const resp = await Cash.updateMany(
            { betId: casinocall.transaction_id },
            {
              // betSession: casinocall.game_id,
              roundId: casinocall.round_id
            }
          )
        }

      }
    }

    /**
     * to Update All records of a user
     *
     */
    else if (Number(req.body.type) === 2) {
      const casinocallsRecords = await CasinoCalls.find({ remote_id: Number(req.body.userId) }).sort({ _id: 1 });
      for (const casinocall of casinocallsRecords) {
        const resp = await Cash.updateMany(
          { betId: casinocall.transaction_id },
          {
            roundId: casinocall.round_id
          }
        )
      }
    }


    //console.log(" ---- postmanwork Bets completed ---- ");
    return res.send({
      status: 200,
      message: "Successed !"
    })
  } catch (err) {
    console.warn("Query error ======= :", err);
    return res.status(500).send({ message: "Error", error: err });
  }
}

loginRouter.post("/placeBet", betValidator.validate("placeBet"), placeBet);
loginRouter.post("/getUserBets", getUserBets);
loginRouter.get("/betFunds", betFunds);
loginRouter.post("/createBetRates", createBetRates);
loginRouter.get("/getBetRates/:id", getBetRates);
loginRouter.get("/getMatchedBets", getMatchedBets);
loginRouter.get("/FakeBetsList", FakeBetsList);
loginRouter.delete("/deleteFakeBet/:id", deleteFakeBet);
loginRouter.put("/updateFakeBet/:id", updateFakeBet);
loginRouter.get("/countFakeBets", countFakeBet);
loginRouter.post("/approvedFakeBet/:id", approvedFakeBet);
loginRouter.get("/reviewFakeBet/:id/:sportsId", reviewFakeBet);
loginRouter.post("/postmanwork", postmanwork);
loginRouter.post("/eventsapicalls", eventsAPICalls);

loginRouter.get("/profitLose", profitLose);
loginRouter.get("/EventWiseprofitLose", EventWiseprofitLose);
loginRouter.get("/dailyMatchWiseprofitLose", dailyMatchWiseprofitLose);

loginRouter.get("/SingleUserAllBets", SingleUserAllBets);
loginRouter.get("/GetAllBets", GetAllBets);
loginRouter.get("/casino-bets", CasinoList);
loginRouter.get("/GetBetsByEventId", GetBetsByEventId);
module.exports = { sessionCalc, loginRouter, getParents, activeBettors };

// const newRunners = [];
// const uniqueVals = newRecords.map((item)=>{
//     const index = AllRunners.findIndex((e)=> e.runner == item.runner );
//     if(index == -1) newRunners.push(item)
// })