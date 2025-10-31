const express = require("express");
const router = express.Router();
const Bets = require("../models/bets");

async function listBet(req, res) {
  try {
    const userId = parseInt(req.params.userId);
    const betList = await Bets.aggregate([
      {
        $match: {
          userId: parseInt(userId),
          calculateExp: true
        },
      },
      {
        $sort: { _id: 1 },
      },
      {
        $lookup: {
          from: "deposits",
          localField: "_id",
          foreignField: "betId",
          as: "depositDetail",
        },
      },
      // {
      //   $lookup: {
      //     from: "exposures",
      //     let: { randomStr: "$randomStr" },
      //     pipeline: [
      //       {
      //         $match: {
      //           $expr: {
      //             $and: [
      //               { $eq: ["$userId", parseInt(userId)] },
      //               { $eq: ["$trans_from_id", "$$randomStr"] },
      //               { $eq: ["$calculatedExp", "1"] },
      //             ],
      //           },
      //         },
      //       },
      //     ],
      //     as: "exposureDetail",
      //   },
      // },
      {      
        $lookup: {
          from: "exposures",
          localField: "_id",
          foreignField: "trans_from_id",
          as: "exposureDetail",
        }
      },
      {
        $project: {
          _id: 0,
          betId: "$_id",
          price: "$betRate",
          runnersPosition: "$runnersPosition",
          calculateExp: "$calculateExp",
          runnerId: "$runnerName",
          createdAt: "$createdAt",
          size: "$betAmount",
          runner: "$runner",
          marketId: "$marketId",
          betRate: "$betRate",
          type: "$type",
          isfancyOrbookmaker: "$isfancyOrbookmaker",
          fancyData: "$fancyData",
          fancyRate: "$fancyRate",
          betSession: "$betSession",
          roundId: "$roundId",
          asianTableId: "$asianTableId",
          marketId: "$marketId",
          betAmount: "$betAmount",
          exposureAmount: "$exposureAmount",
          sportsId: "$sportsId",
          depositDetail: {
            $filter: {
              input: "$depositDetail",
              cond: {
                $eq: ["$$this.userId", parseInt(userId)],
              },
            },
          },
          exposureDetail: {
            $filter: {
              input: "$exposureDetail",
              cond: {
                $eq: ["$$this.userId", parseInt(userId)],
              },
            },
          },
        },
      },
    ]);

    const total = await Bets.countDocuments({userId: parseInt(userId)})

    res.status(200).json({ success: true, data: betList, total: total });
  } catch (err) {
    res.status(500).json({ success: false, msg: "Failed to get bet list" });
  }
}

router.post("/listBet/:userId", listBet);

module.exports = { router };
