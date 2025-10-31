const axios = require('axios');
require('dotenv').config();
const ACTIVE_BETTOR_URI = process.env.ACTIVE_BETTOR_URI || `http://127.0.0.1/api/active-bettors`;
const checkActiveBettors = async (bet) => {
  const userId = bet?.userId;
  try {
    // const url = `https://production.1obet.net/api/active-bettors`
    const url = ACTIVE_BETTOR_URI || `http://127.0.0.1/api/active-bettors`;
    // const url = `http://localhost:4000/api/active-bettors`
    // const url = `http://185.182.187.118:4000/api/active-bettors`

    const activeBettorsRes = await axios.get(url);
    const activeBettors = new Map(Object.entries(activeBettorsRes?.data?.results));
    // console.log('checkActiveBettors: ', userId);
    return activeBettors.has(`${userId}`);
  } catch (error) {
    // console.error('checkActiveBettors: ', userId, error?.data || error.message || error);
    return false;
  }
};

const getDiffBackAndLay = (team) => {
  const backList = team?.ExchangePrices?.AvailableToBack ?? [];
  const layList = team?.ExchangePrices?.AvailableToLay ?? [];
  const maxBack = backList?.reduce((max, obj) => {
    return obj.price > max.price ? obj : max;
  }, backList[0]) || { price: 0 };
  const minLay = layList?.reduce((min, obj) => {
    return obj.price < min.price ? obj : min;
  }, layList[0]) || { price: 0 };

  return Math.abs(maxBack.price - minLay.price);
};

const getRaceDiffBackAndLay = (team) => {
  const backList = team?.exchange?.availableToBack ?? [];
  const layList = team?.exchange?.availableToLay ?? [];
  const maxBack = backList?.reduce((max, obj) => {
    return obj.price > max.price ? obj : max;
  }, backList[0]) || { price: 0 };
  const minLay = layList?.reduce((min, obj) => {
    return obj.price < min.price ? obj : min;
  }, layList[0]) || { price: 0 };

  return Math.abs(maxBack.price - minLay.price);
};

module.exports = { checkActiveBettors, getDiffBackAndLay, getRaceDiffBackAndLay };
