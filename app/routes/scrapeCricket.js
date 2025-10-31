const express = require('express');
let config = require('config');
const cricketRouter = express.Router();
const Crickets = require('../models/Crickets')
const Session = require("../models/Session");
const {calculateSessionNo} = require("../../helper/cricket");
const {getCricketScore} = require("../../helper/api/hybridApiHelper");

const convertSchema = (entity) => {
  const overs = entity.overs || [];
  const lastOver = overs.at(-1);
  if (!lastOver) return undefined;

  const getTeamRate = (rateType, activeTeamNo) => {
    const activeTeam = activeTeamNo === 1 ? entity.team1SName : entity.team2SName;
    return lastOver.team === activeTeam ? `${rateType} ${entity[rateType]}` : "";
  };

  const getScore = (score, over) => {
    const regex = /-?\d+(\.\d+)?/g;
    const matches = score.match(regex) || [0, 0, '0.0'];
    return `${matches[0]}-${matches[1]} (${over})`;
  };

  return {
    eventId: 0,
    seriesKey: entity.seriesKey,
    score: {
      activenation1: 1,
      activenation2: 0,
      balls: lastOver.info,
      overScore: lastOver.total,
      team1Flag: entity.team1Flag,
      team2Flag: entity.team2Flag,
      inning: entity.inning,
      dayno: "",
      isfinished: "0",
      comment: entity.comment || "",
      score1: getScore(entity.score1, entity.over1),
      score2: getScore(entity.score2, entity.over2),
      spnballrunningstatus: entity.result,
      spnmessage: "",
      spnnation1: entity.team1SName,
      spnnation2: entity.team2SName,
      spnreqrate1: getTeamRate("RRR", 1),
      spnreqrate2: getTeamRate("RRR", 2),
      spnrunrate1: getTeamRate("CRR", 1),
      spnrunrate2: getTeamRate("CRR", 2),
    }
  };
}

async function updateCricketData(req, res) {
  const {type, entities} = req.body;
  const io = req.io
  io.on('connected', () => {
    //console.log('connected')
  })

  if (type === 'live') {
    const socketData = convertSchema(entities)
    if (socketData) {
      // //console.log('cricket live socket', socketData)
      io.emit('score', socketData)
    }
  }

  if (type === 'alive') {
    global.cricketScraperLastupdate = new Date().getTime()
    return res.status(200).json({
      success: true,
      message: 'updated last update ',
    });
  }

  try {
    if (type === 'matches') {
      for (const item of entities) {
        await Crickets.findOneAndUpdate(
          {seriesKey: item.seriesKey},
          item,
          {upsert: true, new: false, setDefaultsOnInsert: true}
        );
      }
      return res.status(200).json({
        success: true,
        message: 'updated matches ',
      });
    } else if (type === 'live') {
      const cricketScore = await Crickets.findOneAndUpdate(
        {seriesKey: entities.seriesKey},
        entities,
        {upsert: true, new: true, setDefaultsOnInsert: true}
      );
      const eventId = cricketScore.eventId
      if (eventId) {
        const type = cricketScore.type
        let divider = 5
        if (type === 'TEST') divider = 10
        const over = cricketScore.over1
        const currentOver = parseInt(over.split(".")[0])
        const currentBall = parseInt(over.split(".")[1])
        if (((currentOver % divider) === 0) && (currentBall === 0 || currentBall === '0')) {
          const score = cricketScore.score1
          let currentScore = parseInt(score.split("/")[0])
          const sessionNo = calculateSessionNo(cricketScore)
          const apiScoreRes = await getCricketScore(eventId)
          const apiScore = apiScoreRes?.data?.current_score?.split('-')[0]
          await Session.findOneAndUpdate(
            {
              eventId: parseInt(eventId),
              sessionNo: sessionNo,
            },
            {
              $set: {
                scrap_session_score: `${currentScore}`,
                api_session_score: `${apiScore}`,
              },
            }
          );
        }
      }

      return res.status(200).json({
        success: true,
        message: 'updated matches ',
      });
    } else {
      return res.status(200).json({
        success: false,
        message: 'incorrect filed',
      });
    }

  } catch (error) {
    console.error(error);
    return res.status(200).json({
      success: false,
      message: 'Failed to update cricket data ',
      error: error.message,
    });
  }
}

cricketRouter.post('/update_cricket', updateCricketData);

module.exports = {cricketRouter};
