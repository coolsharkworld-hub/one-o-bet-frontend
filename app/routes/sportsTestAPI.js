const express = require('express');
const Bets = require("../models/bets")
const Users = require("../models/user")
const InPlayEvents = require("../models/events")
const axios = require('axios');
const User = require('../models/user');
const { fetchSession } = require("../../helper/api/sessionAPIHelper");
const router = express.Router();
const apiURL = "http://185.58.225.212:8080/api/"
const apiSystemRacing = require("../../restApiSystem/src/tools_for_updated_racing.js")();
require('dotenv').config()

async function listEvents(req, res) {
  try {
    const body = {
      "filter": {
        "textQuery": "string",
        "eventTypeIds": [
          "string"
        ],
        "eventIds": [
          "string"
        ],
        "competitionIds": [
          "string"
        ],
        "marketIds": [
          "string"
        ],
        "venues": [
          "string"
        ],
        "bspOnly": true,
        "turnInPlayEnabled": true,
        "inPlayOnly": true,
        "countryCodes": [
          "string"
        ],
        "marketTypes": [
          "string"
        ],
        "timeRange": {
          "from": "2023-11-30T17:01:35.720Z",
          "to": "2023-11-30T17:01:35.720Z"
        }
      }
    }
    const response = await axios.post(`${apiURL}/listEvents`, body)
    res.status(200).json({success: true, data: response})
  } catch (err) {
    res.status(500).json({success: false, msg: "Failed to get events"})
  }
}

async function listMarketBook(req, res) {
  try {
    const marketIds = req.params.ids
    const response = await axios.get(`${apiURL}listMarketBook/testqms/${marketIds}`)
    let resultArray = [];

    if (response.data.result.length > 0) {
      for (let i = 0; i < response.data.result.length; i++) {
        const odd = {
          marketId: response.data.result[i].marketId,
          runners: response.data.result[i].runners
        }
        resultArray.push(odd)
      }
    }
    res.status(200).json({success: true, data: resultArray})
  } catch (err) {
    res.status(500).json({success: false, msg: "Failed to get "})
  }
}

async function inActiveUserExposure(req, res) {
  try {
    const stuckUsers = await User.find({exposure: {$lt: 0}})
    let newResultArray = [];
    if (stuckUsers.length > 0) {
      for (let i = 0; i < stuckUsers.length; i++) {
        const activeBetCount = await Bets.countDocuments({userId: stuckUsers[i].userId, status: 1})
        if (activeBetCount > 0) {
          // stuckUsers.pop(e => e.userId == stuckUsers[i].userId)
          continue;
        } else {
          const inActiveBetCount = await Bets.countDocuments({userId: stuckUsers[i].userId, status: 0})
          // //console.log(inActiveBetCount)
          if (inActiveBetCount > 0) {
            //console.log({inActiveBetCount})
            const newData = {
              name: stuckUsers[i].userName,
              userId: stuckUsers[i].userId,
              exposure: stuckUsers[i].exposure,
              betCount: inActiveBetCount
            }
            newResultArray.push(newData)
          } else {
            continue;
          }
        }
      }
    }
    res.status(200).json({success: true, data: newResultArray})
  } catch (err) {
    res.status(500).json({success: false, msg: "Failed to get "})
  }
}

async function activeUserExposure(req, res) {
  try {
    const stuckUsers = await User.find({exposure: {$gte: 0.1}})
    let newResultArray = []
    if (stuckUsers.length > 0) {
      for (let i = 0; i < stuckUsers.length; i++) {
        const activeBetCount = await Bets.countDocuments({userId: stuckUsers[i].userId, status: 1})
        if (activeBetCount > 0) {
          stuckUsers[i].BetCount = activeBetCount;
          const newData = {
            name: stuckUsers[i].userName,
            userId: stuckUsers[i].userId,
            exposure: stuckUsers[i].exposure,
            betCount: activeBetCount
          }
          newResultArray.push(newData)
        } else {
          continue;
        }
      }
    }
    res.status(200).json({success: true, data: newResultArray})
  } catch (err) {
    res.status(500).json({success: false, msg: "Failed to get "})
  }
}

async function betStatisticsByUserId(req, res) {
  const userId = req.params.userId;

  try {
    const userStats = await Bets.aggregate([
      {
        $match: {userId: parseInt(userId)} // Match bets for the specific user
      },
      {
        $group: {
          _id: "$marketId",
          betIds: {$addToSet: "$_id"},
          totalDifference: {$sum: {$subtract: ["$winningAmount", "$loosingAmount"]}},
          totalExposure: {$sum: {$cond: {if: "$calculateExp", then: "$exposureAmount", else: 0}}},
          winningAmounts: {$addToSet: {$cond: {if: "$calculateExp", then: "$winningAmount", else: 0}}},
          loosingAmounts: {$addToSet: {$cond: {if: "$calculateExp", then: "$loosingAmount", else: 0}}},
          totalPosition: {$sum: {$cond: {if: "$calculateExp", then: "$position", else: 0}}},
          events: {$addToSet: "$event"},
          runnerNames: {$addToSet: "$runnerName"},
        },
      },
      {
        $project: {
          marketId: "$_id",
          betIds: "$betIds",
          totalDifference: "$totalDifference",
          totalExposure: "$totalExposure",
          winningAmounts: "$winningAmounts",
          loosingAmounts: "$loosingAmounts",
          totalPosition: "$totalPosition",
          events: "$events",
          runnerNames: "$runnerNames",
        }
      }
    ]);

    res.status(200).json({success: true, data: userStats});
  } catch (err) {
    res.status(500).json({success: false, msg: "Failed to get Error: " + err.message})
  }
}

async function getCricketScore(req, res) {
  try {
    // const eventId = 32981327
    const response = await axios.get('http://167.99.198.2/api/matches/score/32981327')
    let resultArray = response;
    res.status(200).json({success: true, data: resultArray})
  } catch (err) {
    res.status(500).json({success: false, msg: "Failed to get "})
  }
}

async function testAPI(req, res) {
  const marketId = req.params.marketId;

  try {
    const sportsAPIUrl = "http://185.58.225.212:8080/api";
    const header = {
      headers: {
        'accept': 'application/json',
        'Content-Type': 'application/json',
        'X-App': process.env.XAPP_NAME
      },
    }
    const requestData = {
      "marketIds": [marketId]
      // "maxResults": 100,
      // "maxResults": 100,
      // "marketProjection": ["EVENT", "EVENT_TYPE", "MARKET_START_TIME", "MARKET_DESCRIPTION", "RUNNER_DESCRIPTION"]
    }
    var url = `${sportsAPIUrl}/listMarketCatalogue`;

    const response = await axios.post(
      url,
      requestData,
      header
    );

    const marketsData = response.data;

    res.status(200).json({success: true, data: marketsData});
  } catch (err) {
    res.status(500).json({success: false, msg: "Failed to get Error: " + err.message})
  }
}

async function getMarketsByEventId(req, res) {
  const eventId = req.params.eventId;

  try {
    const sportsAPIUrl = "http://185.58.225.212:8080/api";
    const header = {
      headers: {
        'accept': 'application/json',
        'Content-Type': 'application/json',
        'X-App': process.env.XAPP_NAME
      },
    }
    const requestData = {
      "filter": {
        eventIds: [eventId]
      },
      "maxResults": 200,
      "marketProjection": ["EVENT", "EVENT_TYPE", "MARKET_START_TIME", "MARKET_DESCRIPTION", "RUNNER_DESCRIPTION"]
    }
    var url = `${sportsAPIUrl}/listMarketCatalogue`;

    const response = await axios.post(
      url,
      requestData,
      header
    );

    const marketsData = response.data;

    res.status(200).json({success: true, data: marketsData});
  } catch (err) {
    res.status(500).json({success: false, msg: "Failed to get Error: " + err.message})
  }
}

async function getEventsBySportsId(req, res) {
  const sportsId = req.params.sportsId;

  try {
    const sportsAPIUrl = "http://185.58.225.212:8080/api";
    const header = {
      headers: {
        'accept': 'application/json',
        'Content-Type': 'application/json',
        'X-App': process.env.XAPP_NAME
      },
    }
    const requestData = {
      "filter": {
        eventTypeIds: [sportsId]
      },
    }
    var url = `${sportsAPIUrl}/listEvents`;

    const response = await axios.post(
      url,
      requestData,
      header
    );

    const marketsData = response.data;

    res.status(200).json({success: true, data: marketsData});
  } catch (err) {
    res.status(500).json({success: false, msg: "Failed to get Error: " + err.message})
  }
}

async function getOddsByMarketId(req, res) {
  const marketId = req.params.marketId;

  try {
    const sportsAPIUrl = "http://185.58.225.212:8080/api";
    const header = {
      headers: {
        'accept': 'application/json',
        'Content-Type': 'application/json',
        'X-App': process.env.XAPP_NAME
      },
    }
    const requestData = {
      "marketIds": [marketId]
    }
    var url = `${sportsAPIUrl}/listMarketBook`;

    const response = await axios.post(
      url,
      requestData,
      header
    );

    const marketsData = response.data;

    res.status(200).json({success: true, data: marketsData});
  } catch (err) {
    res.status(500).json({success: false, msg: "Failed to get Error: " + err.message})
  }
}

async function getMarketType(req, res) {
  try {
    const sportsAPIUrl = "http://185.58.225.212:8080/api";
    const header = {
      headers: {
        'accept': 'application/json',
        'Content-Type': 'application/json',
        'X-App': process.env.XAPP_NAME
      },
    }
    const requestData = {
      "filter": {
        eventIds: []
      }
    }
    var url = `${sportsAPIUrl}/listMarketTypes`;

    const response = await axios.post(
      url,
      requestData,
      header
    );
    const marketsData = response.data;

    res.status(200).json({success: true, data: marketsData});
  } catch (err) {
    res.status(500).json({success: false, msg: "Failed to get Error: " + err.message})
  }
}

async function getOddsByMultiMarketId(req, res) {
  const eventId = req.params.eventId;

  try {
    const sportsAPIUrl = "http://185.58.225.212:8080/api";
    const header = {
      headers: {
        'accept': 'application/json',
        'Content-Type': 'application/json',
        'X-App': process.env.XAPP_NAME
      },
    }
    const requestData = {
      "filter": {
        eventIds: [eventId]
      },
      "maxResults": 10,
      "marketProjection": ["EVENT", "EVENT_TYPE", "MARKET_START_TIME", "MARKET_DESCRIPTION", "RUNNER_DESCRIPTION"]
    }
    var url = `${sportsAPIUrl}/listMarketCatalogue`;

    const marketResponse = await axios.post(
      url,
      requestData,
      header
    );

    let marketIds = [];
    for (let i = 0; i < marketResponse?.data?.result?.length; i++) {
      marketIds.push(marketResponse?.data?.result[i].marketId + "")
    }

    const oddsRequestData = {
      "marketIds": marketIds
    }
    var oddsUrl = `${sportsAPIUrl}/listMarketBook`;

    const oddsResponse = await axios.post(
      oddsUrl,
      oddsRequestData,
      header
    );

    const marketsData = oddsResponse?.data?.result;

    res.status(200).json({success: true, data: marketsData});
  } catch (err) {
    res.status(500).json({success: false, msg: "Failed to get Error: " + err.message})
  }
}

async function getTodayEventsBySportsId(req, res) {
  try {
    let sportsId = req.params.sportsId
    var now = new Date();  // Get the current date and time
    var startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    var startOfDayTimestamp = startOfDay.getTime();

    var endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);
    var endOfDayTimestamp = endOfDay.getTime();

    const events = await inPlayEvents.find(
      {
        sportsId: sportsId,
        status: "OPEN",
        openDate: {$gte: startOfDayTimestamp, $lt: endOfDayTimestamp}
      },
      {
        _id: 1,
        Id: 1,
        name: 1,
        openDate: {$toDate: "$openDate"}
      }
    );

    let data = [];

    for (let k = 0; k < events?.length; k++) {
      data.push({
        _id: events[k]._id,
        Id: events[k].Id,
        name: events[k].name,
        openDate: new Date(events[k].openDate)
      })
    }
    res.status(200).json({success: true, data: data});
  } catch (err) {
    res.status(500).json({success: false, msg: "Failed to get Error: " + err.message})
  }
}

async function getMarketsByMarketType(req, res) {
  const eventId = req.params.eventId;
  const marketTypes = req.params.marketTypes?.split(",");

  try {
    const sportsAPIUrl = "http://185.58.225.212:8080/api";
    const header = {
      headers: {
        'accept': 'application/json',
        'Content-Type': 'application/json',
        'X-App': process.env.XAPP_NAME
      },
    }
    let requestData

    if (marketTypes?.length > 0) {
      requestData = {
        "filter": {
          eventIds: [eventId],
          marketTypes: marketTypes
        },
        "maxResults": 100,
        "marketProjection": ["EVENT", "EVENT_TYPE", "MARKET_START_TIME", "MARKET_DESCRIPTION", "RUNNER_DESCRIPTION"]
      }
    } else {
      requestData = {
        "filter": {
          eventIds: [eventId],
        },
        "maxResults": 10,
        "marketProjection": ["EVENT", "EVENT_TYPE", "MARKET_START_TIME", "MARKET_DESCRIPTION", "RUNNER_DESCRIPTION"]
      }
    }

    //console.log("---------------------->", requestData)
    var url = `${sportsAPIUrl}/listMarketCatalogue`;

    const marketResponse = await axios.post(
      url,
      requestData,
      header
    );

    const marketsData = marketResponse?.data?.result;

    res.status(200).json({success: true, data: marketsData});
  } catch (err) {
    res.status(500).json({success: false, msg: "Failed to get Error: " + err.message})
  }
}

async function getFanciesByEventId(req, res) {
  const eventId = req.params.eventId;
  const gtype = req.query.gtype;
  try {
    let sessions = await fetchSession(eventId)
    if (gtype) {
      sessions = sessions.filter(item => item.gtype === gtype)
    }

    res.status(200).json({success: true, data: sessions});
  } catch (err) {
    res.status(500).json({success: false, msg: "Failed to get Error: " + err.message})
  }
}

async function fetchEvents(req, res) {
  const sportsId = req.params.sportsId;
  try {
    await apiSystemRacing.fetchRacingEvent(sportsId)
    res.status(200).json({success: true, message: `Fetched successfully with sportsId: ${sportsId}`});
  } catch (err) {
    res.status(500).json({success: false, message: `Failed to get Error: ${err}`})
  }
}

async function getEventList(req, res) {
  const {sportsId, from, to} = req.body;
  try {
    const now = new Date()
    const fromTimestamp = new Date(now.getTime() - (Number(from) * 24 * 60 * 60 * 1000))
    const someHoursLater = new Date(now.getTime() + (Number(to) * 24 * 60 * 60 * 1000))
    const toTimeStamp = someHoursLater.getTime()

    const events = await InPlayEvents.find({
      sportsId: `${sportsId}`,
      openDate: {$gte: fromTimestamp, $lte: toTimeStamp},
    })

    res.status(200).json({success: true, results: events});
  } catch (err) {
    res.status(500).json({success: false, message: `Failed to get Error: ${err}`})
  }
}

+router.get('/testSports/events', listEvents)
router.get('/track-score/get-cricketscore', getCricketScore)
router.get('/testSports/events', listEvents);
router.get('/testSports/marketbooks/:ids', listMarketBook);
router.get('/trackstuck/activeusers', activeUserExposure);
router.get('/trackstuck/inactiveusers', inActiveUserExposure);
router.get('/track-bet/bet-statistic/:userId', betStatisticsByUserId)

router.get('/track-bet/testAPI/:marketId', testAPI)
router.get('/track-bet/get-markets/:eventId', getMarketsByEventId)
router.get('/track-bet/get-events/:sportsId', getEventsBySportsId)
router.get('/track-bet/get-today-events/:sportsId', getTodayEventsBySportsId)
router.get('/track-bet/get-odds/:marketId', getOddsByMarketId)
router.get('/track-bet/get-odds-multi-marketids/:eventId', getOddsByMultiMarketId)
router.get('/track-bet/get-markettype', getMarketType)
router.get('/track-bet/get-market-by-type/:eventId/:marketTypes?', getMarketsByMarketType)
router.get('/track-bet/get-market-bet-session/:eventId', getFanciesByEventId)

/*admin dashboard*/
router.get('/admin-dashboard/fetch-events/:sportsId', fetchEvents)

router.post('/list-events', getEventList)

module.exports = {router, listEvents, listMarketBook, activeUserExposure, inActiveUserExposure, getCricketScore};

