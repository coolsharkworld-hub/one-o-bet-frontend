//console.log("How it can happen....11");
const axios = require("axios");
const MarketIDs = require("../../../app/models/marketIds");
const Events = require("../../../app/models/events");

export async function getEventResult(markets) {
  //console.log('getWaitingResult for Events ');

  const currentTime = new Date().getTime();
  var marketIds = [];
  for (let index = 0; index < markets.length; index++) {
    marketIds.push(markets[index].marketId);
    await MarketIDs.findOneAndUpdate({_id: markets[index]._id}, {lastResultCheckTime: currentTime})
  }

  ////console.log(marketIds);
  
  var url = `${sportsAPIUrl}/results/?ids=` + marketIds.join(',');
  
  try {
    const response = await axios.get(url);
    const results = response.data;
    ////console.log(results);
    for (let index = 0; index < results.length; index++) {
      const result = results[index];
      const marketIndex = _.findIndex(markets, function (o) {
        return o.marketId == result.marketId;
      });
      if (marketIndex != -1) {
        if (result.winnerSelectionId == '-1') {
          await MarketIDs.findOneAndUpdate({_id: markets[marketIndex]._id}, {$set: {winnerInfo: 'Canceled'}});

          if (markets[marketIndex].marketName == 'Match Odds') {
            await Events.findOneAndUpdate({Id: markets[marketIndex].eventId}, {$set: {winner: 'Canceled'}});
          }

          continue;
        }
        if (typeof markets[marketIndex].runners !== 'undefined') {
          const runnerIndex = _.findIndex(markets[marketIndex].runners, function (o) {
            return o.SelectionId == result.winnerSelectionId;
          });
          if (runnerIndex != -1) {
            await MarketIDs.findOneAndUpdate({_id: markets[marketIndex]._id}, {$set: {winnerInfo: markets[marketIndex].runners[runnerIndex].runnerName}});
            if (markets[marketIndex].marketName == 'Match Odds') {
              await Events.findOneAndUpdate({Id: markets[marketIndex].eventId}, {$set: {winner: markets[marketIndex].runners[runnerIndex].runnerName}});
            }
          } else {
            await MarketIDs.findOneAndUpdate({_id: markets[marketIndex]._id}, {$set: {winnerInfo: result.winnerSelectionId}});
            if (markets[marketIndex].marketName == 'Match Odds') {
              await Events.findOneAndUpdate({Id: markets[marketIndex].eventId}, {$set: {winner: result.winnerSelectionId}});
            }
          }
        } else {
          await MarketIDs.findOneAndUpdate({_id: markets[marketIndex]._id}, {$set: {winnerInfo: result.winnerSelectionId}});
          if (markets[marketIndex].marketName == 'Match Odds') {
            await Events.findOneAndUpdate({Id: markets[marketIndex].eventId}, {$set: {winner: result.winnerSelectionId}});
          }
        }

        await Events.findOneAndUpdate({Id: markets[marketIndex].eventId}, {$set: {isResultSaved: true}});

      } else {
        //console.log('Record not found');
      }
    }
  } catch (error) {
    //console.log(error);
  }
}
