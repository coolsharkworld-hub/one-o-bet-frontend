'use strict';
// const cron = require('node-cron');
const config = require("../../config/default.json")
const inPlayEvents = require('../../app/models/events');
// const RaceMarkets = require('../../app/models/raceMarkets.js');
const apiRequests = require('./api/apiRequestsUpdatedRacing.js')();

const sportsIds = ['4339', '7'];
// const sportsIds = ['4339'];
// const HORSE_RACE_SPORTS_ID = '7';
// const GREY_HOUND_ID = '4339'

function ToolForUpdatedRacing() {
  return {init, fetchRacingEvent};

  async function init(_io, express) {
    apiRequests.init(_io);

    if (config.activeProvider === 'NEW') {
      getRacing()
      fetchMarkets()
      setInterval(getRacing, 6 * 60 * 60 * 1000)
      setInterval(() => fetchMarkets(), 10 * 1000);
      setTimeout(() => {
        setInterval(apiRequests.checkOdds, 2 * 1000);
      }, 1000 * 10); // Delayed by 1 second
    }
  }

  async function fetchMarkets() {
    try {
      for (const id of sportsIds) {
        const now = new Date()
        const from = new Date(now.getTime() - (30 * 60 * 1000))
        const fiveHoursLater = new Date(now.getTime() + 10.5 * 60 * 60 * 1000)
        const to = fiveHoursLater.getTime()

        const documents = await inPlayEvents.find({
          status: 'OPEN',
          CompanySetStatus: "OPEN",
          openDate: {$gte: from, $lte: to},
          sportsId: id
        })
          .sort({lastCheckMarket: 1, openDate: -1})
          .limit(config.raceEventsMarketAllowedCount)
          .exec();

        for (const document of documents) {
          /*removed the check to know if system already fetch market*/
          await inPlayEvents.updateMany(
            {Id: document.Id},
            {$set: {lastCheckMarket: Date.now()}}
          )
          await apiRequests.listMarketsByCronJob(document.Id, document.sportsId, document.competitionId)
          /*old revision*/
          // const existedMarkets = await RaceMarkets.findOne({"eventNodes.eventId": documents[i]?.Id})
          //
          // if (documents[i] && !existedMarkets?._id) {
          //   await inPlayEvents.updateMany(
          //     {Id: documents.Id},
          //     {$set: {lastCheckMarket: Date.now()}}
          //   );
          //   await apiRequests.listMarketsByCronJob(documents[i].Id, documents[i].sportsId, documents[i].competitionId);
          //   // fetchOddsForEvent(documents.Id);
          // }
        }
      }
    } catch (error) {
      console.error('Error fetching markets:', error);
    }
  }

  async function getRacing() {
    for (const sportsId of sportsIds) {
      await apiRequests.eventsBySupportJobs(sportsId);
    }
  }

  async function fetchRacingEvent(sportsId) {
    await apiRequests.eventsBySupportJobs(sportsId);
  }
}

module.exports = ToolForUpdatedRacing;