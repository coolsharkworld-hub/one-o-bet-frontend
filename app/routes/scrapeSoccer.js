const express = require('express');
let config = require('config');
const soccerRouter = express.Router();
const Score = require('../models/score')
const inPlayEvents = require("../models/events");

async function updateSoccerScore(req, res) {
  const {type, entities} = req.body;
  const io = req.io
  io.on('connected', () => {
    //console.log('connected')
  })

  if (type === 'live') {
    io.emit('soccer_score', entities)
  }

  try {
    if (type === 'initial') {
      for (const item of entities) {
        await Score.findOneAndUpdate(
          {scoreKey: item.scoreKey},
          {$set: {data: item, sportsId: '1', scoreKey: item.scoreKey}},
          {upsert: true, new: false, setDefaultsOnInsert: true}
        );
      }
      return res.status(200).json({
        success: true,
        message: 'updated matches ',
      });
    } else if (type === 'live') {
      for (const item of entities) {
        await Score.findOneAndUpdate(
          {scoreKey: item.scoreKey},
          {$set: {data: item, sportsId: '1', scoreKey: item.scoreKey}},
          {upsert: true, new: true, setDefaultsOnInsert: true}
        );
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
      message: 'Failed to update soccer score',
      error: error.message,
    });
  }
}

soccerRouter.post('/update_soccer', updateSoccerScore);

module.exports = {soccerRouter};
