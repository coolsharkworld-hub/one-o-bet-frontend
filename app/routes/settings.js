const express = require("express");
const { validationResult } = require("express-validator");
const Settings = require("../models/settings");
const CasinoCalls = require("../models/casinoCalls");
const moment = require("moment");
const User = require("../models/user");
const settingsValidation = require("../validators/settings");
const PrivacyPolicy = require("../models/privacyPolicy");
const Competition = require("../models/listCompetitions");
const Odds = require("../models/odds");
const Exchanges = require("../models/exchanges");
const MaxBetSize = require("../models/betLimits");
const SideBarMenu = require("../models/sidebarMenu");
const Events = require("../models/events");
const EventBySports = require("../models/eventsBySport");
const config = require("config");
const axios = require("axios");
const FancyGames = require("../models/fancyGames");
const RaceMarkets = require("../models/raceMarkets");
const RaceOdds = require("../models/raceOdds");
const loginRouter = express.Router();
const router = express.Router();
const Session = require("../models/Session");
const MarketIDS = require("../models/marketIds");
const Bets = require("../models/bets");
const BetPlaceHold = require("../models/betaPlaceHold");
const AsianTable = require("../models/asianTable");
const mongoose = require("mongoose");
const {
  handleDrawBet,
} = require("../../resultSystem/src/CalculateBets/calculations");

const loginRecord = require("../models/loginRecord");

// process.env.TZ = 'UTC';

const SelectedCasino = require("../models/selectedCasino");
const { rollbackCasino, creditCasino } = require("../../helper/casino/casinoHelper");

function updateDefaultTheme(req, res) {
  const errors = validationResult(req);
  if (errors.errors.length !== 0) {
    return res.status(400).send({ errors: errors.errors });
  }
  if (req.decoded.role !== "0") {
    return res
      .status(404)
      .send({ message: "only company can add default theme" });
  }
  Settings.findOneAndUpdate(
    { _id: req.body._id },
    { $set: { defaultThemeName: req.body.defaultThemeName } },
    { new: true },
    (err, theme) => {
      if (err || !theme) {
        return res.status(404).send({ message: "theme not found" });
      }

      return res.send({
        success: true,
        message: "Theme updated successfully",
        results: theme,
      });
    }
  );
}

function updateDefaultLoginPage(req, res) {
  const errors = validationResult(req);
  if (errors.errors.length !== 0) {
    return res.status(400).send({ errors: errors.errors });
  }
  if (req.decoded.role !== "0") {
    return res
      .status(404)
      .send({ message: "only company can add default login page" });
  }

  Settings.findOneAndUpdate(
    { _id: req.body._id },
    { $set: { defaultLoginPage: req.body.defaultLoginPage } },
    { new: true },
    (err, loginPage) => {
      if (err || !loginPage) {
        return res.status(404).send({ message: "loginPage not found" });
      }

      return res.send({
        success: true,
        message: "Default Login Page added successfully",
        results: loginPage,
      });
    }
  );
}

function updateDefaultExchange(req, res) {
  const errors = validationResult(req);
  if (errors.errors.length !== 0) {
    return res.status(400).send({ errors: errors.errors });
  }
  if (req.decoded.role !== "0") {
    return res
      .status(404)
      .send({ message: "only company can add default exchange rate" });
  }

  const exchangeRates = req.body.exchangeRates;

  const updatedExchangeRates = exchangeRates.map((exchangeRates) => ({
    updateOne: {
      filter: { _id: exchangeRates._id },
      update: {
        $set: {
          currency: exchangeRates.currency,
          exchangeAmount: exchangeRates.exchangeAmount,
        },
      },
      upsert: false,
    },
  }));

  Exchanges.bulkWrite(
    updatedExchangeRates,
    { ordered: false },
    (err, exchanges) => {
      if (err || !exchanges) {
        return res.status(404).send({ message: "exchanges not found" });
      }
      return res.send({
        success: true,
        message: "Exchange Rate updated successfully",
      });
    }
  );
}

function GetExchangeRates(req, res) {
  Exchanges.find({}, (err, success) => {
    if (err || !success)
      return res.status(404).send({ message: "Record Not Found" });
    return res.send({
      success: true,
      message: "Exchange Rates Record Found",
      results: success,
    });
  });
}

function updateDefaultBetSizes(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  if (req.decoded.role !== "0") {
    return res
      .status(404)
      .json({ message: "Only company can add default bet sizes" });
  }

  const { betLimits } = req.body;

  const updatePromises = betLimits.map((betLimit) => {
    return MaxBetSize.findOneAndUpdate(
      { _id: betLimit._id },
      {
        $set: {
          maxAmount: betLimit.maxAmount,
          minAmount: betLimit.minAmount,
          ExpAmount: betLimit.ExpAmount
        }
      },
      { new: true, upsert: true }
    );
  });

  Promise.all(updatePromises)
    .then((updatedBetLimits) => {
      return res.json({
        success: true,
        message: "Max bet sizes updated successfully",
        results: updatedBetLimits,
      });
    })
    .catch((err) => {
      //console.log("err", err);
      return res.status(500).json({ message: "Server error" });
    });
}

function getDefaultBetSizes(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  if (req.decoded.role !== "0") {
    return res.status(404).json({ message: "Unauthrized" });
  }
  MaxBetSize.find({}, (err, results) => {
    if (err) {
      return res.status(404).json({ message: "bet sizes not found" });
    }
    return res.json({
      success: true,
      message: "Max bet sizes Found successfully ",
      results: results,
    });
  });
}

function getDefaultSettings(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  Settings.find({}, (err, results) => {
    if (err) {
      return res.status(404).json({ message: "settings not found" });
    }
    return res.json({
      success: true,
      message: "Setting Data Found successfully",
      results: results,
    });
  });
}

async function updateMatchType(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).send({ errors: errors.errors });
  }
  try {
    const { _id, matchType, iconStatus, eventId } = req.body;

    //coded by qaiser started on event with bet delayed time
    /*//console.log(
      "I am here with event Id---------------------------------:",
      eventId
    );*/

    const BetSecondsVal = await BetPlaceHold.findOne({
      eventId: eventId,
    }).exec();

    if (!BetSecondsVal) {
      const betseconds = new BetPlaceHold({
        sportsId: 6,
        secondsValue: 4,
        eventId: eventId,
      });
      betseconds.save();
    }

    const updatedData = await Events.findByIdAndUpdate(
      _id,
      { $set: { matchType: matchType, iconStatus: iconStatus } },
      (err, updatedMatch) => {
        if (err) {
          //console.log("Error updating figure:", err);
        } else {
          //console.log("Updated match:", updatedMatch);
        }
      }
    )
      .clone()
      .catch(function (err) {
        //console.log(err);
      });
    //console.log(updatedData);

    res.status(200).json({
      success: true,
      message: "Updated Successfully",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Failed to save fancy data4",
      error: error.message,
    });
  }
}

async function getSideBarMenu(req, res) {
  let type = [];
  if (req.decoded.role == 5) {
    type = [0];
  } else if (req.decoded.role == 0) {
    type = [1, 2];
  } else {
    type = [1];
  }
  const results = await SideBarMenu.find({ type: { $in: type } }).sort({sort_by: 1})
  return res.json({
    success: true,
    message: "Side Bar Menu Records",
    results: results,
  });
}

async function listCompetitions(req, res) {
  const sportId = req.params.id;

  try {
    const competitions = await Competition.find({ sportsId: sportId });

    res.status(200).json({
      success: true,
      message: "Records",
      results: competitions,
    });
  } catch (error) {
    console.error(error);
    res.status(200).json({
      success: false,
      message: "Failed to get competitions",
      error: error.message,
    });
  }
}

async function listEventsBySport(req, res) {
  const sportId = req.query.id;
  try {
    let events
    let start
    let end
    const now = new Date();

    if (sportId == "4" || sportId == "2" || sportId == "1") {
      start = new Date().getTime();
      end = new Date().getTime() + 24 * 60 * 60 * 1000;
    } else if (sportId == "7" || sportId == "4339") {
      let startOfDay = new Date(now);
      start = startOfDay.getTime() - 30 * 60 * 1000;

      let endOfDay = new Date(now);
      end = endOfDay.getTime() + 23.5 * 60 * 60 * 1000
    }

    if (sportId == "4") {
      events = await Events.find({
        sportsId: sportId,
        iconStatus: true,
        status: "OPEN",

        isShowed: true,
      }).sort({ openDate: 1 });
    } else {
      if (sportId == "1" || sportId == "2") {
        events = await Events.find({
          sportsId: sportId,
          status: "OPEN",

          isShowed: true,
        }).sort({ openDate: 1 });
      } else if (sportId == "7" || sportId == "4339") {
        events = await MarketIDS.aggregate([
          {
            $match: {
              sportID: Number(sportId),
              // CompanySetStatus: "OPEN",
              $and: [
                { openDate: { $gte: start } },
                { openDate: { $lte: end } }
              ]
            },
          },
          {
            $lookup: {
              from: "inplayevents",
              localField: "eventId",
              foreignField: "Id",
              as: "event",
            },
          },
          {
            $addFields: {
              event: {
                $cond: {
                  if: {
                    $eq: [{ $type: "$event" }, "array"]
                  },
                  then: { $arrayElemAt: ["$event", 0] },
                  else: "$event"
                }
              }
            }
          },
          {
            $match: {
              "event.CompanySetStatus": "OPEN",
              "event.status": "OPEN",
            }
          },
          {
            $group: {
              _id: "$_id",
              Id: { $first: "$eventId" },
              marketIds: { $push: "$marketId" },
              sportsId: { $first: "$sportID" },
              openDate: { $first: "$openDate" },
              openDate2: { $first: "$event.openDate" },
              status: { $first: "$status" },
              inPlay: { $first: "$inPlay" },
              countryCode: { $first: "$event.countryCode" },
              venue: { $first: "$event.venue" },
              inplay2: { $first: "$event.inplay" },
              matchId: { $first: "$event._id" },
            }
          },
          {
            $sort: {
              openDate: 1
            }
          }
        ])

        // events = await Events.find({
        //   sportsId: sportId,
        //   status: "OPEN",
        //   openDate: { $gte: startOfDay, $lt: endOfDay }
        // }).sort({ openDate: 1 });
      } else {
        events = await Events.find({
          sportsId: sportId,
          $or: [{ status: "OPEN" }, { status: "SUSPENDED" }, { winner: 0 }],
        }).sort({ openDate: 1 });
      }
    }
    res.status(200).json({
      success: true,
      message: "Event By Sports Records",
      results: events,
    });
  } catch (error) {
    console.error(error);
    res.status(200).json({
      success: false,
      message: "Failed to get events",
      error: error.message,
    });
  }
}

async function listEventsByCompetition(req, res) {
  const { sportsId, competitionId } = req.params;
  try {
    const events = await EventBySports.find({
      sportsId: sportsId,
      competitionId: competitionId,
      type: "eventsByCompetitions",
    });

    res.status(200).json({
      success: true,
      message: "Event By Competitions Records",
      results: events,
    });
  } catch (error) {
    console.error(error);
    res.status(200).json({
      success: false,
      message: "Failed to get events",
      error: error.message,
    });
  }
}

async function listInplayEvents(req, res) {
  const sportsId = req.query.ids.split(",");
  try {
    const inplayEvents = await Events.find({ sportsId: { $in: sportsId } });

    res.status(200).json({
      success: true,
      message: "Records",
      results: inplayEvents,
    });
  } catch (error) {
    console.error(error);
    res.status(200).json({
      success: false,
      message: "Failed to get inplay events",
      error: error.message,
    });
  }
}

async function listOddsAPI(req, res) {
  try {
    const eventIds = req.query.ids;
    // const odds = await Odds.find({ eventId: { $in: eventIds } });
    const odds = await Odds.aggregate([
      { $match: { eventId: eventIds } },
      { $sort: { createdAt: -1 } },
      { $group: { _id: "$marketName", odds: { $first: "$$ROOT" } } },
      { $replaceRoot: { newRoot: "$odds" } },
    ]).exec();
    // const url = `${config.liveTvUrl}/get_live_tv_url/${eventIds}`;
    // const liveTVResponse = await axios.get(url);
    // const liveTVData = liveTVResponse.data;
    const fancyData = await FancyGames.findOne({
      eventId: { $in: eventIds },
    }).sort({ createdAt: -1 });

    //console.log("fancyData", fancyData);

    let livesportscoreData = {};

    const event = await Events.findOne(
      { Id: eventIds },
      {
        _id: 0,
        matchType: 1,
        sportsId: 1,
        name: 1,
        openDate: 1,
        status: 1,
        inplay: 1,
      }
    );
    const type = event ? event.sportsId : null;
    if (type == 4) {
      livesportscoreData = await cricketLiveScore(eventIds);
    } else {
      livesportscoreData = await otherLiveScore(eventIds);
    }
    // //console.log('liveTVResponse', liveTVResponse);
    return res.json({
      success: true,
      message: "Records",
      results: {
        odds,
        fancyData: fancyData ? [fancyData] : [],
        livesportscoreData,
        matchData: event,
      },
    });
  } catch (error) {
    console.error("Error retrieving odds:", error);
    return res.status(500).json({
      success: false,
      message: "Error retrieving odds",
    });
  }
}

//for only backend
function addSideBarMenu(req, res) {
  const errors = validationResult(req);
  if (errors.errors.length !== 0) {
    return res.status(400).send({ errors: errors.errors });
  }
  if (req.decoded.role !== "0") {
    return res.status(404).send({ message: "you are not authorized" });
  }
  const menu = new SideBarMenu(req.body);
  menu.save((err, results) => {
    if (err)
      return res.status(404).send({ message: "side bar menu not saved" });
    return res.send({ message: "menu record saved", results });
  });
}

async function racesAPI(req, res) {
  try {
    const id = req.params.id;
    const racesData = await Events.find(
      { sportsId: id },
      {
        meetingId: 1,
        countryCode: 1,
        countryCodes: 1,
        eventTypeId: 1,
        races: 1,
        venue: 1,
        sportsId: 1,
      }
    );

    return res.json({
      success: true,
      message: "Records",
      results: racesData,
    });
  } catch (err) {
    console.error(err);
    return res.json({
      success: false,
      message: "error",
    });
  }
}

async function cricketLiveScore(id) {
  try {
    const apiResponse = await axios.get(
      `https://livesportscore.xyz:3440/api/bf_scores/${id}`
    );
    const data = apiResponse.data;
    const response = {};
    if (typeof data[0] == "string") {
      const event = await Events.findOne(
        { Id: id },
        { _id: 0, matchType: 1, sportsId: 1 }
      );
      const type = event ? event.matchType : null;
      const scoreInfo = JSON.parse(data).score;
      let score = scoreInfo.score1;
      let played = scoreInfo.score2;
      response.spnnation1 = scoreInfo.spnnation1;
      response.spnnation2 = scoreInfo.spnnation2;

      if (scoreInfo.activenation1 == 1) {
        response.team = scoreInfo.spnnation1;
        response.crr = scoreInfo.spnrunrate1
          .substring(scoreInfo.spnrunrate1.indexOf(" ") + 1)
          .trim();
      } else if (scoreInfo.activenation2 == 1) {
        response.team = scoreInfo.spnnation2;
        response.crr = scoreInfo.spnrunrate2
          .substring(scoreInfo.spnrunrate2.indexOf(" ") + 1)
          .trim();
        score = scoreInfo.score2;
        played = scoreInfo.score1;
      }

      response.type = type;
      response.balls = scoreInfo.balls;

      if (type == "TEST") {
        score = score.split("&");
        score = score[score.length - 1].trim();
        played = played.split("&");
        played = played[played.length - 1].trim();
      }
      played = played
        .replaceAll(/[\s-]/g, ",")
        .replaceAll(/[())]/g, "")
        .split(",");
      played = played.filter((element) => element != 0).length;
      if (played > 0) {
        response.secondInnings = 1;
        response.spnmessage = scoreInfo.spnmessage;

        if (scoreInfo.activenation2 == 1) {
          target = scoreInfo.score1 ? scoreInfo.score1 : "";
        } else if (scoreInfo.activenation1 == 1) {
          target = scoreInfo.score2 ? scoreInfo.score2 : "";
        }

        response.target = (
          parseInt(
            target
              .replaceAll(/[\s-]/g, ",")
              .replaceAll(/[())]/g, "")
              .split(",")[0]
          ) + 1
        ).toString();
        if (scoreInfo.spnreqrate1 != null && scoreInfo.spnreqrate1 != "") {
          response.rrr = scoreInfo.spnreqrate;
        } else if (
          scoreInfo.spnreqrate2 != null &&
          scoreInfo.spnreqrate2 != ""
        ) {
          response.rrr = scoreInfo.spnreqrate2;
        }
      }
      [response.score, response.wickets, response.overs] = score
        .replaceAll(/[\s-]/g, ",")
        .replaceAll(/[())]/g, "")
        .split(",");
      return response;
    } else {
      return data[0];
    }
  } catch (error) {
    console.error(error);
    return {
      success: false,
      message: "Failed to get data",
      error: error.message,
    };
  }
}

async function otherLiveScore(id) {
  try {
    const apiResponse = await axios.get(
      `https://livesportscore.xyz:3440/api/bf_scores/${id}`
    );
    const data = apiResponse.data;
    if (typeof data[0] == "string") {
      // const event = await Events.findOne({ Id: id }, { _id: 0, matchType: 1, sportsId: 1 });
      return JSON.parse(data);
    } else {
      return data[0];
    }
  } catch (error) {
    console.error(error);
    return {
      success: false,
      message: "Failed to get data",
      error: error.message,
    };
  }
}

async function racesMarketList(req, res) {
  try {
    const projectionRacesMarketsData = {
      "eventNodes.marketNodes.state": 1,
      "eventNodes.marketNodes.description.marketName": 1,
      "eventNodes.marketNodes.description.marketTime": 1,
      "eventNodes.marketNodes.description.suspendTime": 1,
      "eventNodes.marketNodes.description.turnInPlayEnabled": 1,
      "eventNodes.marketNodes.description.marketType": 1,
      "eventNodes.marketNodes.description.raceNumber": 1,
      "eventNodes.marketNodes.description.raceType": 1,
      "eventNodes.marketNodes.description.bettingType": 1,
      "eventNodes.marketNodes.runners.selectionId": 1,
      "eventNodes.marketNodes.runners.description.runnerName": 1,
      "eventNodes.marketNodes.runners.description.metadata.SIRE_NAME": 1,
      "eventNodes.marketNodes.runners.description.metadata.CLOTH_NUMBER_ALPHA": 1,
      "eventNodes.marketNodes.runners.description.metadata.COLOURS_DESCRIPTION": 1,
      'eventNodes.marketNodes.runners.description.metadata."COLOURS_FILENAME': 1,
      "eventNodes.marketNodes.runners.description.metadata.OWNER_NAME": 1,
      "eventNodes.marketNodes.runners.description.metadata.JOCKEY_NAME": 1,
      "eventNodes.marketNodes.runners.description.metadata.CLOTH_NUMBER": 1,
      "eventNodes.marketNodes.runners.description.metadata.TRAINER_NAME": 1,
      "eventNodes.event.eventName": 1,
    };

    const projectionRaceOddsData = {
      marketId: 1,
      isMarketDataDelayed: 1,
      "state.betDelay": 1,
      "state.startTime": 1,
      "state.remainingTime": 1,
      "state.complete": 1,
      "state.inplay": 1,
      "state.numberOfWinners": 1,
      "state.numberOfRunners": 1,
      "state.numberOfActiveRunners": 1,
      "state.lastMatchTime": 1,
      "state.totalMatched": 1,
      "state.totalAvailable": 1,
      "state.status": 1,
      "runners.selectionId": 1,
      "runners.state.lastPriceTraded": 1,
      "runners.state.totalMatched": 1,
      "runners.state.lastPriceTraded": 1,
      "runners.state.status": 1,
      "runners.exchange": 1,

      // Add any other fields you want to exclude from raceOddsData
    };
    const racesMarketsData = await RaceMarkets.findOne({
      "eventNodes.marketNodes.marketId": req.params.marketId,
    });
    const raceOddsData = await RaceOdds.findOne(
      { marketId: req.params.marketId },
      projectionRaceOddsData
    ).sort({ _id: -1 });
    //console.log("racesMarketsData ==>", racesMarketsData);
    //console.log("raceOddsData ==>", raceOddsData);
    if (
      raceOddsData?.runners &&
      Array.isArray(raceOddsData?.runners) &&
      racesMarketsData?.eventNodes &&
      Array.isArray(racesMarketsData?.eventNodes)
    ) {
      const marketNode = racesMarketsData?.eventNodes?.find(
        (eventNode) =>
          eventNode?.marketNodes?.marketId === raceOddsData.marketId
      );
      if (
        marketNode &&
        marketNode?.marketNodes?.runners &&
        Array.isArray(marketNode?.marketNodes?.runners)
      ) {
        const mergedRunners = {};
        raceOddsData?.runners.forEach((runner) => {
          const matchingRunner = marketNode?.marketNodes?.runners.find(
            (r) => r.selectionId === runner?.selectionId
          );
          if (matchingRunner) {
            mergedRunners[runner?.selectionId] = {
              ...runner,
              ...matchingRunner,
            };
          }
        });
        // Update the merged runners data into the raceOddsData object
        raceOddsData.runners = Object.values(mergedRunners);
      } else {
        console.error("Invalid data structure. Market runners data not found.");
      }
    } else {
      console.error(
        "Invalid data structure. Please check the provided objects."
      );
    }

    // //console.log('racesMarketsData', racesMarketsData);
    //console.log("raceOddsData ===>", raceOddsData);
    return res.send({
      success: true,
      message: "Records",
      results: {
        racesMarketsData,
        raceOddsData,
      },
    });
  } catch (error) {
    console.error("Error retrieving races:", error);
    return res.send({
      success: false,
      message: "Error retrieving races",
    });
  }
}

function updateMatch(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).send({ errors: errors.errors });
  }
  if (req.decoded.role !== "0") {
    return res
      .status(404)
      .send({ message: "only company can add default theme" });
  }
  const {
    _id,
    updateType,
    matchStoppedReason,
    matchCanceledStatus,
    matchResumedStatus,
  } = req.body;

  let query = {};
  let updateField = {};
  let successMessage = "";

  switch (updateType) {
    case "stopped":
      // Check if the match is already stopped
      query = { _id };
      Events.findOne(query, (err, foundMatch) => {
        if (err || !foundMatch) {
          return res.status(400).json({
            success: false,
            message: "Failed to find match data",
            error: err,
          });
        }

        // if (foundMatch.matchStopStatus === true) {
        //   return res.status(400).json({
        //     success: false,
        //     message: 'This match is already stopped.',
        //   });
        // }

        // Proceed with stopping the match
        updateField = {
          matchStoppedReason: matchStoppedReason,
          matchStopStatus: true,
          matchResumedStatus: false, // Ensure it's not resumed when stopped
          matchCanceledStatus: matchCanceledStatus,
        };

        successMessage = "Match stopped successfully";

        const base64data = Buffer.from(JSON.stringify(updateField)).toString(
          "base64"
        );
        axios.get(
          "http://localhost:3004/updateField?id=" + _id + "&data=" + base64data
        );

        Events.findOneAndUpdate(
          { _id },
          { $set: updateField },
          (err, updatedMatch) => {
            if (err || !updatedMatch) {
              return res.status(400).json({
                success: false,
                message: "Failed to update match data",
                error: err,
              });
            } else {
              res.status(200).json({
                success: true,
                message: successMessage,
              });
            }
          }
        );
      });
      break;

    case "resumed":
      // Check if the match is already resumed
      query = { _id };
      Events.findOne(query, (err, foundMatch) => {
        if (err || !foundMatch) {
          return res.status(400).json({
            success: false,
            message: "Failed to find match data",
            error: err,
          });
        }

        // Proceed with updating the match as resumed
        if (matchResumedStatus === false) {
          updateField.matchStopStatus = true;
        } else if (matchResumedStatus === true) {
          updateField.matchStopStatus = false;
          updateField.matchStoppedReason = "";
        }
        updateField.matchResumedStatus = matchResumedStatus;
        successMessage = "Match resumed successfully";

        const base64data = Buffer.from(JSON.stringify(updateField)).toString(
          "base64"
        );
        axios.get(
          "http://localhost:3004/updateField?id=" + _id + "&data=" + base64data
        );

        Events.findOneAndUpdate(
          { _id },
          { $set: updateField },
          (err, updatedMatch) => {
            if (err || !updatedMatch) {
              return res.status(400).json({
                success: false,
                message: "Failed to update match data",
                error: err,
              });
            } else {
              res.status(200).json({
                success: true,
                message: successMessage,
              });
            }
          }
        );
      });
      break;

    case "canceled":
      query = { _id };
      // Update only the matchCanceledStatus
      updateField = { matchCanceledStatus };
      successMessage = "Match canceled status updated successfully";

      const base64data = Buffer.from(JSON.stringify(updateField)).toString(
        "base64"
      );
      axios.get(
        "http://localhost:3004/updateField?id=" + _id + "&data=" + base64data
      );

      Events.findOneAndUpdate(
        query,
        { $set: updateField },
        (err, updatedMatch) => {
          if (err || !updatedMatch) {
            return res.status(400).json({
              success: false,
              message: "Failed to update match data",
              error: err,
            });
          } else {
            res.status(200).json({
              success: true,
              message: successMessage,
            });
          }
        }
      );
      break;

    default:
      return res.status(400).json({
        success: false,
        message: "Invalid update type",
      });
  }
}

async function bettorDashboardGames(req, res) {
  try {
    const selectedCasinoData = await SelectedCasino.aggregate([
      { $match: { "games.mobile": JSON.parse(req.query.isMobile) } },
      {
        $project: {
          games: {
            $filter: {
              input: "$games",
              as: "game",
              cond: { $eq: ["$$game.isDashboard", true] },
            },
          },
        },
      },
      {
        $unwind: "$games",
      },
      {
        $project: {
          _id: 0,
          id: "$games.id",
          name: "$games.name",
          id_hash: "$games.id_hash",
          image_filled: "$games.image_filled",
          isDashboard: "$games.isDashboard",
          allowedBetamount: "$games.allowedBetamount",
          mobile: "$games.mobile",
        },
      },
    ]);
    const now = new Date();
    let startOfDay = new Date(now);
    let startOfDayTimestamp = startOfDay.getTime() - 30 * 60 * 1000;

    let endOfDay = new Date(now);
    let endOfDayTimestamp = endOfDay.getTime() + 23.5 * 60 * 60 * 1000

    const greyHound = await MarketIDS.aggregate([
      {
        $match: {
          sportID: Number('4339'),
          $and: [
            { openDate: { $gte: startOfDayTimestamp } },
            { openDate: { $lte: endOfDayTimestamp } }
          ]
        },
      },
      {
        $lookup: {
          from: "inplayevents",
          localField: "eventId",
          foreignField: "Id",
          as: "event",
        },
      },
      {
        $addFields: {
          event: {
            $cond: {
              if: {
                $eq: [{ $type: "$event" }, "array"]
              },
              then: { $arrayElemAt: ["$event", 0] },
              else: "$event"
            }
          }
        }
      },
      {
        $match: {
          "event.CompanySetStatus": "OPEN",
          "event.status": "OPEN",
        }
      },
      {
        $group: {
          _id: "$_id",
          Id: { $first: "$eventId" },
          marketIds: { $push: "$marketId" },
          sportsId: { $first: "$sportID" },
          openDate: { $first: "$openDate" },
          openDate2: { $first: "$event.openDate" },
          status: { $first: "$status" },
          inPlay: { $first: "$inPlay" },
          countryCode: { $first: "$event.countryCode" },
          venue: { $first: "$event.venue" },
          inplay2: { $first: "$event.inplay" },
          matchId: { $first: "$event._id" },
          name: { $first: "$event.name" },
        }
      },
      {
        $sort: {
          openDate: 1
        }
      }
    ])

    const horseRace = await MarketIDS.aggregate([
      {
        $match: {
          sportID: Number('7'),
          $and: [
            { openDate: { $gte: startOfDayTimestamp } },
            { openDate: { $lte: endOfDayTimestamp } }
          ]
        },
      },
      {
        $lookup: {
          from: "inplayevents",
          localField: "eventId",
          foreignField: "Id",
          as: "event",
        },
      },
      {
        $addFields: {
          event: {
            $cond: {
              if: {
                $eq: [{ $type: "$event" }, "array"]
              },
              then: { $arrayElemAt: ["$event", 0] },
              else: "$event"
            }
          }
        }
      },
      {
        $match: {
          "event.CompanySetStatus": "OPEN",
          "event.status": "OPEN",
        }
      },
      {
        $group: {
          _id: "$_id",
          Id: { $first: "$eventId" },
          marketIds: { $push: "$marketId" },
          sportsId: { $first: "$sportID" },
          openDate: { $first: "$openDate" },
          openDate2: { $first: "$event.openDate" },
          status: { $first: "$status" },
          inPlay: { $first: "$inPlay" },
          countryCode: { $first: "$event.countryCode" },
          venue: { $first: "$event.venue" },
          inplay2: { $first: "$event.inplay" },
          matchId: { $first: "$event._id" },
          name: { $first: "$event.name" },
        }
      },
      {
        $sort: {
          openDate: 1
        }
      }
    ])

    const inPlay = await Events.find(
      {
        status: "OPEN",
        inplay: true,
        isShowed: true,
      },
      {
        _id: 1,
        Id: 1,
        openDate: 1,
        name: 1,
        competitionName: 1,
        inplay: 1,
        sportsId: 1,
        // oddsData: {
        //   $slice: ["$odds", 1]
        // }
      }
    ).sort({
      openDate: -1,
    });

    const asianCasino = await AsianTable.find({ isDashboard: true });

    const organizedEvents = {
      horseRace: horseRace,
      greyhound: greyHound,
      inPlay: inPlay,
      casinoData: selectedCasinoData,
      asianCasino: asianCasino,
    };

    res.status(200).json({
      success: true,
      message: "Event By Sports Records",
      results: organizedEvents,
    });
  } catch (error) {
    console.error(error);
    res.status(200).json({
      success: false,
      message: "Failed to get events",
      error: error.message,
    });
  }
}

async function bettorDashboardGames2(req, res) {
  try {
    const soccerSalt = await Events.find(
      {
        sportsId: 1,
        status: "OPEN",
        isShowed: true,
      },
      {
        _id: 1,
        Id: 1,
        openDate: 1,
        name: 1,
        competitionName: 1,
        marketIds: 1,
        inplay: 1,
        // oddsData: {
        //   $slice: ["$odds", 1]
        // }
      }
    ).sort({
      inplay: -1,
      openDate: 1,
    });

    const soccer = await Promise.all(
      soccerSalt.map(async (event) => {
        if (event.marketIds && event.marketIds.length > 0) {
          const marketId = event.marketIds[0].id;
          const oddsData = await Odds.findOne({ marketId: marketId }).sort({
            createdAt: -1,
          });
          return {
            ...event.toObject(),
            odds: oddsData,
          };
        } else {
          //  if marketIds[0] is undefined
          return {
            ...event.toObject(),
            odds: null,
          };
        }
      })
    );

    const tennisSalt = await Events.find(
      {
        sportsId: 2,
        status: "OPEN",
        isShowed: true,
      },
      {
        _id: 1,
        Id: 1,
        openDate: 1,
        name: 1,
        competitionName: 1,
        marketIds: 1,
        inplay: 1,
      }
    ).sort({
      inplay: -1,
      openDate: 1,
    });

    const tennis = await Promise.all(
      tennisSalt.map(async (event) => {
        if (event.marketIds && event.marketIds.length > 0) {
          const marketId = event.marketIds[0].id;
          const oddsData = await Odds.findOne({ marketId: marketId }).sort({
            createdAt: -1,
          });
          return {
            ...event.toObject(),
            odds: oddsData,
          };
        } else {
          //  if marketIds[0] is undefined
          return {
            ...event.toObject(),
            odds: null,
          };
        }
      })
    );

    const cricketSalt = await Events.find(
      {
        sportsId: "4",
        status: "OPEN",
        iconStatus: true,
        isShowed: true,
      },
      {
        _id: 1,
        Id: 1,
        openDate: 1,
        name: 1,
        competitionName: 1,
        marketIds: 1,
        inplay: 1,
      }
    ).sort({
      inplay: -1,
      openDate: 1,
    });

    const cricket = await Promise.all(
      cricketSalt.map(async (event) => {
        if (event.marketIds && event.marketIds.length > 0) {
          const marketId = event.marketIds[0].id;
          const oddsData = await Odds.findOne({ marketId: marketId }).sort({
            createdAt: -1,
          });
          return {
            ...event.toObject(),
            odds: oddsData,
          };
        } else {
          //  if marketIds[0] is undefined
          return {
            ...event.toObject(),
            odds: null,
          };
        }
      })
    );

    const organizedEvents = {
      soccer: soccer,
      tennis: tennis,
      cricket: cricket,
    };

    res.status(200).json({
      success: true,
      message: "Event By Sports Records",
      results: organizedEvents,
    });
  } catch (error) {
    console.error(error);
    res.status(200).json({
      success: false,
      message: "Failed to get events",
      error: error.message,
    });
  }
}

async function getAllMatchSettlements(req, res) {
  try {
    const sportsIdArray = ["1", "2", "4", "7", "4339"];
    const result = await Events.aggregate([
      {
        $match: {
          sportsId: { $in: sportsIdArray },
        },
      },
      {
        $facet: {
          soccer: [
            {
              $match: {
                sportsId: "1",
                winner: 0,
                openDate: {
                  $lt: moment(new Date(Date.now() - 110 * 60 * 1000)).format(
                    "M/DD/YYYY h:mm:ss A +00:00"
                  ),
                },
              },
            },
            {
              $sort: { openDate: 1 },
            },
            {
              $lookup: {
                from: "odds",
                localField: "Id",
                foreignField: "eventId",
                as: "odds",
              },
            },
            {
              $project: {
                _id: 1,
                status: 1,
                Id: 1,
                competitionName: 1,
                inplay: 1,
                name: 1,
                openDate: 1,
                oddsData: {
                  $cond: {
                    if: {
                      $and: [
                        { $isArray: "$odds" },
                        { $gt: [{ $size: "$odds" }, 0] },
                        { $isArray: { $arrayElemAt: ["$odds.runners", 0] } },
                      ],
                    },
                    then: { $arrayElemAt: ["$odds.runners", 0] },
                    else: [], // Empty array if any condition is not met
                  },
                },
              },
            },
            {
              $project: {
                _id: 1,
                status: 1,
                Id: 1,
                competitionName: 1,
                inplay: 1,
                name: 1,
                openDate: 1,
                "oddsData.SelectionId": 1,
                "oddsData.runnerName": 1,
              },
            },
            {
              $sort: {
                createdAt: 1,
              },
            },
          ],
          tennis: [
            {
              $match: {
                sportsId: "2",
                winner: 0,
                openDate: {
                  $lt: moment(new Date(Date.now() - 110 * 60 * 1000)).format(
                    "M/DD/YYYY h:mm:ss A +00:00"
                  ),
                },
              },
            },
            { $sort: { openDate: 1 } },

            {
              $lookup: {
                from: "odds",
                localField: "Id",
                foreignField: "eventId",
                as: "odds",
              },
            },
            {
              $project: {
                _id: 1,
                status: 1,
                Id: 1,
                competitionName: 1,
                inplay: 1,
                name: 1,
                openDate: 1,
                oddsData: {
                  $cond: {
                    if: {
                      $and: [
                        { $isArray: "$odds" },
                        { $gt: [{ $size: "$odds" }, 0] },
                        { $isArray: { $arrayElemAt: ["$odds.runners", 0] } },
                      ],
                    },
                    then: { $arrayElemAt: ["$odds.runners", 0] },
                    else: [], // Empty array if any condition is not met
                  },
                },
              },
            },
            {
              $project: {
                _id: 1,
                status: 1,
                Id: 1,
                competitionName: 1,
                inplay: 1,
                name: 1,
                openDate: 1,
                "oddsData.SelectionId": 1,
                "oddsData.runnerName": 1,
              },
            },
            {
              $sort: {
                createdAt: 1,
              },
            },
          ],
          cricket: [
            {
              $match: {
                sportsId: "4",
                winner: 0,
                openDate: {
                  $lt: moment(new Date(Date.now() - 180 * 60 * 1000)).format(
                    "M/DD/YYYY h:mm:ss A +00:00"
                  ),
                },
              },
            },
            { $sort: { openDate: 1 } },
            {
              $lookup: {
                from: "odds",
                localField: "Id",
                foreignField: "eventId",
                as: "odds",
              },
            },
            {
              $project: {
                _id: 1,
                status: 1,
                Id: 1,
                competitionName: 1,
                inplay: 1,
                name: 1,
                openDate: 1,
                oddsData: {
                  $cond: {
                    if: {
                      $and: [
                        { $isArray: "$odds" },
                        { $gt: [{ $size: "$odds" }, 0] },
                        { $isArray: { $arrayElemAt: ["$odds.runners", 0] } },
                      ],
                    },
                    then: { $arrayElemAt: ["$odds.runners", 0] },
                    else: [], // Empty array if any condition is not met
                  },
                },
              },
            },
            {
              $project: {
                _id: 1,
                status: 1,
                Id: 1,
                competitionName: 1,
                inplay: 1,
                name: 1,
                openDate: 1,
                "oddsData.SelectionId": 1,
                "oddsData.runnerName": 1,
              },
            },
            {
              $sort: {
                createdAt: 1,
              },
            },
          ],

          horseRace: [
            {
              $match: {
                sportsId: "7",
                winner: 0,
                openDate: {
                  $lt: moment(new Date(Date.now() - 10 * 60 * 1000)).format(
                    "YYYY-MM-DDTHH:mm:ss+00:00"
                  ),
                },
              },
            },
            {
              $project: {
                _id: 1,
                meetingId: 1,
                openDate: 1,
                name: 1,
                meetingName: 1,
                inplay: 1,
                status: 1,
              },
            },
          ],
          greyhound: [
            {
              $match: {
                sportsId: "4339",
                winner: 0,
                openDate: {
                  $lt: moment(new Date(Date.now() - 5 * 60 * 1000)).format(
                    "YYYY-MM-DDTHH:mm:ss+00:00"
                  ),
                },
              },
            },
            {
              $project: {
                _id: 1,
                Id: 1,
                openDate: 1,
                name: 1,
                competitionName: 1,
                inplay: 1,
                status: 1,
              },
            },
          ],
        },
      },
    ]).exec();

    //console.log(" ======================== Result ======================== ",result);
    const organizedEvents = {
      soccer: result?.soccer, // Access the ' array for the specific event type
      tennis: result?.tennis,
      cricket: result?.cricket,
      horseRace: result?.horseRace,
      greyhound: result?.greyhound,
    };

    res.status(200).json({
      success: true,
      message: "Event By Sports Records",
      results: organizedEvents,
    });
  } catch (error) {
    console.error(error);
    res.status(200).json({
      success: false,
      message: "Failed to get events",
      error: error.message,
    });
  }
}

async function getAllGamesResults(req, res) {
  try {
    // if (req.decoded.role != '5') {
    //   return res.status(403).json({ message: 'You are not allowed to do this' });
    // }

    let query = { isResultSaved: true };

    var fancyCheck = false;

    if (req.body.sportsId == 10) {
      req.body.sportsId = 4;
      fancyCheck = true;
    }

    if (
      req.body.sportsId == 1 ||
      req.body.sportsId == 2 ||
      req.body.sportsId == 4
    ) {
      query.isShowed = true;
      query.status = { $ne: "OPEN" };
    }

    if (req.body.sportsId == 7 || req.body.sportsId == 4339) {
      query.status = {
        $nin: ["OPEN", "WAITING"],
      };
    }

    let page = 1;
    let sort = -1;
    let sortValue = "openDate";
    let limit = config.pageSize;
    let projection;

    if (req.body.numRecords) {
      if (
        !isNaN(parseInt(req.body.numRecords)) ||
        parseInt(req.body.numRecords) > 0
      )
        limit = req.body.numRecords;
    }
    if (req.body.sortValue) {
      sortValue = req.body.sortValue;
    }
    if (req.body.sort) {
      sort = parseInt(req.body.sort);
    }
    if (req.body.page) {
      page = parseInt(req.body.page);
    }
    if (req.body.sportsId) {
      query.sportsId = req.body.sportsId;
    }
    if (req.body.startDate && req.body.endDate) {
      query.openDate = {
        $gte: new Date(req.body.startDate).getTime(),
        $lte: new Date(req.body.endDate).getTime(),
      };
    } else if (req.body.startDate) {
      query.openDate = { $gte: new Date(req.body.startDate).getTime() };
    } else if (req.body.endDate) {
      query.openDate = { $lte: new Date(req.body.startDate).getTime() };
    }

    if (req.body.searchValue) {
      query.$or = [
        { competitionName: { $regex: req.body.searchValue, $options: "i" } },
        { name: { $regex: req.body.searchValue, $options: "i" } },
      ];
    }

    const options = {
      page: page,
      limit: limit,
      sort: { [sortValue]: sort },
      select: projection,
    };

    //console.log("Query =========== ", query);

    Events.paginate(query, options, async (err, results) => {
      if (err) {
        console.error(err);
        return res
          .status(500)
          .json({ message: "Pagination failed", error: err.message });
      }

      if (results.totalDocs == 0) {
        return res.status(404).json({ message: "No records found" });
      }

      var realResults = [];

      for (let index = 0; index < results.docs.length; index++) {
        const ev = results.docs[index];
        var marketResultForEvent;
        if (fancyCheck) {
          marketResultForEvent = await MarketIDS.find({
            eventId: ev.Id,
            winnerInfo: { $ne: null },
            sportID: -1,
          });
        } else {
          marketResultForEvent = await MarketIDS.find({
            eventId: ev.Id,
            winnerInfo: { $ne: null },
            sportID: { $ne: -1 },
          });
        }

        if (marketResultForEvent.length > 0) {
          for (let i = 0; i < marketResultForEvent.length; i++) {
            const marketData = marketResultForEvent[i];
            const combinedData = {
              ...ev._doc,
              marketName: marketData.marketName,
              winner: marketData.winnerInfo,
            };
            realResults.push(combinedData);
          }
        } else {
          var checkMarketRecord2;
          if (fancyCheck) {
            checkMarketRecord2 = await MarketIDS.findOne({
              eventId: ev.Id,
              runners: { $ne: null },
              sportID: -1,
            });
          } else {
            checkMarketRecord2 = await MarketIDS.findOne({
              eventId: ev.Id,
              runners: { $ne: null },
              sportID: { $ne: -1 },
            });
          }
          if (checkMarketRecord2) {
            const combinedData = {
              ...ev._doc,
              marketName: "WAITING RESULTS",
              winner: "",
            };
            realResults.push(combinedData);
          } else if (!fancyCheck) {
            const combinedData = {
              ...ev._doc,
              marketName: "WAITING RESULTS 2",
              winner: "",
            };
            realResults.push(combinedData);
          }
        }
      }

      res.status(200).json({
        success: true,
        message: "Games Record Found",
        results: realResults,
        total: results.total,
        limit: results.limit,
        page: results.page,
        pages: results.pages,
      });
    });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ message: "Failed to get events", error: error.message });
  }
}

async function setLoginHistories(req, res) {
  /*
  if (req.decoded.role !== '0') {
    return res
      .status(404)
      .send({ message: 'only company can ... ' });
  }
 */
  if (!res.body.search) {
    try {
      const users = await User.find({});
      const lastLogins = await Promise.all(
        users.map(async (user) => {
          const lastLoginRecord = await loginRecord
            .findOne({ userName: user.userName })
            .sort({ loginDate: -1 })
            .exec();

          return {
            userName: user.userName,
            lastLogin: lastLoginRecord ? lastLoginRecord.loginDate : null,
          };
        })
      );

      return res.send({
        thead: ["Username", "Last login", "Ip Address", "City", "Location"],
        data: lastLogins,
      });
    } catch (error) {
    }
  }
}

async function setCloseEventWithCancelBet(req, res) {
  if (req.decoded.role != "0") {
    return res.status(404).send({ message: "only company can ... " });
  }

  if (!req.query.eventId) {
    return res.status(404).send({ message: "Id required ... " });
  }

  const currentEv = await Events.findOne({ Id: req.query.eventId });

  if (!currentEv) {
    return res.status(404).send({ message: "Events not exist ... " });
  }

  // if (req.query.reason) {
  //   await Events.findOneAndUpdate(
  //     { _id: currentEv._id },
  //     { status: "CLOSED-" + req.query.reason, isCanceled: true }
  //   );
  // } else {
  //   await Events.findOneAndUpdate(
  //     { _id: currentEv._id },
  //     { status: "CLOSED-COMPANY", isCanceled: true }
  //   );
  // }

  // var updateField = { status: "CLOSED-COMPANY" };
  // const base64data = Buffer.from(JSON.stringify(updateField)).toString(
  //   "base64"
  // );
  // axios.get("http://localhost:3004/updateField?id=" + _id + "&data=" + base64data);

  // await MarketIDS.updateMany(
  //   { eventId: req.query.eventId },
  //   { inplay: false, status: "CLOSED" }
  // );

  const bets = await Bets.find({
    status: 1,
    matchId: currentEv._id.toString(),
  });

  // for (let index = 0; index < bets.length; index++) {
  //   const bet = bets[index];
  //   await handleDrawBet(bet, 2);
  // }

  for (const bet of bets) {
    await handleDrawBet(bet, 2);
  }

  return res.send({
    success: true,
    message: "Event Successfully Closed",
  });
}

async function setMatchShow(req, res) {
  if (req.decoded.role !== "0") {
    return res.status(404).send({ message: "only company can ... " });
  }
  if (req.query.status == false) {
    const currentEv = await Events.findOne({ Id: req.query.matchId });
    if (currentEv) {
      if (currentEv.sportsId == "4" && currentEv.matchType == "") {
        return res.status(404).send({
          message: "You need to save correct match type before this action",
        });
      }

      if (currentEv.inplay == true) {
        const event = await Events.findOneAndUpdate(
          { Id: req.query.matchId },
          {
            $set: {
              isShowed: req.query.status,
            },
          },
          { upsert: false }
        );
        await MarketIDS.updateMany(
          { eventId: req.query.matchId },
          { inplay: false }
        );
        return res.status(200).json({
          success: true,
          message: "match updated successful",
          data: event,
        });
      }
    }
  } else {
    const event = await Events.findOneAndUpdate(
      { Id: req.query.matchId },
      {
        $set: {
          isShowed: req.query.status,
        },
      },
      { upsert: false }
    );
    const resp = await createNewSession(req.query.matchId);

    return res.status(200).json({
      success: true,
      message: "match updated successfully",
      data: event,
    });
  }
}

async function setBattingDisabled(req, res) {
  if (req.decoded.role != "0") {
    return res.status(404).send({ message: "only company can ... " });
  }
  try {
    const currentEv = await Events.findOneAndUpdate(
      { Id: req.query.matchId },
      { $set: { betAllowed: req.query.status } }
    );
    return res.send({
      success: true,
      message: "Event Successfully updated!",
    });
  } catch (error) {
    return res.status(404).send({
      success: false,
      message: "Something went wrong!",
    });
  }
}

const createNewSession = async (matchId) => {
  const match = await Events.findOne({ Id: matchId });
  const deleted = await Session.deleteMany({ eventId: matchId });
  const matchType = match.matchType;
  let totalSession = 0;
  switch (matchType) {
    case "T10":
      totalSession = 4;
      break;
    case "T20":
      totalSession = 8;
      break;
    case "ODI":
      totalSession = 20;
      break;
    case "TEST":
      totalSession = 18 * 2;
      break;
    default:
      break;
  }
  for (let i = 1; i < totalSession; i++) {
    const session = new Session({
      sessionNo: i,
      eventId: match.Id,
      Id: match._id,
    });
    session.save();
  }
};

const sessionList = async (req, res) => {
  try {
    const eventId = Number(req.query.eventId);
    const session = await Session.find({
      eventId: eventId,
    });

    return res.status(200).send({
      success: true,
      message: "session list",
      results: session,
    });
  } catch (error) {
    return res.status(404).send({
      success: false,
      message: "Something went wrong!",
    });
  }
};

const updateSessionScore = async (req, res) => {
  try {
    if (!req.body.eventId || !req.body.session || !req.body.score) {
      return res.status(404).send({
        success: false,
        message: "Invalid Request !",
      });
    }
    const eventId = Number(req.body.eventId);
    const session = Number(req.body.session);
    const score = Number(req.body.score);

    const update = await Session.findOneAndUpdate(
      { eventId: eventId, sessionNo: session },
      { score: score }
    );

    return res.status(200).send({
      success: true,
      message: "session successfully updated !",
    });
  } catch (error) {
    return res.status(404).send({
      success: false,
      message: "Something went wrong!",
    });
  }
};

const getMarketIDSData = async (req, res) => {
  if (req.decoded.role != "0") {
    return res.status(404).send({ message: "only company can ... " });
  }

  try {
    if (!req.body.eventId) {
      return res.status(404).send({
        success: false,
        message: "Invalid Request !",
      });
    }

    const result = await MarketIDS.find({
      eventId: req.body.eventId,
      runners: { $ne: null },
    });

    return res.status(200).send({
      success: true,
      results: result,
    });
  } catch (error) {
    return res.status(404).send({
      success: false,
      message: "Something went wrong!",
    });
  }
};

const saveMarketIDSWinnerRunner = async (req, res) => {
  if (req.decoded.role != "0") {
    return res.status(404).send({ message: "only company can ... " });
  }

  try {
    if (!req.body.eventId || !req.body.marketId || !req.body.runnerId) {
      return res.status(404).send({
        success: false,
        message: "Invalid Request !",
      });
    }

    const market = await MarketIDS.findOne({
      eventId: req.body.eventId,
      marketId: req.body.marketId,
    });

    if (!market) {
      return res.status(404).send({
        success: false,
        message: "Market is not exist for this event",
      });
    }

    if (!market.runners || market.runners.length == 0) {
      await MarketIDS.findOneAndUpdate(
        { eventId: req.body.eventId, marketId: req.body.marketId },
        {
          $set: {
            winnerInfo: req.body.runnerId,
            manuelClose: true,
            winnerRunnerData: req.body.runnerId,
          },
        }
      );
      return res.send({
        success: true,
        message: "Winner runner saved without runner name.",
      });
    }

    var selectedR = null;

    for (let index = 0; index < market.runners.length; index++) {
      const r = market.runners[index];
      if (r.SelectionId == req.body.runnerId) {
        selectedR = r;
        break;
      }
    }

    if (selectedR) {
      if (market.marketName == "Match Odds") {
        await Events.findOneAndUpdate(
          { eventId: req.body.eventId },
          { $set: { winner: selectedR.runnerName } }
        );
      }

      await MarketIDS.findOneAndUpdate(
        { eventId: req.body.eventId, marketId: req.body.marketId },
        {
          $set: {
            winnerInfo: selectedR.runnerName,
            manuelClose: true,
            winnerRunnerData: req.body.runnerId,
          },
        }
      );

      return res.send({
        success: true,
        message: "Winner runner saved with runner name.",
      });
    } else {
      await MarketIDS.findOneAndUpdate(
        { eventId: req.body.eventId, marketId: req.body.marketId },
        {
          $set: {
            winnerInfo: req.body.runnerId,
            manuelClose: true,
            winnerRunnerData: req.body.runnerId,
          },
        }
      );
      return res.send({
        success: true,
        message: "Winner runner saved without runner name 1.",
      });
    }
  } catch (error) {
    return res.status(404).send({
      success: false,
      message: "Something went wrong!",
    });
  }
};

const getWaitingBetsForManuel = async (req, res) => {
  try {
    const results = await Bets.find({ status: 1, isManuel: true }).sort({
      createdAt: -1,
    });
    // //console.log('results:', results);
    var groups = {};
    for (var i = 0; i < results.length; i++) {
      var item = results[i].toJSON();
      // if (item.betSession) {
      var main_group_key =
        item.matchId + "_" + item.marketId + "_" + item.betSession;

      if (!groups[main_group_key]) {
        groups[main_group_key] = {
          eventData: { eventName: null, marketData: null, eventId: null },
          bets: [],
        };
        const eventData = await Events.findOne(
          { _id: mongoose.Types.ObjectId(item.matchId) },
          { Id: 1, name: 1, matchType: 1 }
        );
        if (eventData) {
          groups[main_group_key].eventData.eventName = eventData.name;
          groups[main_group_key].eventData.eventId = eventData.Id;
          groups[main_group_key].eventData.matchType = eventData.matchType;

          const marketData = await MarketIDS.findOne({
            eventId: eventData.Id,
            marketId: item.marketId,
          });
          if (marketData) {
            groups[main_group_key].eventData.marketData = marketData;
          } else {
            groups[main_group_key].eventData.marketData = null;
          }
        }
      }

      const u1 = await User.findOne({ userId: item.userId }, { userName: 1, createdBy: 1 });
      const parent = await User.findOne({ userId: u1?.createdBy }, { userName: 1 });
      item.userName = u1 ? u1.userName : null;
      item.parentName = parent ? parent.userName : null;
      if (item.betSession !== null) {
        const session = await Session.findOne({ sessionNo: Number(item.betSession), eventId: Number(item.eventId) })
        item.session = session
      }
      groups[main_group_key].bets.push(item);
      // }
    }

    return res.status(200).send({
      success: true,
      results: groups,
    });
  } catch (error) {
    console.error(" ============== Error ", error);
    return res.status(404).send({
      success: false,
      message: "Something went wrong!",
    });
  }
};

const getEventWinnerName = async (req, res) => {
  try {
    const { eventId, marketId } = req.body
    if (!eventId) {
      return res.status(404).send({
        success: false,
        message: "Invalid Request !",
      });
    }
    if (marketId) {
      const result = await MarketIDS.findOne(
        { marketId: marketId, eventId: eventId },
        { winnerInfo: 1 }
      );

      return res.status(200).send({
        success: true,
        result: { winner: result.winnerInfo },
      });
    }

    const result = await Events.findOne(
      { Id: eventId },
      { winner: 1 }
    );

    return res.status(200).send({
      success: true,
      result,
    });
  } catch (error) {
    return res.status(404).send({
      success: false,
      message: "Something went wrong!",
    });
  }
};

const getSessionScore = async (req, res) => {
  if (!req.query.eventId || !req.query.sessionNo) {
    return res.status(404).send({
      success: false,
      message: "eventId or sessionNo is missing",
    });
  }

  const result = await Session.findOne({
    eventId: req.query.eventId,
    sessionNo: parseInt(req.query.sessionNo),
  });

  return res.status(200).send({
    success: true,
    result,
  });
};

const setSessionScore = async (req, res) => {
  if (!req.body.eventId || !req.body.sessionNo || !req.body.score) {
    return res.status(404).send({
      success: false,
      message: "eventId or sessionNo or score is missing",
    });
  }

  await Session.findOneAndUpdate(
    { eventId: req.body.eventId, sessionNo: parseInt(req.body.sessionNo) },
    { $set: { score: parseInt(req.body.score), manuelSave: true } }
  );

  return res.status(200).send({
    success: true,
  });
};

const setFancyScore = async (req, res) => {
  const { betId, resultData } = req.body
  if (!betId || !resultData) {
    return res.status(404).send({
      success: false,
      message: "betId or resultData is missing",
    });
  }

  const bet = await Bets.findOne({ _id: mongoose.Types.ObjectId(betId) })
  if (!bet) {
    return res.status(404).send({
      success: false,
      message: "bet is missing",
    });
  }

  await MarketIDS.findOneAndUpdate(
    { marketId: bet.fancyData, eventId: bet.eventId },
    {
      $set: { winnerRunnerData: resultData, manuelClose: true },
      $setOnInsert: {
        eventId: bet.eventId,
        marketId: bet.fancyData,
        __v: 0,
        inPlay: false,
        index: 0,
        lastCheck: 0,
        lastResultCheckTime: 0,
        openDate: 0,
        readyForScore: true,
        sportID: 4,
        status: 'OPEN',
        totalMatched: '0',
      }
    },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true
    }
  );

  return res.status(200).send({
    success: true,
  });
};

const setCasinoScore = async (req, res) => {
  const { betId, resultData } = req.body
  if (!betId || !resultData) {
    return res.status(404).send({
      success: false,
      message: "betId or resultData is missing",
    });
  }

  const casino = await CasinoCalls.findById(betId)
  if (!casino) {
    return res.status(404).send({
      success: false,
      message: "bet is missing",
    });
  }
  const payload = {
    action: 'credit',
    remote_id: casino.remote_id,
    amount: resultData,
    game_id: casino.game_id,
    round_id: casino.round_id,
    callerId: casino.callerId,
    callerPassword: casino.callerPassword,
    callerPrefix: casino.callerPrefix,
    username: casino.username,
    provider: casino.provider,
    session_id: casino.session_id,
    gamesession_id: casino.gamesession_id,
    jackpot_contribution_ids: casino.jackpot_contribution_ids,
    jackpot_contribution_per_id: casino.jackpot_contribution_per_id,
    game_id_hash: casino.game_id_hash,
    jackpot_win_ids: casino.jackpot_win_ids,
    transaction_id: `${casino.transaction_id}-credit`,
    gameplay_final: 1,
    jackpot_win_in_amount: 0,
    is_freeround_win: 0,
    is_jackpot_win: 0,
  }
  return await creditCasino(payload, res)
};

const cancelSingleBet = async (req, res) => {
  if (req.decoded.role != 0) {
    return res.status(404).send({
      success: false,
      message: "Unauthorized Operation",
    });
  }
  const { betId, type } = req.body
  if (type === 'casino') {
    const casinoCall = await CasinoCalls.findById(betId)
    const payload = {
      action: 'rollback',
      callerId: casinoCall.callerId,
      callerPassword: casinoCall.callerPassword,
      callerPrefix: casinoCall.callerPrefix,
      username: casinoCall.username,
      amount: casinoCall.amount,
      provider: casinoCall.provider,
      game_id: casinoCall.game_id,
      gameplay_final: casinoCall.gameplay_final,
      round_id: casinoCall.round_id,
      session_id: casinoCall.session_id,
      gamesession_id: casinoCall.gamesession_id,
      jackpot_contribution_ids: casinoCall.jackpot_contribution_ids,
      jackpot_contribution_per_id: casinoCall.jackpot_contribution_per_id,
      game_id_hash: casinoCall.game_id_hash,
      jackpot_win_ids: casinoCall.jackpot_win_ids,
      transaction_id: casinoCall.transaction_id,
      remote_id: casinoCall.remote_id,
    }
    return rollbackCasino(payload, res)
  } else {
    const bet = await Bets.findById(betId);
    if (!bet || bet.status != 1) {
      return res.status(404).send({
        success: false,
        message: "Bet could not Found or Already Canceled ! ",
      });
    }
    if ([2, 3, 4].includes(bet.type)) {
      const marketId = bet.marketId;
      const matchId = bet.matchId;
      const userId = bet.userId;
      const session = bet.betSession;
      const type = bet.type;
      const allBets = await Bets.find({
        type: type,
        matchId: matchId,
        betSession: session,
        marketId: marketId,
        userId: userId,
        status: 1,
      });
      for (const bet of allBets) {
        await handleDrawBet(bet, 2);
      }
    } else if (bet.isfancyOrbookmaker == true && bet.fancyData !== null) {
      const marketId = bet.marketId;
      const matchId = bet.matchId;
      const userId = bet.userId;
      const TargetScore = bet.TargetScore;
      const allBets = await Bets.find({
        TargetScore: TargetScore,
        matchId: matchId,
        marketId: marketId,
        userId: userId,
        isfancyOrbookmaker: true,
        status: 1,
      });
      for (const bet of allBets) {
        await handleDrawBet(bet, 2);
      }
    } else {
      const marketId = bet.marketId;
      const matchId = bet.matchId;
      const userId = bet.userId;
      const allBets = await Bets.find({
        matchId: matchId,
        marketId: marketId,
        userId: userId,
        status: 1,
      });
      for (const bet of allBets) {
        //console.log(" ============ BET ============ ", bet);
        await handleDrawBet(bet, 2);
      }
    }
    return res.send({
      success: true,
      message: "bet canceled Successfully !",
    });
  }
};

async function addTermsAndConditions(req, res) {
  const errors = validationResult(req);
  if (errors.errors.length !== 0) {
    return res.status(400).send({ errors: errors.errors });
  }
  try {
    if (req.decoded.role != "0") {
      return res.status(404).send({ message: "Something went wrong !" });
    }
    const response = await PrivacyPolicy.findOneAndUpdate(
      {},
      { $set: { termAndConditionsContent: req.body.termAndConditionsContent } }
    );
    return res.send({
      success: true,
      message: "Terms And Conditions Added Successfully",
      results: response,
    });
  } catch (err) {
    //console.log("Error ${err} !", `Error ${err}`);
    return res.send({
      message: `Something went wrong `,
    });
  }
}

async function GetAllTermsAndConditions(req, res) {
  try {
    const response = await PrivacyPolicy.findOne(
      {},
      { termAndConditionsContent: 1, createdAt: 1, updatedAt: 1 }
    );
    return res.send({
      success: true,
      message: "Terms And Conditions Record Found",
      results: response,
    });
  } catch (err) {
    //console.log("Error ${err} !", `Error ${err}`);
    return res.send({
      message: `Something went wrong `,
    });
  }
}

async function addPrivacyPolicy(req, res) {
  const errors = validationResult(req);
  if (errors.errors.length !== 0) {
    return res.status(400).send({ errors: errors.errors });
  }
  if (req.decoded.role !== "0") {
    return res
      .status(404)
      .send({ message: "only company can add privacy policies" });
  }
  try {
    const response = await PrivacyPolicy.findOneAndUpdate(
      {},
      { $set: { privacyPolicyContent: req.body.privacyPolicyContent } }
    );
    return res.send({
      success: true,
      message: "Privacy Policy Added Successfully",
      results: response,
    });
  } catch (err) {
    //console.log("Error ${err} !", `Error ${err}`);
    return res.send({
      message: `Something went wrong `,
    });
  }
}

async function GetAllPrivacyPolicy(req, res) {
  try {
    const privacyPolicy = await PrivacyPolicy.findOne(
      {},
      { privacyPolicyContent: 1, createdAt: 1, updatedAt: 1 }
    );
    return res.send({
      success: true,
      message: "Privacy Policy Record",
      results: privacyPolicy,
    });
  } catch (err) {
    //console.log("Error ${err} !", `Error ${err}`);
    return res.send({
      message: `Something went wrong `,
    });
  }
}

async function addRules(req, res) {
  const errors = validationResult(req);
  if (errors.errors.length !== 0) {
    return res.status(400).send({ errors: errors.errors });
  }
  if (req.decoded.role !== "0") {
    return res
      .status(404)
      .send({ message: "only company can add privacy policies" });
  }
  try {
    const response = await PrivacyPolicy.findOneAndUpdate(
      {},
      { $set: { rules: req.body.rules } }
    );

    return res.send({
      success: true,
      message: "Rules & Regulations successfully added",
      results: response,
    });
  } catch (err) {
    //console.log("Error ${err} !", `Error ${err}`);
    return res.send({
      message: `Something went wrong `,
    });
  }
}

async function GetRule(req, res) {
  try {
    const privacy = await PrivacyPolicy.findOne(
      {},
      { rules: 1, createdAt: 1, updatedAt: 1 }
    );
    return res.send({
      success: true,
      message: "Rules & Regulations",
      results: privacy,
    });
  } catch (err) {
    //console.log("Error ${err} !", `Error ${err}`);
    return res.send({
      message: `Something went wrong `,
    });
  }
}

async function SetAsianDashboard(req, res) {
  const errors = validationResult(req);
  if (errors.errors.length !== 0) {
    return res.status(400).send({ errors: errors.errors });
  }
  if (req.decoded.role !== "0") {
    return res
      .status(404)
      .send({ message: "only company can add privacy policies" });
  }
  try {
    const response = await AsianTable.findOneAndUpdate(
      { tableId: req.body.tableId },
      { $set: { isDashboard: req.body.isDashboard } }
    );

    return res.send({
      success: true,
      message: "Successfully Updated !",
      results: response,
    });
  } catch (Error) {
    console.error(`Error ${Error}`);
    return res.send({
      message: `Something went wrong !`,
    });
  }
}

async function removeOdds(req, res) {
  try {
    const Id = req.params.id;
    const lastDayTime = 3600 * 24 * 1000;
    const currentTime = (new Date()).getTime() - lastDayTime;

    if (Id == "race") {
      await RaceOdds.deleteMany({ createdAt: { $lt: currentTime } })
    } else {
      await Odds.deleteMany({ createdAt: { $lt: currentTime } })
    }

    res.status(200).json({ success: true, msg: "Removed Odds Data older than a day" })
  } catch (err) {
    //console.log(err)
    res.status(500).json({ success: false, msg: "Failed to remove odds" })
  }
}

async function getActiveBettors(req, res) {
  try {
    res.status(200).json({ success: true, results: Object.fromEntries(global.activeBettors) })
  } catch (err) {
    console.error('getActiveBettors: ', err)
    res.status(500).json({ success: false, msg: "Failed to remove odds" })
  }
}

async function eventListByMarketIds(req, res) {
  try {
    const now = new Date();
    var startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    var startOfDayTimestamp = startOfDay.getTime();

    // const sportId = req.params.sportsId;
    var endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);
    var endOfDayTimestamp = endOfDay.getTime();

    const events = await MarketIDS.aggregate([
      {
        $match: {
          sportID: Number(sportId),
        },
      },
      {
        $lookup: {
          from: "inplayevents",
          localField: "eventId",
          foreignField: "Id",
          as: "event",
        },
      },
      {
        $addFields: {
          event: {
            $cond: {
              if: {
                $eq: [{ $type: "$event" }, "array"]
              },
              then: { $arrayElemAt: ["$event", 0] },
              else: "$event"
            }
          }
        }
      },
      {
        $match: {
          "event.CompanySetStatus": "OPEN",
          "event.status": "OPEN",
        }
      },
      {
        $group: {
          _id: "$_id",
          Id: { $first: "$eventId" },
          marketIds: { $push: "$marketId" },
          sportsId: { $first: "$sportID" },
          openDate: { $first: "$openDate" },
          openDate2: { $first: "$event.openDate" },
          status: { $first: "$status" },
          inPlay: { $first: "$inPlay" },
          countryCode: { $first: "$event.countryCode" },
          venue: { $first: "$event.venue" },
          inplay2: { $first: "$event.inplay" },
          matchId: { $first: "$event._id" },
        }
      },
      {
        $sort: {
          openDate: 1
        }
      },
      {
        $project: {
          marketId: { $first: "$marketIds" }
        }
      }
    ])

    let marketIdsResult = [];

    for (let i = 0; i < events?.length; i++) {
      marketIdsResult.push(events[i].marketId)
    }

    return res.send({
      status: true,
      message: "Event list",
      data: events
    })
  } catch (error) {
    //console.log(`Error ${error}`);
    return res.send({ status: false, message: `Something went wrong ${error}` });
  }

}

async function updateSetting(req, res) {
  try {
    const { kind, settingKey, settingValue } = req.body
    if (kind === 'UPDATE_CRICKET_SCORECARD') {
      await Settings.findOneAndUpdate({
        settingKey,
      }, {
        settingKey, settingValue
      }, { upsert: true, new: true, setDefaultsOnInsert: true })
    }

    return res.send({
      status: true,
      message: "Updated successfully",
    })
  } catch (error) {
    //console.log(`Error ${error}`);
    return res.send({ status: false, message: `Something went wrong ${error}` });
  }
}

async function getSetting(req, res) {
  try {
    const { kind, settingKey, settingValue } = req.body
    if (kind === 'GET_CRICKET_SCORECARD') {
      const setting = await Settings.findOne({
        settingKey,
      })
      return res.send({
        status: true,
        kind,
        results: setting,
      })
    }

    return res.send({
      status: true,
      message: "Updated successfully",
    })
  } catch (error) {
    //console.log(`Error ${error}`);
    return res.send({ status: false, message: `Something went wrong ${error}` });
  }
}

loginRouter.post(
  "/updateDefaultTheme",
  settingsValidation.validate("updateDefaultTheme"),
  updateDefaultTheme
);
loginRouter.post(
  "/updateDefaultLoginPage",
  settingsValidation.validate("updateDefaultLoginPage"),
  updateDefaultLoginPage
);
loginRouter.post(
  "/addTermsAndConditions",
  settingsValidation.validate("addTermsAndConditions"),
  addTermsAndConditions
);
router.get("/GetAllTermsAndConditions", GetAllTermsAndConditions);
loginRouter.post("/addPrivacyPolicy", settingsValidation.validate("addPrivacyPolicy"), addPrivacyPolicy);
router.get("/GetAllPrivacyPolicy", GetAllPrivacyPolicy);
loginRouter.post(
  "/updateDefaultExchange",
  settingsValidation.validate("updateDefaultExchange"),
  updateDefaultExchange
);

router.get("/GetRule", GetRule);
loginRouter.post("/addRules", addRules);
loginRouter.post(
  "/SetAsianDashboard",
  settingsValidation.validate("SetAsianDashboard"),
  SetAsianDashboard
);

loginRouter.post(
  "/updateDefaultBetSizes",
  settingsValidation.validate("updateDefaultBetSizes"),
  updateDefaultBetSizes
);

loginRouter.get("/GetExchangeRates", GetExchangeRates);
loginRouter.get("/setCloseEventWithCancelBet", setCloseEventWithCancelBet);

loginRouter.get("/setMatchShow", setMatchShow);
loginRouter.get("/setLoginHistories", setLoginHistories);

loginRouter.get("/getDefaultBetSizes", getDefaultBetSizes);
router.get("/getDefaultSettings", getDefaultSettings);

loginRouter.get("/getSideBarMenu", getSideBarMenu);
router.get("/addSideBarMenu", addSideBarMenu);

loginRouter.get("/listCompetitions/:id", listCompetitions);
loginRouter.get("/listEventsBySport", listEventsBySport);
loginRouter.get(
  "/listEventsByCompetition/:sportsId/:competitionId",
  listEventsByCompetition
);
loginRouter.get("/listInplayEvents", listInplayEvents);
loginRouter.get("/listOddsAPI", listOddsAPI);
loginRouter.get("/racesAPI/:id", racesAPI);
loginRouter.post("/updateMatchType", updateMatchType);
loginRouter.get("/racesMarketList/:marketId", racesMarketList);
loginRouter.post("/updateMatch", updateMatch);
loginRouter.get("/bettorDashboardGames", bettorDashboardGames);
loginRouter.get("/bettorDashboardGames2", bettorDashboardGames2);
loginRouter.get("/getAllMatchSettlements", getAllMatchSettlements);
loginRouter.post("/getAllGamesResults", getAllGamesResults);
loginRouter.get("/setBattingDisabled", setBattingDisabled);
loginRouter.get("/sessionList", sessionList);
loginRouter.post("/updateSessionScore", updateSessionScore);
loginRouter.post("/getEventWinnerName", getEventWinnerName);
loginRouter.post("/getMarketIDSData", getMarketIDSData);
loginRouter.post("/saveMarketIDSWinnerRunner", saveMarketIDSWinnerRunner);
loginRouter.get("/getWaitingBetsForManuel", getWaitingBetsForManuel);
loginRouter.get("/getSessionScore", getSessionScore);
loginRouter.post("/setSessionScore", setSessionScore);
loginRouter.post("/set-fancy-score", setFancyScore);
loginRouter.post("/set-casino-amount", setCasinoScore);
loginRouter.post("/cancelSingleBet", cancelSingleBet);
router.get("/removeOdds/:id", removeOdds);
router.get("/eventListByMarketIds/:sportsId", eventListByMarketIds);
router.get("/active-bettors", getActiveBettors);
loginRouter.post("/update-setting", updateSetting);
loginRouter.post("/get-setting", getSetting);

module.exports = { loginRouter, router, listOddsAPI };
