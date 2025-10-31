const config = require("config");
const axios = require("axios");
const FancyGames = require("../models/fancyGames");
const Odds = require("../models/odds");
const Events = require("../models/events");
const RaceMarkets = require("../models/raceMarkets");
const RaceOdds = require("../models/raceOdds");
const AsianTableOdd = require("../models/asiantableOdds");
/* 
Get data for these sports
   1. Cricket 
   2. Soccer 
   3. Tennis
*/
async function listOdds(eventId) {
  try {
    let oddsProjection = {
      _id: 1,
      eventId: 1,
      marketId: 1,
      status: 1,
      isInplay: 1,
      inplay: 1,
      marketName: 1,
      runners: 1,
    };

    let fancyDataProjection = {
      _id: 1,
      t3: 1,
      "t2.bm1": 1, // Include only the bm1 field within t2 array
    };

    const odds = await Odds.findOne({ eventId: eventId }, oddsProjection).sort({
      createdAt: -1,
    });
    const fancyData = await FancyGames.findOne(
      { eventId: eventId },
      fancyDataProjection
    ).sort({ createdAt: -1 });
    let liveSportScoreData;
    const event = await Events.findOne(
      { Id: eventId },
      {
        _id: 1,
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
      liveSportScoreData = await cricketLiveScore(eventId);
    } else {
      liveSportScoreData = await otherLiveScore(eventId);
    }
    return {
      success: true,
      message: "Records",
      results: {
        odds: odds ? [odds] : [],
        fancyData: fancyData ? [fancyData] : [],
        livesportscoreData: liveSportScoreData,
        matchData: event,
      },
    };
  } catch (error) {
    console.error("Error retrieving odds:", error);
    return {
      success: false,
      message: "Error retrieving odds",
    };
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
        ?.replaceAll(/[\s-]/g, ",")
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
              ?.replaceAll(/[\s-]/g, ",")
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
        ?.replaceAll(/[\s-]/g, ",")
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
      const event = await Events.findOne(
        { Id: id },
        { _id: 0, matchType: 1, sportsId: 1 }
      );
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

/* 
Get data for these sports
   1. Gray Hound 
   2. Horse Race
*/
async function racesMarketOdds(marketId) {
  try {
    // const projectionRacesMarketsData = {
    //   'eventNodes.marketNodes.state': 1,
    //   'eventNodes.marketNodes.description.marketName': 1,
    //   'eventNodes.marketNodes.description.marketTime': 1,
    //   'eventNodes.marketNodes.description.suspendTime': 1,
    //   'eventNodes.marketNodes.description.turnInPlayEnabled': 1,
    //   'eventNodes.marketNodes.description.marketType': 1,
    //   'eventNodes.marketNodes.description.raceNumber': 1,
    //   'eventNodes.marketNodes.description.raceType': 1,
    //   'eventNodes.marketNodes.description.bettingType': 1,
    //   'eventNodes.marketNodes.runners.selectionId': 1,
    //   'eventNodes.marketNodes.runners.description.runnerName': 1,
    //   'eventNodes.marketNodes.runners.description.metadata.SIRE_NAME': 1,
    //   'eventNodes.marketNodes.runners.description.metadata.CLOTH_NUMBER_ALPHA': 1,
    //   'eventNodes.marketNodes.runners.description.metadata.COLOURS_DESCRIPTION': 1,
    //   'eventNodes.marketNodes.runners.description.metadata."COLOURS_FILENAME': 1,
    //   'eventNodes.marketNodes.runners.description.metadata.OWNER_NAME': 1,
    //   'eventNodes.marketNodes.runners.description.metadata.JOCKEY_NAME': 1,
    //   'eventNodes.marketNodes.runners.description.metadata.CLOTH_NUMBER': 1,
    //   'eventNodes.marketNodes.runners.description.metadata.TRAINER_NAME': 1,
    //   'eventNodes.event.eventName': 1
    // };

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
      "eventNodes.marketNodes.marketId": marketId,
    });
    const raceOddsData = await RaceOdds.findOne(
      { marketId: marketId },
      projectionRaceOddsData
    ).sort({ _id: -1 });
    //console.log(">> racesMarketsData ==>", racesMarketsData);
    //console.log(">> raceOddsData ==>", raceOddsData);
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
    const matchId = await Events.findOne({ marketIds: { $in: marketId } });

    //console.log("matchId", matchId);
    //console.log("raceOddsData ===>", raceOddsData);
    return {
      success: true,
      message: "Records",
      results: {
        // racesMarketsData,
        raceOddsData,
        matchData: matchId,
      },
    };
  } catch (error) {
    console.error("Error retrieving races:", error);
    return {
      success: false,
      message: "Error retrieving races",
    };
  }
}

async function asianOdd(tableId) {
  try {
    const asianTableOdd = await AsianTableOdd.findOne({ tableId: tableId });

    if (asianTableOdd) {
      res.status(200).json({
        success: true,
        message: "Asian Odd table with tableId",
        asianTableOdd: asianTableOdd,
      });
    } else {
      res.status(200).json({
        success: true,
        message: "There is no asian table with this tableId",
        asianTableOdd: [],
      });
    }
  } catch (error) {
    console.error("Error retrieving odds:", error);
    return {
      success: false,
      message: "Error retrieving asian odds",
    };
  }
}

module.exports = { listOdds, racesMarketOdds, asianOdd };
