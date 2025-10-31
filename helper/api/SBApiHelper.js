const config = require("../../config/default.json");
require('dotenv').config();
const axios = require("axios");

const header = {
  headers: {
    'accept': 'application/json',
    'Content-Type': 'application/json',
    'X-App': process.env.XAPP_NAME,
  },
}

const listMarketCatalogue = async (eventId) => {
  const requestData = {
    "filter": {
      "eventIds": [eventId],
    },
    "maxResults": 100,
    "marketProjection": ["EVENT", "EVENT_TYPE", "MARKET_START_TIME", "MARKET_DESCRIPTION", "RUNNER_DESCRIPTION"]
  }
  const url = `${config.newThirdURL}/listMarketCatalogue`;
  try {
    const response = await axios.post(
      url,
      requestData,
      header
    );

    return  response.data.result;

  } catch (err) {
    console.error('listMarketCatalogue', err)
  }
}

module.exports = {listMarketCatalogue}
