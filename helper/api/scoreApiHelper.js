const axios = require("axios");
require('dotenv').config()
// http://apicricketchampion.in/webservices/liveLive?match_id=33160612
const SCORE_API_URI = `http://apicricketchampion.in`

const SCORE_API_STATUS_LIST = [
  "Ball",
  "NB",
  "WB",
  "LB",
  "BYE",
  "Over",
  "0 to 6",
  "Four",
  "Six",
  "Catch Out",
  "Bolwed",
  "LBW",
  "Stump Out",
  "Hit Wicket",
  "Run Out",
  "Not Out",
  "Bowler Stop",
  "Free Hit",
  "Wicket",
  "Not Out",
  "3rd Umpire",
  "Drink Break",
  "Inning Break",
  "Time Out",
  "Player Injured",
  "Match Stop",
  "Boundary Check",
  "Stump Check",
  "Run Out Check",
  "Batting Team Review",
  "Bowling Team Review",
  "Rain Stop Play",
  "Catch Check",
  "Lunch Break",
  "Tea Break",
  "No Ball Check",
  "Catch Drop",
  "Player IN"
];

const SCORE_API_STATUS_BLOCK_LIST = [
  "NB",
  "Tea Break",
  "Rain Stop Play",
  "Rain Stops Play",
  "Catch Check",
  "Batting Team Review",
  "Bowling Team Review",
  "Run Out Check",
  "3rd Umpire",
  "Third Umpire",
  "Boundary Check",
  "Stump Check",
  "Free Hit",
  "LBW",
  "No Ball Check",
];

async function getCricketScoreAPI(eventId) {
  try {
    // const eventId = 32980846
    const url = `${SCORE_API_URI}/webservices/liveLive?match_id=${eventId}`
    const response = await axios.get(url)
    return  response.data
  } catch (error) {
    console.error('getCricketScore: ', error?.data || error.message || error)
    return {}
  }
}

module.exports = { getCricketScoreAPI, SCORE_API_STATUS_BLOCK_LIST }
