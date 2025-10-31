const express = require('express');
var jwt = require('jsonwebtoken');
const userValidation = require('../validators/user');
const bcrypt = require('bcrypt');
const { validationResult } = require('express-validator');
let config = require('config');
const BetSizes = require('../models/betSizes');
const User = require('../models/user');
const MarketType = require('../models/marketTypes');
const MaxBetSize = require('../models/maxBetSizes');
const betSizeValidator = require('../validators/betSizes');
const loginRouter = express.Router();

function addBetSizes(req, res) {
  const errors = validationResult(req);
  if (errors.errors.length !== 0) {
    return res.status(400).send({ errors: errors.errors });
  }

  const userId = req.decoded.userId;
  const betSizesData = {
    soccer: req.body.soccer,
    tennis: req.body.tennis,
    cricket: req.body.cricket,
    fancy: req.body.fancy,
    races: req.body.races,
    casino: req.body.casino,
    greyHound: req.body.greyHound,
    bookMaker: req.body.bookMaker,
    tPin: req.body.tPin,
    userId: userId,
    iceHockey: req.body.iceHockey,
    snooker: req.body.snooker,
    kabbadi: req.body.kabbadi,
  };

  getBetSizeLimits((err, limits) => {
    if (err) {
      return res
        .status(404)
        .send({ message: 'Error retrieving bet size limits' });
    }

    const betTypes = Object.keys(betSizesData);
    for (let i = 0; i < betTypes.length; i++) {
      const betType = betTypes[i];
      const amount = betSizesData[betType];
      const maxAmount = limits[betType];
      if (amount > maxAmount) {
        return res.status(404).send({
          message: `${betType} bet size cannot exceed ${maxAmount}`,
        });
      }
    }

    User.findOne({ userId }, (err, user) => {
      if (err || !user) {
        return res.status(404).send({ message: 'User not found' });
      }

      BetSizes.findOneAndUpdate(
        { userId },
        betSizesData,
        { upsert: true, new: true },
        (err, betSizes) => {
          if (err) {
            return res
              .status(404)
              .send({ message: 'Error adding/updating bet sizes' });
          }
          return res.send({
            success: true,
            message: 'Bet sizes added/updated successfully',
            results: betSizes,
          });
        }
      );
    });
  });
}

function betsNews(req, res) {
  const errors = validationResult(req);
  if (errors.errors.length !== 0) {
    return res.status(400).send({ errors: errors.errors });
  }

  if (req.decoded.role === '5') {
    const marketId = req.query.marketId;
    const query = { userId: req.decoded.userId };
    if (marketId) {
      MarketType.findOne({ marketId }, (err, market) => {
        if (err || !market) {
          // check if market is not found
          return res.status(404).send({ message: 'Market not found' });
        }
        const marketName = market.name.toLowerCase();
        query[marketName] = { $exists: true };
        BetSizes.findOne(query, (err, data) => {
          if (err || !data) {
            // check if bet size data is not found
            return res.status(404).send({ message: 'News not found' });
          }
          const results = {
            betSizes: {
              userId: data.userId,
              [marketName]: data[marketName.toLowerCase()],
            },
            text: 'Welcome to Exchange.-Announcement :- All casino Profit Loss will be 1 to 2 Ratio from now Onword.Her casino may Jeet Har 1 ka 2 ho ge. -Welcome . -Welcome . -Welcome to Exchange. Zero commissions on chota bara, kalli jotta, fancies. Customer complain cell 24 hours under maintenance',
          };
          return res.send({
            success: true,
            message: 'News Data found',
            results,
          });
        });
      });
    } else if (!req.query.marketId) {
      const results = {
        betSizes: null,
        text: 'Welcome to Exchange.-Announcement :- All casino Profit Loss will be 1 to 2 Ratio from now On.Her casino may Jeet Har 1 ka 2 ho ge. -Welcome . -Welcome . -Welcome to Exchange. Zero commissions on chota bara, kalli jotta, fancies. Customer complain cell 24 hours under maintenance',
      };
      return res.send({
        success: true,
        message: 'News Data found',
        results,
      });
    }
  } else {
    const results = {
      betSizes: null,
      text: 'Welcome to Exchange.',
    };
    return res.send({
      success: true,
      message: 'News Data found',
      results,
    });
  }
}

function getBetSizeLimits(callback) {
  MaxBetSize.findOne({}, (err, limits) => {
    if (err) {
      callback(err);
    } else if (!limits) {
      callback(new Error('Bet size limits not found'));
    } else {
      const limitsObj = {
        soccer: limits.soccer,
        tennis: limits.tennis,
        cricket: limits.cricket,
        fancy: limits.fancy,
        races: limits.races,
        casino: limits.casino,
        greyHound: limits.greyHound,
        bookMaker: limits.bookMaker,
        tPin: limits.tPin,
        iceHockey: limits.iceHockey,
        snooker: limits.snooker,
        kabbadi: limits.kabbadi,
        tPin: limits.tPin,
      };
      callback(null, limitsObj);
    }
  });
}

loginRouter.post(
  '/addBetSizes',
  betSizeValidator.validate('addBetSizes'),
  addBetSizes
);
loginRouter.get('/betsNews', betsNews);

module.exports = { loginRouter };
