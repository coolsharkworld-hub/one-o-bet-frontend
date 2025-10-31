const express = require("express");
const { validationResult } = require("express-validator");
let config = require("config");
// const betLockValidator      = require('../validators/betLocks');
// const User                  = require('../models/user');
// const Market                = require('../models/marketTypes');
// const Events                = require('../models/events');
// const SubMarket             = require('../models/subMarketTypes');
const BetPlaceHold = require("../models/betaPlaceHold");
const loginRouter = express.Router();

// async function addBetPlaceHold(req, res) {
//     const {
//         sportsId,
//         eventId,
//         secondsValue
//     } = req.body;

//     try {
//         const newBet = new BetPlaceHold({
//             sportsId: 4, // Set sportsId to 4 (fixed value)
//             eventId: eventId,
//             secondsValue: secondsValue,
//         });

//         await newBet.save();
//         return res.json({
//             success: true,
//             message: 'BetPlaceHold created successfully',
//             data: newBet,
//         });
//     } catch (error) {
//         console.error(error);
//         return res.status(500).json({
//             message: 'Internal Server Error'
//         });
//     }
// }
async function updateBetPlaceHold(req, res) {
  const { secondsValue, eventId } = req.body;
  try {
    const updatedBet = await BetPlaceHold.findOneAndUpdate(
      {
        eventId: eventId,
      }, // sportsId is always 4
      {
        $set: {
          secondsValue: secondsValue,
          eventId: eventId,
        },
      },
      {
        new: true,
        upsert: true,
      }
      // Create new document if not found
    );

    return res.json({
      success: true,
      message: "BetPlaceHold updated successfully",
      data: updatedBet,
    });
  } catch (error) {
    //console.log(error);
    return res.status(500).json({
      error: "Internal Server Error",
    });
  }
}

async function getBetPlaceHold(req, res) {
  const eventId = req.params.eventId;
  try {
    const bet = await BetPlaceHold.find({
      eventId: eventId,
    }); // sportsId is always 4

    if (bet) {
      return res.json({
        success: true,
        message: "List betPlaceHold successfully",
        data: bet,
      });
    } else {
      return res.status(404).json({
        message: "Bet not found",
      });
    }
  } catch (error) {
    //console.log(error);
    return res.status(500).json({
      message: "Internal Server Error",
    });
  }
}

// router.post('/addBetPlaceHold', addBetPlaceHold)
loginRouter.put(
  "/updateBetPlaceHold",
  //   betLockValidator.validate('addBetLock'),
  updateBetPlaceHold
);

loginRouter.get(
  "/getBetPlaceHold/:eventId",
  //   betLockValidator.validate('addBetLock'),
  getBetPlaceHold
);

module.exports = {
  loginRouter,
};
