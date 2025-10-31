const express = require('express');
const { validationResult } = require('express-validator');
const MarketType = require('../models/marketTypes');
const SubMarketType = require('../models/subMarketTypes');
const MarketIDS = require('../models/marketIds');
const User = require('../models/user');
const { v4: uuidv4 } = require('uuid');
const marketPlaceVlidator = require('../validators/marketPlaces');
const inPlayEvents = require("../models/events");
const {fetchMarket} = require("../../helper/eventHelper");

const router = express.Router();
const loginRouter = express.Router();

function addMarketType(req, res) {
  const errors = validationResult(req);
  if (errors.errors.length !== 0) {
    return res.status(400).send({ errors: errors.errors });
  }
  const marketType = new MarketType(req.body);
  marketType.marketId = uuidv4();
  marketType.save((err, marketType) => {
    if (err && err.code == 11000) {
      if (err.keyPattern.name == 1)
        return res.status(404).send({ message: 'market type already present' });
    }
    if (err || !marketType) {
      return res.status(404).send({ message: 'market type not added', err });
    }
    return res.send({
      success: true,
      message: 'Market type added successfully',
      results: marketType,
    });
  });
}

async function updateMarketStatusInPlay(req, res) {
  const errors = validationResult(req);
  if (errors.errors.length !== 0) {
    return res.status(400).send({ errors: errors.errors });
  }
  try {
    const {checked, eventId, marketId} = req.body
    const status = checked ? 'OPEN' : 'CLOSED'
    const inPlay = !!checked
    await MarketIDS.updateOne(
      { eventId: eventId, marketId: marketId },
      { inPlay: inPlay, status: status}
    )
    return res.status(200).send({
      success: true,
      message: 'Updated successfully !',
    });
  } catch (error) {
    return res.status(404).send({
      success: false,
      message: 'Failed to update allowed market type by MarketId',
    });
  }
}

function addSubMarketTypes(req, res) {
  const errors = validationResult(req);
  if (errors.errors.length !== 0) {
    return res.status(400).send({ errors: errors.errors });
  }
  MarketType.findOne({ marketId: req.body.marketId }, (err, data) => {
    if (err)
      return res.status(404).send({ message: 'market type not found', err });
    const subMarketType = new SubMarketType(req.body);
    subMarketType.marketId = data.marketId;
    subMarketType.subMarketId = uuidv4(); // Generate a unique UUID
    subMarketType.save((err, marketType) => {
      if (err && err.code == 11000) {
        if (err.keyPattern.name == 1)
          return res
            .status(404)
            .send({ message: 'sub market type already present' });
      }
      if (err || !marketType) {
        return res
          .status(404)
          .send({ message: 'sub market type not added', err });
      }
      return res.send({
        success: true,
        message: 'Sub Market type added successfully',
        results: marketType,
      });
    });
  });
}

async function getAllMarketTypes(req, res) {
  User.findOne({ userId: req.decoded.userId }, async (err, user) => {
    if (err || !user) {
      return res.status(404).send({ message: 'Something went wrong' });
    }
    const blockedMarkets = user.blockedMarketPlaces;
    const blockedSubMarkets = user.blockedSubMarkets;

    const data = await MarketType.aggregate([
      { 
        $lookup: {
          from: 'submarkettypes',
          localField: 'Id',
          foreignField: 'marketId',
          as: 'subMarkets',
        }
      },
      {
        $project: {
          Id: '$Id',
          marketName: '$name',
          status: {
            $cond: {
              if: { $in: ["$Id", blockedMarkets] },
              then: 0,
              else: 1
            }
          },
          subMarkets: {
            $map: {
              input: '$subMarkets',
              as: 'subMarket',
              in: {
                Id: '$$subMarket.Id',
                name: '$$subMarket.name',
                marketId: '$$subMarket.marketId',
                status: {
                  $cond: {
                    if: { $in: ["$$subMarket.Id", blockedSubMarkets] },
                    then: 0,
                    else: 1
                  }
                }
              }
            }
          }
        }
      }
    ]);

    return res.send({
      success: true,
      message: 'MARKET_TYPES_FETCHED_SUCCESSFULLY',
      results: {
        markets: data,
        blockedMarkets,
        blockedSubMarkets
      },
    });
  });
}

async function getMarketsBySportsId(req, res) {
  try {
    const sportsId = req.params.sportsId;
    const marketData = await MarketIDS.aggregate([
      { 
        $match: { sportID: parseInt(sportsId, 10) } 
      },
      {
        $lookup: {
          from: 'inplayevents',
          localField: 'eventId',
          foreignField: 'Id',
          as: 'eventDetails',
        }
      },
      {
        $unwind: "$eventDetails"
      },
      {
        $project: {
          _id: 1,
          sportID: 1,
          eventId: 1,
          eventName: "$eventDetails.name",
          marketId: 1,
          marketName: 1,
          status: 1,
        }
      }
    ]);

    res.status(200).json({success: true, data: marketData});
  } catch (err) {
    return res.status(404).send({
      success: false,
      message: 'Failed to update allowed market type by SportsId',
    });
  }
}

async function getMarketsByEventId(req, res) {
  try {
    const eventId = req.params.eventId;
    const marketData = await MarketIDS.aggregate([
      { 
        $match: { eventId: eventId } 
      },
      {
        $project: {
          _id: 1,
          sportID: 1,
          eventId: 1,
          marketId: 1,
          marketName: 1,
          status: 1,
        }
      }
    ]);

    res.status(200).json({success: true, data: marketData});
  } catch (err) {
    return res.status(404).send({
      success: false,
      message: 'Failed to update allowed market type by EventId',
    });
  }
}

async function activateEvent(req, res) {
  try {
    const eventId = req.params.eventId;
    const event = await inPlayEvents.findOne({Id: eventId})
    event.status = 'OPEN'
    event.CompanySetStatus = 'OPEN'
    event.isShowed = true
    event.lastCheckMarket = Date.now()
    await event.save()
    await fetchMarket(event)

    res.status(200).json({success: true, message: 'Event updated successfully'});
  } catch (err) {
    return res.status(404).send({
      success: false,
      message: 'Failed to update allowed market type by EventId',
    });
  }
}

async function updateCompanySetStatus(req, res) {
  const errors = validationResult(req);
  if (errors.errors.length !== 0) {
    return res.status(400).send({ message: errors.errors });
  }
  try {
    const data = req.query
    await inPlayEvents.updateOne(
      { Id: data.Id },
      { CompanySetStatus: data.status }
    )
    return res.status(200).send({
      success: true,
      message: 'Updated successfully !',
    });
  } catch (error) {
    return res.status(404).send({
      success: false,
      message: 'Failed to update allowed market type by SportsId',
    });
  }

}

async function updateEventStatus(req, res) {
  const errors = validationResult(req);
  if (errors.errors.length !== 0) {
    return res.status(400).send({ message: errors.errors });
  }
  try {
    const data = req.body;
    const event = await inPlayEvents.countDocuments({ Id: data.Id })
    if(!event){
      console.warn(`Error: Event not found for ${req.body.Id}`);
      return res.status(400).send({ message: `Event not found ` });
    }else {
      await inPlayEvents.updateOne(
        { Id: data.Id },
        { status: data.status }
      )
      return res.status(200).send({
        success: true,
        message: 'Updated successfully !',
      });
    }
  } catch (error) {
    return res.status(404).send({
      success: false,
      message: 'Failed to update allowed market type by SportsId',
    });
  }

}

async function updateEventMarketstatus(req, res) {
  const errors = validationResult(req);
  if (errors.errors.length !== 0) {
    return res.status(400).send({ message: errors.errors });
  }
  try {
    const data = req.body;

    const market = await MarketIDS.countDocuments({ marketId: data.marketId })
    if(!market){
      console.warn(`Error: market not found for ${data.marketId}`);
      return res.status(400).send({ message: `market not found ` });
    }

    await MarketIDS.updateOne(
      { marketId: data.marketId },
      { status: data.status }
    )
    return res.status(200).send({
      success: true,
      message: 'Updated successfully !',
    });
  } catch (error) {
    return res.status(404).send({
      success: false,
      message: 'Failed to update allowed market type by SportsId',
    });
  }

}

async function addAllowedMarketTypes(req, res) {
  const errors = validationResult(req);
  if (errors.errors.length !== 0) {
    return res.status(400).send({ errors: errors.errors });
  }
  try {
    const userId = req.decoded.userId;
    const {markets, subMarkets } = req.body.blocked;

    await User.findOneAndUpdate({userId: userId}, {$set:{
      blockedMarketPlaces: markets,
      blockedSubMarkets: subMarkets
    }})
    return res.send({
      success: true,
      message: 'Markets updated successfully',
    });
  } catch (error) {
    console.error(error);
    return res.status(404).send({
      success: false,
      message: 'Failed to update allowed market types',
    });
  }
}

loginRouter.get('/getAllMarketTypes', getAllMarketTypes);
loginRouter.get('/getMarketsBySportsId/:sportsId', getMarketsBySportsId);
loginRouter.get('/getMarketsByEventId/:eventId', getMarketsByEventId);
loginRouter.post('/addMarketType', addMarketType);
loginRouter.post('/addSubMarketTypes', addSubMarketTypes);
loginRouter.post('/addAllowedMarketTypes', marketPlaceVlidator.validate('addAllowedMarketTypes'), addAllowedMarketTypes);
loginRouter.get('/updatemarketstatus', updateCompanySetStatus);
loginRouter.post('/update-market-status-in-play', updateMarketStatusInPlay);
loginRouter.get('/activate-event/:eventId', activateEvent);
loginRouter.post('/updateEventMarketstatus', updateEventMarketstatus);
loginRouter.post('/updateEventStatus', updateEventStatus);
module.exports = { router, loginRouter };
