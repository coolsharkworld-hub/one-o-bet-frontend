"use strict";
const MarketIDs = require("../../app/models/marketIds");
const inPlayEvents = require("../../app/models/events");
module.exports = ToolForResult;

const sportsIds = ['4339', '7'];
const HORSE_RACE_SPORTS_ID = '7';
const GREY_HOUND_ID = '4339'

const apiRequestResult = require("./api/apiRequestResult")();

function ToolForResult() {
  return {init};

  async function init(_io, express) {
    apiRequestResult.init(_io, express);

    fetchResults()
    fetchRacingResult()
  }

  async function fetchResults() {
    // //console.log("running fetch results")
    try {
      const eventMarkets = await MarketIDs.find({
        readyForScore: true,
        status: 'CLOSED',
        sportID: {$in: [1, 2, 4]},
        winnerInfo: null
      }).sort({lastResultCheckTime: 1}).limit(10).exec();

      if (eventMarkets.length > 0) {
        await apiRequestResult.getEventResult(eventMarkets);
      }

    } catch (error) {
      console.error("fetchResults error", error);
    } finally {
      setTimeout(() => {
        fetchResults();
      }, 10000);
    }
  }

  async function fetchRacingResult_old() {
    try {
      for (const id of sportsIds) {
        const documents = await inPlayEvents.find({status: 'CLOSED', sportsId: id})
          .sort({lastCheckMarket: 1})
          .limit(10)
          .exec();

        for (const document of documents) {
          if (document) {
            await apiRequestResult.getRacingResult(document.Id, document.sportsId, document.competitionId);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching markets racing result:', error);
    } finally {
      setTimeout(() => {
        fetchRacingResult();
      }, 3000);
    }
  }

  async function fetchRacingResult() {
    try {
      const racingMarkets = await MarketIDs.find({
        readyForScore: true,
        status: 'CLOSED',
        sportID: {$in: [4339, 7]},
        winnerInfo: null
      }).sort({lastResultCheckTime: 1}).limit(10).exec();
      if (racingMarkets.length > 0)
        await apiRequestResult.getRacingResult(racingMarkets);
    } catch (error) {
      console.error('Error fetching markets racing result:', error);
    } finally {
      setTimeout(() => {
        fetchRacingResult();
      }, 3000);
    }
  }
}
