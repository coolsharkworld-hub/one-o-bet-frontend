"use strict";
const axios = require("axios");
const _ = require("lodash");
require('dotenv').config()

const config = require("../../../config/default.json")
const MarketIDs = require("../../../app/models/marketIds");
const Events = require("../../../app/models/events");
const MarketIDS = require("../../../app/models/marketIds");

const sportsAPIUrl = "http://185.58.225.212:8080/api";
const horseRaceUrl = "http://185.58.225.212:8080/api";

const header = {
  headers: {
    'accept': 'application/json',
    'Content-Type': 'application/json',
    'X-App': process.env.XAPP_NAME
  },
}
let io;

function apiRequestResult() {
  return {
    init,
    getEventResult,
    getRacingResult,
  };

  function init(_io, express) {
    io = _io;
  }

  async function getEventResult(markets) {
    const currentTime = new Date().getTime();
    let marketIdList = [];
    for (const market of markets) {
      marketIdList.push(market.marketId);
      await MarketIDs.findOneAndUpdate({_id: market._id}, {lastResultCheckTime: currentTime})
    }

    const requestData = {
      "marketIds": marketIdList
    }

    const url = `${sportsAPIUrl}/listMarketBook`;
    axios.post(
      url,
      requestData,
      header
    )
      .then(
        async (response) => {
          const results = response.data.result;
          let responseMarketIDs = []
          for (const result of results) {
            const marketIndex = _.findIndex(markets, (o) => o.marketId === result.marketId);

            if (marketIndex === -1) {
              //console.log('Record not found');
              continue;
            }
            responseMarketIDs.push(result.marketId)

            const market = markets[marketIndex];

            if (result.status !== 'CLOSED') continue;

            let winnerSelectionId = result.runners.find(runner => runner.status === 'WINNER')?.selectionId;

            if (!market.runners || !winnerSelectionId) {
              await updateMarketAndEvent(market, winnerSelectionId);
              continue;
            }

            const runnerIndex = _.findIndex(market.runners, (o) => o.SelectionId === winnerSelectionId);

            if (runnerIndex !== -1) {
              winnerSelectionId = market.runners[runnerIndex].runnerName;
            }

            await updateMarketAndEvent(market, winnerSelectionId);
          }

          let difference = marketIdList.filter(x => !responseMarketIDs.includes(x));
          for (const diff of difference) {
            await MarketIDS.updateOne({marketId: diff}, {$set: {readyForScore: false}})
          }

          async function updateMarketAndEvent(market, winnerInfo) {
            await MarketIDs.findOneAndUpdate({_id: market._id}, {$set: {winnerInfo}});

            if (market.marketName === 'Match Odds') {
              await Events.findOneAndUpdate({Id: market.eventId}, {$set: {winner: winnerInfo, isResultSaved: true}});
            } else {
              await Events.findOneAndUpdate({Id: market.eventId}, {$set: {isResultSaved: true}});
            }
          }
        }
      )
      .catch((error) => {
        //console.log(error);
      });
  }

  async function getRacingResult(markets) {

    //console.log('=========== getWaitingResult for Racings');

    const currentTime = new Date().getTime();
    let marketIds = [];
    for (let index = 0; index < markets.length; index++) {
      marketIds.push(markets[index].marketId);
      await MarketIDs.findOneAndUpdate({_id: markets[index]._id}, {lastResultCheckTime: currentTime})
    }

    try {
      const requestData = {
        "marketIds": marketIds
      }
      const url = `${config.newThirdURL}/listMarketBook`;
      let response = await axios.post(
        url,
        requestData,
        header
      );
      const results = response.data.result;
      let responseMarketIDs = []
      for (const result of results) {
        const marketIndex = _.findIndex(markets, (o) => o.marketId === result.marketId);

        if (marketIndex === -1) {
          //console.log('Record not found');
          continue;
        }
        responseMarketIDs.push(result.marketId)

        const market = markets[marketIndex];

        if (result.status !== 'CLOSED') continue;

        let winnerSelectionId = result.runners.find(runner => runner.status === 'WINNER')?.selectionId;

        if (!market.runners || !winnerSelectionId) {
          await updateMarketAndEvent(market, winnerSelectionId);
          continue;
        }

        const runnerIndex = _.findIndex(market.runners, (o) => o.SelectionId === winnerSelectionId);

        if (runnerIndex !== -1) {
          winnerSelectionId = market.runners[runnerIndex].runnerName;
        }

        await updateMarketAndEvent(market, winnerSelectionId);
      }

      let difference = marketIds.filter(x => !responseMarketIDs.includes(x));
      for (const diff of difference) {
        await MarketIDS.updateOne({marketId: diff}, {$set: {readyForScore: false}})
      }

      async function updateMarketAndEvent(market, winnerInfo) {
        await MarketIDs.findOneAndUpdate({_id: market._id}, {$set: {winnerInfo}});

        if (market.marketName === 'Match Odds') {
          await Events.findOneAndUpdate({Id: market.eventId}, {$set: {winner: winnerInfo, isResultSaved: true}});
        } else {
          await Events.findOneAndUpdate({Id: market.eventId}, {$set: {isResultSaved: true}});
        }
      }
    } catch (error) {
      console.error("getRacingResult", error);
    }
  }
}

module.exports = apiRequestResult;
