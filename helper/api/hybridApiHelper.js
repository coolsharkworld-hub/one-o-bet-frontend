const {HYBRID_URI} = require("../../app/global/constants");
const axios = require("axios");
require('dotenv').config()

const HYBRID_PROVIDER = process.env.HYBRID_PROVIDER || 'pys'

async function getFancyOdds(marketIds) {
  console.log('getFancyOdds function started.........');
  if (marketIds.length === 0) return []
  const mids = marketIds.join(',')
  const url = `${HYBRID_URI}/runners/fancy?mids=${mids}&provider=${HYBRID_PROVIDER}`
  try {
    const res = await axios.get(url)
    // console.log('hybrid fancy odd list: ', JSON.stringify(res.data))
    return res.data || []
  } catch (error) {
    console.error('An error occurred getFancyOdds:', error?.data || error.message || error, marketIds);
    return []
  }
}

async function getBookmakerOdds(marketIds) {
  if (marketIds.length === 0) return []
  const mids = marketIds.join(',')
  const url = `${HYBRID_URI}/runners/bookmaker?mids=${mids}&provider=${HYBRID_PROVIDER}`
  try {
    const res = await axios.get(url)
    // console.log('hybrid fancy odd list: ', JSON.stringify(res.data))
    return res.data || []
  } catch (error) {
    console.error('An error occurred in hybrid bookmaker odds:', error?.data || error.message || error);
    return []
  }
}

async function getBookmakerMarketList(eventId) {
  const url = `${HYBRID_URI}/event/bookmaker?eventid=${eventId}&provider=${HYBRID_PROVIDER}`
  try {
    const res = await axios.get(url)
    // console.log('hybrid fancy event list: ', JSON.stringify(res.data))
    return res.data || []
  } catch (error) {
    console.error('An error occurred in hybrid bookmaker market list:', error?.data || error.message || error)
    return []
  }
}

async function getFancyMarketList(eventId) {
  const url = `${HYBRID_URI}/event/fancy?provider=${HYBRID_PROVIDER}&eventid=${eventId}`
  try {
    const res = await axios.get(url)
    // console.log('hybrid fancy event list: ', JSON.stringify(res.data))
    return res.data || []
  } catch (error) {
    console.error('An error occurred getFancyMarketList:', error?.data || error.message || error)
    return []
  }
}

async function getCricketScore(eventId) {
  try {
    // const eventId = 32980846
    const response = await axios.get(`http://167.99.198.2/api/matches/score/${eventId}`)
    return  response.data
  } catch (error) {
    console.error('getCricketScore: ', error?.data || error.message || error)
    return {}
  }
}

module.exports = {getFancyOdds, getBookmakerOdds, getBookmakerMarketList, getFancyMarketList, getCricketScore}
