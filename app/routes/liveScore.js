const express = require('express');
let config = require('config');
const axios = require('axios');
const loginRouter = express.Router();
async function liveScore(req, res) {
  const matchId = req.params.matchId;
  const url = `${config.liveScoreUrl}/${matchId}`;
  try {
    const response = await axios.get(url);
    //console.log('response', response.data);
    const liveScore = response.data;

    res.status(200).json({
      success: true,
      message: 'Live Score Record Found ',
      fancyData: liveScore,
    });
  } catch (error) {
    console.error(error);
    res.status(200).json({
      success: false,
      message: 'Failed to get live score ',
      error: error.message,
    });
  }
}

// Define the route for the API
loginRouter.get('/liveScore/:matchId', liveScore);

module.exports = { loginRouter };
