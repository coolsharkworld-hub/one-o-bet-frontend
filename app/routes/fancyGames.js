const express = require('express');
let config = require('config');
const fancyGames = require('../models/fancyGames');
const axios = require('axios');
const inPlayEvents = require('../models/events');
const {FANCY_URL, API_DOMAIN} = require("../global/constants");
const loginRouter = express.Router();

async function getFancyData(req, res) {
  const eventId = req.params.eventId;
  const url = `${FANCY_URL}/bm_fancy/${eventId}`;
  //console.log('url', url);
  try {
    const response = await axios.get(url);
    // //console.log('response',response?.data);
    // //console.log('response.data.t1', response?.data?.data?.t1);
    //console.log('response.data.t2', response?.data?.data?.t2);
    // //console.log('response.data.t3', response?.data?.data?.t3);
    // //console.log('response.data.t4', response?.data?.data?.t4);

    const fancyData = response?.data;
   // Create a new fancyData document
  const  newData = {
    t1: fancyData?.data?.t1,
    t2: fancyData?.data?.t2,
    t3: fancyData?.data?.t3,
    t4: fancyData?.data?.t4,
    success: fancyData?.success,
    status: fancyData?.status,
    updatetime: fancyData?.updatetime,
    eventTypeId: fancyData?.eventTypeId,
    eventTypeName: fancyData?.eventTypeName,
    eventName: fancyData?.eventName,
    name: fancyData?.name,
    eventdate: fancyData?.eventdate,
    gameId: fancyData?.gameId,
    eventId: eventId,
    type: 3
  };

    // Update or insert the document in the database
    const result = await inPlayEvents.findOneAndUpdate(
      { gameId: eventId },
      newData,
      { upsert: true }
    );
      res.status(200).json({
        success: true,
        message: 'Fancy data saved successfully',
        fancyData: newData,
      });
  } catch (error) {
    console.error(error);
    res.status(200).json({
      success: false,
      message: 'Failed to save fancy data2',
      error: error.message,
    });
  }
}

async function getFancyResult(req, res) {
  const eventId = req.params.eventId;
  const fancyName = req.params.fancyName;
  const encodedFancyName = encodeURIComponent(fancyName);

  const url = `${FANCY_URL}/fancy_result/${eventId}/${encodedFancyName}`;

  try {
    const response = await axios.get(url);
    //console.log('response', response);
    res.status(200).json({
      success: true,
      message: 'Fancy data result found',
      fancyData: response.data,
    });
  } catch (error) {
    console.error(error);
    res.status(200).json({
      success: false,
      message: 'Failed to get fancy data',
      error: error.message,
    });
  }
}

async function getFancyMultiResult(req, res) {
  const eventId = req.params.eventId;
  const fancyId = req.params.fancyId;

  const url = `https://${API_DOMAIN}:3443/api/fancy_result_multi/${eventId}/${fancyId}`;

  try {
    const response = await axios.get(url);
    res.status(200).json({
      success: true,
      message: 'Fancy data result found',
      fancyData: response.data,
    });
  } catch (error) {
    res.status(200).json({
      success: false,
      message: 'Failed to get fancy data',
      error: error.message,
    });
  }
}

// Define the route for the API
loginRouter.get('/getFancyData/:eventId', getFancyData);
loginRouter.get('/getFancyResult/:eventId/:fancyName', getFancyResult);
loginRouter.get('/custom_fancy_result_checker/:eventId/:fancyId', getFancyMultiResult);

module.exports = { loginRouter };
