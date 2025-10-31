const express = require("express");
const { validationResult } = require("express-validator");
const CashDeposit = require("../models/deposits");
const User = require("../models/user");
let mongoose = require('mongoose');
const Bets = require("../models/bets");
const MarketIDS = require("../models/marketIds");
const AsianResult = require("../models/asianTablesResultsHistory")
const CasinoCalls = require("../models/casinoCalls")
const loginRouter = express.Router();

const marketGainWithDuplicates = async (req, res) => {
  const errors = validationResult(req);
  if (errors.errors.length !== 0) {
    return res.status(400).send({ errors: errors.errors });
  }
  const userId = req.query.userId;
  const marketId = req.query.marketId;
  const sportsId = req.query.sportsId;
  const betSession = req.query.betSession == "null" ? null : req.query.betSession;
  const depositId = mongoose.Types.ObjectId(req.query.depositId);
  const roundId = req.query.roundId == "null" ? null : req.query.roundId;
  const matchId = req.query.matchId;
  let asianWinner = ''

  // const condition = { marketId: marketId }
  // "" + marketId == "null" ? [{ sportsId: "6" }, { sportID: 6 }] : { marketId: marketId };

  const currentUser = await User.findOne({ userId: userId });
  let depositRes;

  if (currentUser?.role == 5) {
    const marketData = await MarketIDS.findOne({ 
      $or: [
        { marketId: marketId },
        { marketName: marketId },
      ]
    });

    const parent = await User.findOne({ userId: currentUser.createdBy });

    if (marketId) {
      if (sportsId == "6") {
        depositRes = await CashDeposit.find({
          marketId: marketId,
          userId: Number(userId),
          roundId: roundId,
          $or: [
            {
              cashOrCredit: { $in: ["Bet"] },
            },
            {
              cashOrCredit: { $in: ["Commission"] },
            },
          ],
        });
      } else {
        depositRes = await CashDeposit.find({
          marketId: marketId,
          userId: Number(userId),
          betSession: betSession,
          roundId: roundId,
          matchId: matchId,
          $or: [
            {
              cashOrCredit: { $in: ["Bet"] },
            },
            {
              cashOrCredit: { $in: ["Commission"] },
            },
          ],
        });
      }
    } else {
      depositRes = await CashDeposit.find({
        _id: depositId
      });
    }

    if (!depositRes)
      return res.status(404).send({ message: "Cannot find desposit" });

    let response = {}
 
    let depositInfo = [];

    for (let k = 0; k < depositRes?.length; k ++) {
      let tempdepositInfo;
      let betInfo
      if (sportsId == "6") { 
        betInfo = await CasinoCalls.findOne({
          transaction_id: depositRes[k]?.betId
        });
      } else {
        betInfo = await Bets.findOne({
          _id: depositRes[k]?.betId
        });
      }
      
      tempdepositInfo = {
        _id: depositRes[k]?.betId,
        pl: depositRes[k]?.amount,
        sattledAt: depositRes[k]?.date,
        sportsId: depositRes[k]?.sportsId,
        createdAt: depositRes[k]?.createdAt,
      }
  
      if (depositRes[k]?.sportsId == "6"){
        tempdepositInfo.Commission = depositRes[k]?.amount > 0 ? depositRes[k]?.amount * 0.02 : 0;
        tempdepositInfo.netPl = depositRes[k]?.amount > 0 ? depositRes[k]?.amount *  ( 100/98 ) : depositRes[k]?.amount;
        tempdepositInfo.result = depositRes[k]?.amount > 0 ? "WON" : "LOSS";
        tempdepositInfo.runnerName = betInfo?.username;
        tempdepositInfo.price = null;
        tempdepositInfo.size = null;
        tempdepositInfo.type = betInfo?.type;
      } else {
        tempdepositInfo.runnerName = betInfo?.runnerName;
        tempdepositInfo.price = betInfo?.betAmount;
        tempdepositInfo.size = betInfo?.betRate;
        tempdepositInfo.type = betInfo?.type;
      }

      depositInfo.push(tempdepositInfo)
    }

    response.depositInfo = depositInfo

    let totalDespoitInfo = {}

    if (depositRes) {
      let tempTotalPL = 0;
      for (let k = 0; k < depositRes?.length; k ++) {
        tempTotalPL += depositRes[k]?.amount;
      }

      totalDespoitInfo = {
        _id: depositRes[0]?.betId,
        totalPL: tempTotalPL,
        sattledAt: depositRes[0]?.date,
        sportsId: depositRes[0]?.sportsId,
        createdAt: depositRes[0]?.createdAt
      }
    }

    if (marketId != "none" && depositRes[0]?.sportsId != "6" && depositRes[0]?.sportsId != "8") {
      const betRes = await Bets.find({ userId: userId, marketId: marketId });


      let betsInfo = []
      for (let k = 0; k < betRes?.length; k++) {
        if (!marketData?.winnerInfo){
          const resultInfo = await AsianResult.findOne({ roundId: betRes[k]?.roundId })
          if (resultInfo?.tableId == "teen20"){
            if (resultInfo?.result[0]?.win == "1") {
              asianWinner = "Player A Cards"
            } else {
              asianWinner = "Player B Cards"
            }
          } else if (resultInfo?.tableId == "lucky7eu"){
              asianWinner = "Card " + " " + resultInfo?.result[0]?.cards[0]
          } else if (resultInfo?.tableId == "aaa"){
            asianWinner = "Card " + " " + resultInfo?.result[0]?.cards[0]
          } else if (resultInfo?.tableId == "card32eu"){
            const generalResult = resultInfo?.result[0]?.desc.split("|");
            asianWinner = generalResult[0]
          } 
        }

        if (marketId == "9" || marketId == "34" || marketId == "34" ) {
          asianWinner = betRes[k]?.SessionScore
        }
        const Winner = marketData?.winnerInfo ? marketData?.winnerInfo : asianWinner;

        let tempBet = {
          price: betRes[k].betAmount,
          name: betRes[k].runnerName,
          createdAt: betRes[k].createdAt,
          size: betRes[k].betRate,
          type: betRes[k].type,
          isfancyOrbookmaker: betRes[k].isfancyOrbookmaker,
          fancyData: betRes[k].fancyData,
          matchType: betRes[k]?.matchType,
          SessionScore: betRes[k]?.SessionScore,
          winnerRunnerData: betRes[k]?.winnerRunnerData,
          resultData: betRes[k]?.resultData,
          roundId: betRes[k]?.roundId, 
          winner: Winner  
        }
        betsInfo.push(tempBet)
      }
      response.betsInfo = betsInfo 

    } else if (depositRes[0]?.sportsId == "6" || depositRes[0]?.sportsId == "8") {
      const betRes = await Bets.find({ userId: userId, roundId: roundId });

      let betsInfo = []
      for (let k = 0; k < betRes?.length; k++) {
        if (!marketData?.winnerInfo){
          const resultInfo = await AsianResult.findOne({ roundId: betRes[k]?.roundId })
          if (resultInfo?.tableId == "teen20"){
            if (resultInfo?.result[0]?.win == "1") {
              asianWinner = "Player A Cards"
            } else {
              asianWinner = "Player B Cards"
            }
          } else if (resultInfo?.tableId == "lucky7eu"){
              asianWinner = "Card " + " " + resultInfo?.result[0]?.cards[0]
          } else if (resultInfo?.tableId == "aaa"){
            asianWinner = "Card " + " " + resultInfo?.result[0]?.cards[0]
          } else if (resultInfo?.tableId == "card32eu"){
            const generalResult = resultInfo?.result[0]?.desc.split("|");
            asianWinner = generalResult[0]
          } 
        }
        const Winner = marketData?.winnerInfo ? marketData?.winnerInfo : asianWinner;

        let tempBet = {
          price: betRes[k].betAmount,
          name: betRes[k].runnerName,
          createdAt: betRes[k].createdAt,
          size: betRes[k].betRate,
          type: betRes[k].type,
          isfancyOrbookmaker: betRes[k].isfancyOrbookmaker,
          fancyData: betRes[k].fancyData,
          matchType: betRes[k]?.matchType,
          SessionScore: betRes[k]?.SessionScore,
          winnerRunnerData: betRes[k]?.winnerRunnerData,
          resultData: betRes[k]?.resultData,
          roundId: betRes[k]?.roundId, 
          winner: Winner  
        }
        betsInfo.push(tempBet)
      }
      response.betsInfo = betsInfo 
    }

    response.totalDespoitInfo = totalDespoitInfo

    return res.send({
      success: true,
      message: "Market Shares Reports by MarketId",
      results: response,
      isDetailed: true,
      dealer: parent.userName,
      currentUser: currentUser.userName,
      Winner: marketData?.winnerInfo ? marketData?.winnerInfo : asianWinner,
    });

  } else {
    const childUsers = await User.distinct("userId", { createdBy: userId });
    const users = [userId, ...childUsers];
    //console.log(" users ===================  ", users);

    const response = await CashDeposit.aggregate([
      {
        $match: {
          userId: {
            $in: users,
          },
          ...condition[0],
          cashOrCredit: { $in: ["Bet", "Commission", "loosing"] },
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "userId",
          as: "userInfo",
        },
      },
      {
        $group: {
          _id: "$userId",
          amount: { $sum: "$amount" },
          name: { $first: { $arrayElemAt: ["$userInfo.userName", 0] } },
        },
      },
    ]);

    return res.send({
      success: true,
      message: "Commission reports",
      results: response,
    });
  }
};

const marketGainWithDuplicates2 = async (req, res) => {
  const errors = validationResult(req);
  if (errors.errors.length !== 0) {
    return res.status(400).send({ errors: errors.errors });
  }
  const userId = Number(req.query.userId);
  const marketId = req.query.marketId;
  const depositId = mongoose.Types.ObjectId(req.query.depositId);
  const roundId = req.query.roundId;
  //console.log(roundId, userId, marketId, depositId)
  let asianWinner = ''

  // const condition = { marketId: marketId }
  // "" + marketId == "null" ? [{ sportsId: "6" }, { sportID: 6 }] : { marketId: marketId };

  const currentUser = await User.findOne({ userId: userId });
  let depositRes;

  if (currentUser?.role == 5) {
    const marketData = await MarketIDS.findOne({ marketId: marketId });

    const parent = await User.findOne({ userId: currentUser.createdBy });

    if (marketId != "none") {

      depositRes = await CashDeposit.findOne({
        marketId: marketId,
        // betId: betId,
        _id: depositId,
        $or: [
          {
            $and: [
              {
                userId: userId,
              },
              {
                cashOrCredit: { $in: ["Bet"] },
              },
            ],
          },
          {
            cashOrCredit: { $in: ["Commission"] },
          },
        ],
      });
    } else {
      depositRes = await CashDeposit.findOne({
        _id: depositId
      });
    }

    if (!depositRes)
      return res.status(404).send({ message: "Cannot find desposit" });

    let response = {}

    let depositInfo = {
      _id: depositRes.betId,
      pl: depositRes.amount,
      sattledAt: depositRes.date,
      sportsId: depositRes.sportsId,
    }

    if (depositRes.sportsId == "6"){
      depositInfo.Commission = depositRes?.amount > 0 ? depositRes?.amount * 0.02 : 0;
      depositInfo.netPl = depositRes?.amount > 0 ? depositRes?.amount *  ( 100/98 ) : depositRes?.amount;
      depositInfo.result = depositRes?.amount > 0 ? "WON" : "LOSS";
    }

    response.depositInfo = depositInfo
    //console.log("11111111111111", depositRes.sportsId == "8", ":", roundId)

    if (marketId != "none" && depositRes.sportsId != "6" && depositRes.sportsId != "8") {
      const betRes = await Bets.find({ userId: userId, marketId: marketId });

      let betsInfo = []
      for (let k = 0; k < betRes?.length; k++) {
        if (!marketData?.winnerInfo){
          const resultInfo = await AsianResult.findOne({ roundId: betRes[k]?.roundId })
          if (resultInfo?.tableId == "teen20"){
            if (resultInfo?.result[0]?.win == "1") {
              asianWinner = "Player A Cards"
            } else {
              asianWinner = "Player B Cards"
            }
          } else if (resultInfo?.tableId == "lucky7eu"){
              asianWinner = "Card " + " " + resultInfo?.result[0]?.cards[0]
          } else if (resultInfo?.tableId == "aaa"){
            asianWinner = "Card " + " " + resultInfo?.result[0]?.cards[0]
          } else if (resultInfo?.tableId == "card32eu"){
            const generalResult = resultInfo?.result[0]?.desc.split("|");
            asianWinner = generalResult[0]
          } 
        }
        const Winner = marketData?.winnerInfo ? marketData?.winnerInfo : asianWinner;

        let tempBet = {
          price: betRes[k].betAmount,
          name: betRes[k].runnerName,
          createdAt: betRes[k].createdAt,
          size: betRes[k].betRate,
          type: betRes[k].type,
          isfancyOrbookmaker: betRes[k].isfancyOrbookmaker,
          fancyData: betRes[k].fancyData,
          matchType: betRes[k]?.matchType,
          SessionScore: betRes[k]?.SessionScore,
          winnerRunnerData: betRes[k]?.winnerRunnerData,
          resultData: betRes[k]?.resultData,
          roundId: betRes[k]?.roundId, 
          winner: Winner  
        }
        betsInfo.push(tempBet)
      }
      response.betsInfo = betsInfo 
    } else if (depositRes.sportsId == "6" || depositRes.sportsId == "8") {
      const betRes = await Bets.find({ userId: userId, roundId: roundId });

      let betsInfo = []
      for (let k = 0; k < betRes?.length; k++) {
        if (!marketData?.winnerInfo){
          const resultInfo = await AsianResult.findOne({ roundId: betRes[k]?.roundId })
          if (resultInfo?.tableId == "teen20"){
            if (resultInfo?.result[0]?.win == "1") {
              asianWinner = "Player A Cards"
            } else {
              asianWinner = "Player B Cards"
            }
          } else if (resultInfo?.tableId == "lucky7eu"){
              asianWinner = "Card " + " " + resultInfo?.result[0]?.cards[0]
          } else if (resultInfo?.tableId == "aaa"){
            asianWinner = "Card " + " " + resultInfo?.result[0]?.cards[0]
          } else if (resultInfo?.tableId == "card32eu"){
            const generalResult = resultInfo?.result[0]?.desc.split("|");
            asianWinner = generalResult[0]
          } 
        }
        const Winner = marketData?.winnerInfo ? marketData?.winnerInfo : asianWinner;

        let tempBet = {
          price: betRes[k].betAmount,
          name: betRes[k].runnerName,
          createdAt: betRes[k].createdAt,
          size: betRes[k].betRate,
          type: betRes[k].type,
          isfancyOrbookmaker: betRes[k].isfancyOrbookmaker,
          fancyData: betRes[k].fancyData,
          matchType: betRes[k]?.matchType,
          SessionScore: betRes[k]?.SessionScore,
          winnerRunnerData: betRes[k]?.winnerRunnerData,
          resultData: betRes[k]?.resultData,
          roundId: betRes[k]?.roundId, 
          winner: Winner  
        }
        betsInfo.push(tempBet)
      }
      response.betsInfo = betsInfo 
    }

    return res.send({
      success: true,
      message: "Market Shares Reports by MarketId",
      results: response,
      isDetailed: true,
      dealer: parent.userName,
      currentUser: currentUser.userName,
      Winner: marketData?.winnerInfo ? marketData?.winnerInfo : asianWinner,
    });

  } else {
    const childUsers = await User.distinct("userId", { createdBy: userId });
    const users = [userId, ...childUsers];
    //console.log(" users ===================  ", users);

    const response = await CashDeposit.aggregate([
      {
        $match: {
          userId: {
            $in: users,
          },
          ...condition[0],
          cashOrCredit: { $in: ["Bet", "Commission", "loosing"] },
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "userId",
          as: "userInfo",
        },
      },
      {
        $group: {
          _id: "$userId",
          amount: { $sum: "$amount" },
          name: { $first: { $arrayElemAt: ["$userInfo.userName", 0] } },
        },
      },
    ]);

    return res.send({
      success: true,
      message: "Commission reports",
      results: response,
    });
  }
};


loginRouter.get("/marketShares", marketGainWithDuplicates);
loginRouter.get("/marketShares2", marketGainWithDuplicates2);
module.exports = { loginRouter };
