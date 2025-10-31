const axios = require("axios");
const BOOKMAKER_API_URI = `http://46.101.9.108/api/v2`

async function fetchBookmakerList(eventId) {
  try {
    // const eventId = '33021767'
    const url = `${BOOKMAKER_API_URI}/fetch_data?Action=listBookmakerMarket&EventID=${eventId}`
    const response = await axios.get(url)
    let res = response.data;
    // console.log('session list: ', JSON.stringify(res))
    return res || []
  } catch (error) {
    console.error('bookmaker api fetchBookmakerList: ', eventId, error?.data || error.message || error)
    return []
  }
}

async function fetchBookmakerOdds(marketId) {
  try {
    // const marketId = '33021767'
    const url = `${BOOKMAKER_API_URI}/listBookmakerMarketOdds?market_id=${marketId}`
    const response = await axios.get(url)
    let res = response.data;
    // console.log('session list: ', JSON.stringify(res))
    return res || []
  } catch (error) {
    console.error('bookmaker api fetchBookmakerOdds: ', marketId, error?.data || error.message || error)
    return []
  }
}

module.exports = {fetchBookmakerList, fetchBookmakerOdds}
