const {listMarketCatalogue} = require("./api/SBApiHelper");
const config = require("../config/default.json");
const MarketIDS = require("../app/models/marketIds");
const inPlayEvents = require("../app/models/events");
const {SPORT_SOCCER, SPORT_TENNIS, SPORT_CRICKET} = require('./constants')

const fetchMarket = async (event) => {
  const eventId = event.Id
  const sportsId = event.sportsId
  try {
    await inPlayEvents.updateMany(
      {Id: eventId},
      {$set: {lastCheckMarket: Date.now()}}
    );
    const marketsData = await listMarketCatalogue(eventId);
    if (!marketsData.length) return;

    let marketStatus = 'PENDING';
    let marketIds = [];


    marketsData.forEach((market) => {
      if (config.activeProvider === 'old') {
        marketStatus = market.status;
      }

      const runners = market.runners?.map(runner => ({
        SelectionId: runner?.selectionId,
        runnerName: runner?.runnerName,
      }));

      if ((sportsId === SPORT_SOCCER && ["Match Odds", "Over/Under 0.5 Goals", "Over/Under 1.5 Goals", "Over/Under 2.5 Goals"].includes(market.marketName)) ||
        (sportsId === SPORT_TENNIS && market.marketName === "Match Odds") ||
        (sportsId === SPORT_CRICKET && ["Match Odds", "Tied Match", "To Win the Toss"].includes(market.marketName))) {
        marketIds.push({
          id: market.marketId,
          marketName: market.marketName,
          status: marketStatus,
          runners
        });
      }
    });

    await processMarketIds(eventId, marketIds, sportsId);
  } catch (err) {
    return {
      success: false,
      message: "Failed to get listMarketsByCronJob",
      error: err?.message,
    };
  }
};

const processMarketIds = async (eventId, marketIds, sportsId) => {
  for (let index = 0; index < marketIds.length; index++) {
    const market = marketIds[index]
    const marketID = await MarketIDS.findOne({ eventId: eventId, marketId: `${market.id}` });

    if (!marketID) {
      await handleNewMarket(eventId, market, index, sportsId);
    } else {
      await MarketIDS.findOneAndUpdate(
        { eventId: eventId, marketId: `${market.id}` },
        { status: market.status, sportID: Number(sportsId), }
      );
    }
  }

  await inPlayEvents.findOneAndUpdate({ Id: eventId }, { marketIds });
};

const handleNewMarket = async (eventId, market, index, sportsId) => {
  const countOfMarket = await MarketIDS.countDocuments({ eventId: eventId, status: "OPEN" });

  const allowedCount = sportsId === SPORT_SOCCER ? config.soccerEventsAllowedCount :
    sportsId === SPORT_TENNIS ? config.tennisEventsAllowedCount :
      sportsId === SPORT_CRICKET ? config.cricketEventsAllowedCount :
        config.allSportsEventsAllowedCount;

  if (countOfMarket > allowedCount) return;

  const newMarket = new MarketIDS({
    eventId,
    marketId: market.id + "",
    marketName: market.marketName,
    sportID: Number(sportsId),
    totalMatched: market.totalMatched,
    status: market.status,
    index,
    runners: market.runners,
    inPlay: true
  });
  await newMarket.save();
};

module.exports = {fetchMarket}
