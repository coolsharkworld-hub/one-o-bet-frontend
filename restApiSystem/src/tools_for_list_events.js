'use strict';
module.exports = ToolForEvent;

// const sportsIds = ["1", "7522", "2", "4", "27454571", "468328"];
const sportsIds = ["1", "2", "4"];

const inPlayEvents = require('../../app/models/events');
const MarketIDs = require('../../app/models/marketIds');
const Odds = require('../../app/models/odds');
const config = require("../../config/default.json")

const apiRequests = require('./api/apiRequestsTestSCT.js')();
const {CRICKET_LIVE_SET_MIN, SOCCER_LIVE_SET_MIN, TENNIS_LIVE_SET_MIN} = require('../../helper/constants')
const moment = require("moment/moment");

let lastType = 0;

function ToolForEvent() {
  return {init};

  async function init(_io, express) {
    apiRequests.init(_io, express);

    if (config.activeProvider === 'NEW') {
      fetchEvents();
      setBrokenRecord();

      setInterval(fetchEvents, 6 * 60 * 60 * 1000);
      setInterval(fetchMarkets, 10 * 1000);
      // setInterval(handleSetInplay, 10 * 1000);

      setInterval(() => {
        for (const sportsId of sportsIds) {
          apiRequests.setInplay(sportsId);
        }
      }, 10 * 1000);

      setInterval(async () => {
        for (const sportsId of sportsIds) {
          await apiRequests.checkInPlay(sportsId);
        }
      }, 30 * 1000);

      setInterval(() => {
        fetchOdds(true);
      }, 1500);

      setInterval(() => {
        setBrokenRecord();
      }, 10 * 60 * 1000);
    }
  }

  async function setBrokenRecord() {
    const checkOldRecordWithoutReady = await MarketIDs.find({
      readyForScore: { $ne: true },
      winnerInfo: null,
      runners: { $ne: null },
      status: { $ne: 'OPEN' }
    });

    for (let index = 0; index < checkOldRecordWithoutReady.length; index++) {
      const element = checkOldRecordWithoutReady[index];
      await MarketIDs.updateOne({ _id: element._id }, { $set: { readyForScore: true } });
    }
  }

  async function fetchEvents() {
    try {
      for (const sportsId of sportsIds) {
        await apiRequests.eventsBySupportJobs(sportsId);
      }
    } catch (error) {
      console.error('Error fetching events:', error);
    }
  }

  async function fetchMarkets() {
    try {
      for (const id of sportsIds) {
        let documents = null
        if (id === "4") {
          documents = await inPlayEvents.findOne({
            status: 'OPEN',
            CompanySetStatus: "OPEN",
            isShowed: true,
            sportsId: id
          })
            .sort({lastCheckMarket: 1})
            .limit(1)
            .exec();
        } else {
          const now = new Date()
          const from = new Date(now.getTime() - (30 * 60 * 1000))
          const someHoursLater = new Date(now.getTime() + 10 * 60 * 60 * 1000)
          const to = someHoursLater.getTime()
          documents = await inPlayEvents.findOne({
            status: 'OPEN',
            CompanySetStatus: "OPEN",
            isShowed: true,
            openDate: {$gte: from, $lte: to},
            sportsId: id
          })
            .sort({lastCheckMarket: 1})
            .limit(1)
            .exec();
        }

        if (documents && documents.Id) {
          const sportsId = documents.sportsId
          if (['1', '2', '4'].includes(sportsId)) {
            const openDate = Number(documents.openDate)
            const now = moment().utc().valueOf()
            let limitMin = 0
            switch (sportsId) {
              case '1':
                limitMin = SOCCER_LIVE_SET_MIN
                break
              case '2':
                limitMin = TENNIS_LIVE_SET_MIN
                break
              case '4':
                limitMin = CRICKET_LIVE_SET_MIN
                break
            }
            if (((openDate - now) < (limitMin * 60 * 1000)) && ((openDate - now) > 0)) {
              await inPlayEvents.updateOne(
                {Id: documents.Id},
                {$set: {inplay: true}}
              );
            }
          }
          await inPlayEvents.updateMany(
            { Id: documents.Id },
            { $set: { lastCheckMarket: Date.now() } }
          );
          const existedMarkets = await MarketIDs.findOne({
            eventId: documents.Id, status: "OPEN", inPlay: true,
            $and: [
              {marketName: {$ne: 'BOOKMAKER'}},
              {marketName: {$ne: null}},
            ]
          })

          if (documents && !existedMarkets?._id) {
            await apiRequests.listMarketsByCronJob(documents.Id, documents.sportsId, documents.competitionId);
            // fetchOddsForEvent(documents.Id);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching markets:', error);
    }
  }

  async function fetchOddsForEvent(eventId) {
    try {
      const documents = await MarketIDs.find({inPlay: true, eventId: eventId})
        .sort({lastCheck: 1})
        .limit(20)
        .exec();
      let marketIds = [];

      if (documents.length > 0) {
        documents.forEach(element => {
          marketIds.push(element.marketId);
        });
      }

      await MarketIDs.updateMany(
        {marketId: {$in: marketIds}},
        {$set: {lastCheck: Date.now()}}
      );

      if (marketIds.length > 0) {
        apiRequests.getOddsFromProvider(documents, eventId);
      }
    } catch (error) {
      console.error('Error fetching odds for event:', error);
    }
  }

  async function fetchOdds(inPlay) {
    try {
      const documents = await MarketIDs.aggregate([
        {
          $match: {
            inPlay: inPlay,
            status: {$in: ['INACTIVE', 'OPEN', 'SUSPENDED']},
            $or: [
              {sportID: 1},
              {sportID: 2},
              {sportID: 4},
            ],
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
                  $eq: [{$type: "$event"}, "array"]
                },
                then: {$arrayElemAt: ["$event", 0]},
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
          $sort: {lastCheck: 1},
        },
        {
          $limit: 30,
        }
      ]).exec();

      let marketIds = [];

      if (documents.length > 0) {
        documents.forEach(element => {
          marketIds.push(element.marketId);
        });
      }

      await MarketIDs.updateMany(
        {marketId: {$in: marketIds}},
        {$set: {lastCheck: Date.now()}}
      );

      if (marketIds.length > 0) {
        apiRequests.getOddsFromProvider(documents);
      }
    } catch (error) {
      console.error('Error fetching odds:', error);
    }
  }

  async function handleSetInplay() {
    const documents = await inPlayEvents.find({isShowed: true, inplay: false})
      .limit(20)
      .exec();

    if (documents.length > 0) {
      for (const document of documents) {
        await inPlayEvents.updateOne(
          {Id: document.Id}, {$set: {inplay: true}}
        )
      }
    }
  }
}
