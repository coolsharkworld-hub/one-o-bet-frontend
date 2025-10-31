'use strict';

const axios = require('axios');

const inPlayEvents = require('../../app/models/events');
const Settings = require('../../app/models/settings');
const MarketIDs = require('../../app/models/marketIds');
const { isIterable, isObjectEqual } = require("../../helper/common");
const {
  getCricketScore
} = require("../../helper/api/hybridApiHelper");
const { getCricketScoreAPI } = require("../../helper/api/scoreApiHelper");
const { convertApiToCricket, convertCricketToFront } = require("../../helper/schema/cricket");
const Crickets = require("../../app/models/Crickets");
const { calculateSessionNo } = require("../../helper/cricket");
const Session = require("../../app/models/Session");
const _ = require('lodash')
const { fetchScoreSessionApi, convertSessionScoreToCricket } = require("../../helper/api/sessionAPIHelper");
require('dotenv').config()

const activeCrickets = new Map()

const HYBRID_PROVIDER = process.env.HYBRID_PROVIDER || 'pys'

let io;

function ToolForScraper() {
  return { init };

  async function init(_io, express) {
    io = _io;

    // fetchCricketScoreFromApi()
    fetchCricketScoreFromScoreApi()
  }

  function convertSchema(entity, eventId) {
    // 511-10 (144.0) & 17-1 (5.2)
    const parseScore = (score) => {
      const lastScore = score.split('&').pop().trim()
      return lastScore
    }

    return {
      eventId: eventId,
      seriesKey: entity.seriesKey,
      score: {
        activenation1: 1,
        activenation2: 0,
        balls: [],
        overScore: 0,
        inning: 1,
        dayno: "",
        comment: entity?.data?.msg,
        isfinished: "0",
        score1: parseScore(entity?.data?.teams[0]?.score),
        score2: parseScore(entity?.data?.teams[1]?.score),
        spnballrunningstatus: '',
        spnmessage: "",
        spnnation1: entity?.data?.teams[0]?.team_name,
        spnnation2: entity?.data?.teams[1]?.team_name,
        spnreqrate1: `RRR ${entity?.data?.requireRunRate}`,
        spnreqrate2: `RRR ${entity?.data?.requireRunRate}`,
        spnrunrate1: `CRR ${entity?.data?.currentRunRate}`,
        spnrunrate2: `CRR ${entity?.data?.currentRunRate}`,
      }
    };
  }

  async function fetchCricketScoreFromApi() {
    try {
      const nowTimeStamp = new Date().getTime()
      const needApiScore = (nowTimeStamp - global.cricketScraperLastupdate) > 6 * 1000
      // const needApiScore = true
      if (!needApiScore) {
        const cricketScoreSourceSetting = await Settings.findOne({
          settingKey: 'CRICKET_SCORECARD_SOURCE'
        })
        if (cricketScoreSourceSetting?.settingValue !== 'API') {
          return
        }
      }
      /* temp code start */
      // const cricketScoreSourceSetting = await Settings.findOne({
      //   settingKey: 'CRICKET_SCORECARD_SOURCE'
      // })
      // if (cricketScoreSourceSetting?.settingValue !== 'API') {
      //   return
      // }
      /* temp code end */
      let inPlayEventList = await inPlayEvents.find({
        sportsId: '4', isShowed: true,
        CompanySetStatus: "OPEN",
        status: 'OPEN',
        inplay: true,
      }, { Id: 1 }).exec();

      for (const event of inPlayEventList) {
        const eventId = event.Id
        let cricketScore = await getCricketScore(eventId)
        if (cricketScore?.data) {
          const score = convertSchema(cricketScore, eventId)
          // io.to('#' + eventId).emit('cricket_score', score);
          io.emit('cricket_score', score);
        }
      }

    } catch (error) {
      console.error("Error fetchCricketScoreFromApi:", error);
    } finally {
      setTimeout(fetchCricketScoreFromApi, 3000)
    }
  }

  async function fetchCricketScoreFromScoreApi() {
    try {
      let inPlayEventList = await inPlayEvents.find({
        sportsId: '4', isShowed: true,
        CompanySetStatus: "OPEN",
        status: 'OPEN',
        inplay: true,
      }, { Id: 1 }).exec();

      const cricketScoreSourceSetting = await Settings.findOne({
        settingKey: 'CRICKET_SCORECARD_SOURCE'
      })

      for (const event of inPlayEventList) {
        const eventId = event.Id
        let cricketScoreData = null
        if (cricketScoreSourceSetting?.settingValue === 'SESSION') {
          cricketScoreData = await fetchScoreSessionApi(eventId)
        } else {
          cricketScoreData = await getCricketScoreAPI(eventId)
        }
        if (cricketScoreData?.data) {
          let apiCricketScore
          if (cricketScoreSourceSetting?.settingValue === 'SESSION') {
            apiCricketScore = convertSessionScoreToCricket(cricketScoreData, event)
          } else {
            apiCricketScore = convertApiToCricket(cricketScoreData, eventId)
          }

          if (!activeCrickets.has(eventId) || !isObjectEqual(activeCrickets.get(eventId), apiCricketScore)) {
            activeCrickets.set(eventId, apiCricketScore)
            const cricketScore = await Crickets.findOneAndUpdate(
              { eventId: apiCricketScore.eventId },
              apiCricketScore,
              { upsert: true, new: true, setDefaultsOnInsert: true }
            );
            if (eventId) {
              const type = cricketScore.type
              let divider = 5
              if (type === 'TEST') divider = 10
              const over = (cricketScore.activeTeam === cricketScore.team1ShortName) ? cricketScore.over1 : cricketScore.over2
              const currentOver = parseInt(over?.split(".")[0])
              const currentBall = parseInt(over?.split(".")[1])
              if (((currentOver % divider) === 0) && (currentBall === 0 || currentBall === '0')) {
                const score = (cricketScore.activeTeam === cricketScore.team1ShortName) ? cricketScore.score1 : cricketScore.score2
                let currentScore = parseInt(score?.split("/")[0])
                const sessionNo = calculateSessionNo(cricketScore)
                await Session.findOneAndUpdate(
                  {
                    eventId: parseInt(eventId),
                    sessionNo: sessionNo,
                  },
                  {
                    $set: {
                      scrap_session_score: `${currentScore}`,
                      score: currentScore,
                      api_session_score: `${currentScore}`,
                    },
                  }
                );
              }

              const frontScore = convertCricketToFront(cricketScore)
              io.emit('cricket_score_api', frontScore);
            }
          }
        }
      }

    } catch (error) {
      console.error("Error fetchCricketScoreFromScoreApi:", error);
    } finally {
      setTimeout(fetchCricketScoreFromScoreApi, 3000)
    }
  }
}

module.exports = ToolForScraper;
