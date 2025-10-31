const express = require('express');
const {validationResult} = require('express-validator');
let config = require('config');
const betLockValidator = require('../validators/betLocks');
const User = require('../models/user');
const Market = require('../models/marketTypes');
const Events = require('../models/events');
const SubMarket = require('../models/subMarketTypes');
const loginRouter = express.Router();

async function addBetLock(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).send({errors: errors.errors});
    }
    const {matchId, allUsers, lock, matchOdds, userIds} = req.body;
    const userId = Number(req.decoded.userId)
    //console.log("matchId ==== ", matchId);
    const event = await Events.findById(matchId)
    if (!event) {
      res.status(404).send({message: 'Event Id is Invalid'});
    }

    const marketId = event.sportsId
    //console.log("marketId ====== ", marketId);
    let subMarketIds
    if (matchOdds) {
      //console.log("matchOdds ====== ");
      subMarketIds = await SubMarket.distinct('Id', {
        name: 'Match Odds',
        marketId: marketId
      })
    } else {
      subMarketIds = await SubMarket.distinct('Id', {
        name: {$ne: 'Match Odds'},
        marketId: marketId
      })
    }

    if (allUsers && lock) {
      //console.log(" All Users && Lock ");
      const users = await User.find({createdBy: userId})
      for (const user of users) {
        let blockedSubMarkets = user.blockedSubMarketsByParent
        let allSubMarkets = blockedSubMarkets.concat(subMarketIds)
        const finalSubMarkets = [...new Set(allSubMarkets)];
        user.blockedSubMarketsByParent = finalSubMarkets
        await user.save();
      }
    } else if (allUsers && !lock) {
      //console.log(" Not  All Users && Lock");
      const users = await User.find({createdBy: userId})
      for (const user of users) {
        let blockedSubMarkets = user.blockedSubMarketsByParent
        // let allSubMarkets = blockedSubMarkets.concat(subMarketIds)
        const finalSubMarkets = blockedSubMarkets.filter(item => !subMarketIds.includes(item));
        user.blockedSubMarketsByParent = finalSubMarkets
        await user.save();
      }

    } else if (!allUsers) {
      //console.log(" Not  All Users ");

      const usersToUnlock = await User.find({createdBy: userId, userId: {$nin: userIds}})
      for (const user of usersToUnlock) {
        let blockedSubMarkets = user.blockedSubMarketsByParent
        const finalSubMarkets = blockedSubMarkets.filter(item => !subMarketIds.includes(item));
        user.blockedSubMarketsByParent = finalSubMarkets
        await user.save();
      }

      const usersToLock = await User.find({userId: {$in: userIds}})
      for (const user of usersToLock) {
        let blockedSubMarkets = user.blockedSubMarketsByParent
        let allSubMarkets = blockedSubMarkets.concat(subMarketIds)
        const finalSubMarkets = [...new Set(allSubMarkets)];
        user.blockedSubMarketsByParent = finalSubMarkets
        await user.save();
      }
    }

    return res.send({
      success: true,
      message: 'Betlock created successfully',
      results: null,
    });
  } catch (err) {
    console.error(err);
    res.status(404).send({message: 'betlock not saved'});
  }
}

loginRouter.post(
  '/addBetLock',
  betLockValidator.validate('addBetLock'),
  addBetLock
);

module.exports = {loginRouter};
