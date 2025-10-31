const express = require("express");
const router = express.Router();
const Bets = require("../models/bets");
const Deposits = require("../models/deposits")
const Events = require("../models/events")

async function listTrackBalance(req, res) {
  try {
    const userId = 11812 // parseInt(req.params.userId);

    const testBetList = await Bets.find({
      userId: userId,
      calculateExp: true,      
    })

    for (let i = 0; i < testBetList?.length; i++) {

      // const depositList = await Deposits.aggregate([
      //   {
      //     $match: {
      //       userId: userId,
      //       marketId: testBetList[i].marketId
      //     }
      //   },
      //   {
      //     $lookup: {
      //       from: 'inplayevents',
      //       localField: 'matchId',
      //       foreignField: '_id',
      //       as: 'inplayevent'
      //     }
      //   }
      // ])
      //console.log("2222222222222", testBetList[i].matchId, i)

      const depositList = await Deposits.find(
        {
            userId: userId,
            marketId: testBetList[i].marketId
          })
          
    }

    const betList = await Bets.aggregate([
      {
        $match: {
          userId: userId,
          calculateExp: true,
        },
      },
      {
        $lookup: {
          from: "deposits",
          localField: "userId",
          foreignField: "userId",
          as: "depositDetail",
        },
      },
      {
        $unwind: "$depositDetail",
      },
      {
        $lookup: {
          from: "inplayevents",
          localField: "depositDetail.matchId",
          foreignField: "_id",
          as: "eventDetail",
        },
      },
      {
        $match: {
          "depositDetail.userId": userId,
        },
      },
      {
        $group: {
          _id: {
            marketId: "$marketId",
            eventId: "$eventDetail.Id",
            userId: "$userId",
          },
          position: { $first: "$position" },
          totalDeposit: { $sum: "$depositDetail.amount" },
          data: { $first: "$$ROOT" },
        },
      }
    ]);
    
    res.status(200).json({ success: true, data: betList });
  } catch (err) {
    res.status(500).json({ success: false, msg: `Failed to get bet list:  ${err.message}` });
  }
}

router.get("/listTrackBalance/:userId", listTrackBalance);

module.exports = { router };