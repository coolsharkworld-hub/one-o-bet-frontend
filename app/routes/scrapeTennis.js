const express = require('express');
let config = require('config');
const tennisRouter = express.Router();
const Score = require('../models/score')

async function updateTennisScore(req, res) {
  const {type, entities} = req.body;
  const io = req.io
  io.on('connected', () => {
    //console.log('connected')
  })

  if (type === 'live') {
    io.emit('tennis_score', entities)
  }

  try {
    if (type === 'initial') {
      for (const item of entities) {
        await Score.findOneAndUpdate(
          {scoreKey: item.scoreKey},
          {$set: {data: item, sportsId: '2', scoreKey: item.scoreKey}},
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
          {$set: {data: item, sportsId: '2', scoreKey: item.scoreKey}},
          {upsert: true, new: true, setDefaultsOnInsert: true}
        );
      }

      return res.status(200).json({
        success: true,
        message: 'updated tennis matches',
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
      message: 'Failed to update tennis score',
      error: error.message,
    });
  }
}

tennisRouter.post('/update_tennis', updateTennisScore);

module.exports = {tennisRouter};
