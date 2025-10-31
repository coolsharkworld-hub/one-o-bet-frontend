const axios = require("axios");
const { isIterable } = require("../common");
const SESSION_API_URI = `http://142.93.36.1/api/v2`

async function fetchSession(eventId) {
  // const eventId = '33002177'
  // http://142.93.36.1/api/v2/getSessions?EventTypeID=4&matchId=33061168
  const url = `${SESSION_API_URI}/getSessions?EventTypeID=4&matchId=${eventId}`
  try {
    const response = await axios.get(url)
    let res = response.data;
    // console.log('session list: ', JSON.stringify(res))
    if (isIterable(res)) {
      const items = res.map((item) => {
        return JSON.parse(item)
      })
      return items
    } else {
      return []
    }
  } catch (error) {
    console.log('url: ', url)
    console.error('session api fetchSession: ', eventId, error?.data || error.message || error)
    return []
  }
}

async function fetchMarketOdds(marketId) {
  // const marketId = '1.166536383'
  // http://142.93.36.1/api/v2/getMarketsOdds?EventTypeID=4&marketId=1.225509710
  const url = `${SESSION_API_URI}/getMarketsOdds?EventTypeID=4&marketId=${marketId}`
  try {
    const response = await axios.get(url)
    let res = response.data;
    // console.log('session list: ', JSON.stringify(res))
    if (isIterable(res)) {
      const items = res.map((item) => {
        return JSON.parse(item)
      })
      return items
    } else {
      return []
    }
  } catch (error) {
    console.log('url: ', url)
    console.error('session api fetchMarketOdds: ', marketId, error?.data || error.message || error)
    return []
  }
}

async function getSessionFancyResult(marketIds) {
  // const marketId = '1.166536383'
  const marketId = marketIds.join(',')
  // http://142.93.36.1/api/v2/sessionsResults?EventTypeID=4&marketId=33011518_511,33031567_108
  const url = `${SESSION_API_URI}/sessionsResults?EventTypeID=4&marketId=${marketId}`
  // const url = `${SESSION_API_URI}/marketResult?type=fancy1&market_id=${marketId}`
  try {
    const response = await axios.get(url)
    // console.log('session list: ', JSON.stringify(res))
    return response?.data ?? [];
  } catch (error) {
    console.log('url: ', url)
    console.error('session api getSessionFancyResult: ', marketIds, error?.data || error.message || error)
    return []
  }
}

async function getSessionBookmakerResult(marketIds) {
  const marketId = marketIds.join(',')
  // http://142.93.36.1/api/v2/bookmakersResults?EventTypeID=4&marketId=9991.225012136_bm1,9991.225012134_bm2
  const url = `${SESSION_API_URI}/bookmakersResults?EventTypeID=4&marketId=${marketId}`
  try {
    // const marketId = '1.166536383'

    const response = await axios.get(url)
    // console.log('session list: ', JSON.stringify(res))
    return response?.data ?? [];
  } catch (error) {
    console.log('url: ', url)
    console.error('session api getSessionBookmakerResult: ', marketIds, error?.data || error.message || error)
    return []
  }
}

async function fetchBookmakerList(eventId) {
  const url = `${SESSION_API_URI}/getBookmakers?EventTypeID=4&EventID=${eventId}`
  try {
    // const eventId = '33068371'
    // http://142.93.36.1/api/v2/getBookmakers?EventTypeID=4&EventID=33068371

    const response = await axios.get(url)
    // console.log('session list: ', JSON.stringify(res))
    return response?.data ?? [];
  } catch (error) {
    console.log('url: ', url)
    console.error('session api fetchBookmakerList: ',eventId,  error?.data || error.message || error)
    return []
  }
}

async function fetchBookmakerOdds(marketIds) {
  const url = `${SESSION_API_URI}/getBookmakerOdds?EventTypeID=4&marketId=${marketIds}`
  try {
    // const marketId = '1.166536383'
    // const marketId = marketIds.join(',')
    // http://142.93.36.1/api/v2/getBookmakerOdds?EventTypeID=4&marketId=9991.225522065_bm1

    const response = await axios.get(url)
    // console.log('session list: ', JSON.stringify(res))
    const res = response.data
    if (isIterable(res)) {
      const items = res.map((item) => {
        return JSON.parse(item)
      })
      return items
    } else {
      return []
    }
  } catch (error) {
    console.log('url: ', url)
    console.error('session api fetchBookmakerOdds: ', marketIds, error?.data || error.message || error)
    return []
  }
}

async function fetchScoreSessionApi(eventId) {
  try {
    // const marketId = '1.166536383'
    // const marketId = marketIds.join(',')
    // http://142.93.36.1/api/v2/score?EventTypeID=4&matchId=33057044
    const url = `${SESSION_API_URI}/score?EventTypeID=4&matchId=${eventId}`
    const response = await axios.get(url)
    // console.log('session list: ', JSON.stringify(res))
    const res = response.data
    return res
  } catch (error) {
    console.error('session api fetchScore: ', eventId, error?.data || error.message || error)
    return {}
  }
}

const convertSessionScoreToCricket = (apiRes, eventEntity) => {
  if (apiRes.error) return null
  const eventId = eventEntity.Id
  const entity = apiRes.data
  const getCurrentOver = (team) => {
    if (entity.current_inning === entity.teams[team].team_name) {
      return entity.current_over.replace('(', '').replace(')', '')
    } else {
      return `0.0`
    }
  }
  const getCurrentScore = (team) => {
    if (entity.current_inning === entity.teams[team].team_name) {
      return entity.current_score?.replace('-', '/')
    } else {
      return `0/0`
    }
  }

  const cricketScore = {
    eventId: eventId,
    inning: entity?.current_inning===entity?.teams[1]?.team_name ? 2 : 1,
    Title: entity?.rky,
    over1: getCurrentOver(0),
    over2: getCurrentOver(1),
    overs: [],
    res: entity.msg,
    result: entity.msg ?? entity.completed_message,
    comment: entity.msg || '',
    activeTeam: entity.current_inning,
    score1: getCurrentScore(0),
    score2: getCurrentScore(1),
    RRR: entity.requireRunRate,
    CRR: entity.currentRunRate,
    team1Flag: '',
    team2Flag: '',
    team1Name: entity.teams[0].team_name,
    team2Name: entity.teams[1].team_name,
    team1ShortName: entity.teams[0].team_short_name,
    team2ShortName: entity.teams[1].team_short_name,
    type: eventEntity.matchType,
    matchTitle: entity.rky,
  }
  return cricketScore
}
module.exports = {fetchSession, fetchMarketOdds, getSessionFancyResult, getSessionBookmakerResult,
  fetchBookmakerList, fetchBookmakerOdds, fetchScoreSessionApi, convertSessionScoreToCricket
}
