const express = require('express');
const { validationResult } = require('express-validator');
let config = require('config');
const CashDeposit = require('../models/deposits');
const User = require('../models/user');
const reportValidator = require('../validators/reports');
const Deposits = require('../models/deposits');
const MarketType = require('../models/marketTypes');
const Bets = require('../models/bets');
const loginRouter = express.Router();
const Events = require('../models/events');



const bookDetailReport = async (req, res) => {
  try {
    const userId = parseInt(req.decoded.userId);
    const grandchiltren = await User.distinct("userId", { createdBy: userId, role: '5' });

    const response = await CashDeposit.aggregate([
      {
        $match: {
          userId: { $in: grandchiltren },
          cashOrCredit: { $in: ["Bet", "Commission", "loosing"] },
          $and: [
            {
              createdAt: { $gte: req.query.startDate }
            },
            {
              createdAt: { $lte: req.query.endDate }
            }
          ]
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: 'userId',
          as: 'userInfo'
        }
      },
      {
        $group: {
          _id: "$userId",
          amount: { $sum: "$amount" },
          name: { $first: { $arrayElemAt: ["$userInfo.userName", 0] } },
          betsIdArray: { $push: "$betId" }
        }
      }
    ]);

    var realResult = response;


    for (let index = 0; index < response.length; index++) {
      const element = response[index];
      if (Array.isArray(element.betsIdArray) && element.betsIdArray.length > 0) {

        const r1 = await CashDeposit.aggregate([
          {
            $match: {
              userId: { $ne: element._id },
              betId: { $in: element.betsIdArray },
              cashOrCredit: { $in: ["Bet", "Commission", "loosing"] },
              $and: [
                {
                  createdAt: { $gte: req.query.startDate }
                },
                {
                  createdAt: { $lte: req.query.endDate }
                }
              ]
            }
          },
          {
            $lookup: {
              from: 'users',
              localField: 'userId',
              foreignField: 'userId',
              as: 'userInfo'
            }
          },
          {
            $group: {
              _id: "$userId",
              amount: { $sum: "$amount" },
              name: { $first: { $arrayElemAt: ["$userInfo.userName", 0] } },
            }
          }
        ]);

        for (let i = 0; i < r1.length; i++) {
          realResult.push(r1[i]);
        }
      }
    }








    return res.send({
      success: true,
      message: 'Daily reports',
      results: realResult
    });
  } catch (error) {
    console.error(error);
    return res.send({
      success: false,
      message: "Something went wrong",
    });
  }

}

const bookDetailSportsWiseReport = async (req, res) => {
  try {
    if (!req.query.userId) {
      return res.send({
        success: false,
        message: "Request Invalid !",
      });
    }
    const Id = parseInt(req.query.userId)
    //console.log(" Id ========== ", Id);
    const response = await CashDeposit.aggregate([
      {
        $match: {
          userId: Id,
          cashOrCredit: { $in: ["Bet", "Commission", "loosing"] },
          $and: [
            {
              createdAt: { $gte: req.query.startDate }
            },
            {
              createdAt: { $lte: req.query.endDate }
            }
          ]
        }
      },
      {
        $lookup: {
          from: 'markettypes',
          localField: 'sportsId',
          foreignField: 'Id',
          as: 'marketInfo'
        }
      },
      {
        $group: {
          _id: "$sportsId",
          amount: { $sum: "$amount" },
          userId: { $first: "$userId" },
          name: { $first: { $arrayElemAt: ["$marketInfo.name", 0] } }
        }
      }
    ]);
    return res.send({
      success: true,
      message: 'Market wise Reports !',
      results: response,
    });
  } catch (error) {
    return res.send({
      success: false,
      message: "Something went wrong",
    });
  }
}

const bookDetailMatchWiseReports = async (req, res) => {
  try {
    const Id = parseInt(req.query.userId)
    let response = []; 
    if(req.query.sportsId == 6){
      response = await CashDeposit.aggregate([
        {
          $match: {
            userId: Id,
            sportsId: req.query.sportsId,
            cashOrCredit: { $in: ["Bet", "Commission", "loosing"] },
            $and: [
              {
                createdAt: { $gte: req.query.startDate }
              },
              {
                createdAt: { $lte: req.query.endDate }
              }
            ]
          }
        },
        {
          $group: {
            _id: { $arrayElemAt: ["$bets.matchId", 0] },
            amount: { $sum: "$amount" },
            userId: { $first: "$userId" },
            date: { $first: "$date" },
            name: { $first: "$event"},
          }
        }
      ]);
    }else {
      response = await CashDeposit.aggregate([
        {
          $match: {
            userId: Id,
            sportsId: req.query.sportsId,
            cashOrCredit: { $in: ["Bet", "Commission", "loosing"] },
            $and: [
              {
                createdAt: { $gte: req.query.startDate }
              },
              {
                createdAt: { $lte: req.query.endDate }
              }
            ]
          }
        },
        {
          $addFields: {
            'betIdEvent': { $toObjectId: "$betId" }
          }
        },
        {
          $lookup: {
            from: 'bets',
            localField: 'betIdEvent',
            foreignField: '_id',
            as: 'bets'
          }
        },
        {
          $group: {
            _id: { $arrayElemAt: ["$bets.matchId", 0] },
            amount: { $sum: "$amount" },
            userId: { $first: "$userId" },
            date: { $first: "$date" },
            name: { $first: { $arrayElemAt: ["$bets.event", 0] } },
          }
        }
      ]);
    }


    return res.send({
      success: true,
      message: 'Sport wise Reports !',
      results: response,
    });
  } catch (error) {
    return res.send({
      success: false,
      message: "Something went wrong",
    });
  }
}

const bookDetailMatchWiseDetailedReports = async (req, res) => {
  try {
    if (!req.query.userId || !req.query.matchId) {
      return res.send({
        success: false,
        message: "Request Invalid !",
      });
    }
    const userId = parseInt(req.query.userId);

    const matchId = req.query.matchId;
    const currentUser = await User.findOne({ userId: userId });
    if (!currentUser) {
      return res.send({ success: false, message: "user not found " });
    }
    const parent = await User.findOne({ userId: currentUser.createdBy });
    if (!parent && currentUser.role != 0) {
      return res.send({ success: false, message: "parent missing !" });
    }
    if (currentUser.role == '5') {
      const match = await Events.findById(matchId)
      const response = await CashDeposit.aggregate([
        {
          $match: {
            matchId: matchId,
            $or: [
              {
                $and: [{
                  userId: userId,
                },
                {
                  cashOrCredit: { $in: ["Bet"] }
                }
                ]
              },
              {
                cashOrCredit: { $in: ["Commission"] }
              }
            ]
          }
        },
        {
          $addFields: {
            'betsId': { $toObjectId: "$betId" }
          }
        },
        {
          $lookup: {
            from: 'bets',
            localField: 'betsId',
            foreignField: '_id',
            as: 'betsDetails'
          }
        },
        {
          $group: {
            _id: "$betId",
            pl: { $sum: "$amount" },
            sattledAt: { $first: "$date" },
            price: { $first: { $arrayElemAt: ["$betsDetails.betAmount", 0] } },
            name: { $first: { $arrayElemAt: ["$betsDetails.runnerName", 0] } },
            createdAt: { $first: { $arrayElemAt: ["$betsDetails.createdAt", 0] } },
            size: { $first: { $arrayElemAt: ["$betsDetails.betRate", 0] } },
            type: { $first: { $arrayElemAt: ["$betsDetails.type", 0] } },
            fancyData: { $first: { $arrayElemAt: ["$betsDetails.fancyData", 0] } },
            isfancyOrbookmaker: { $first: { $arrayElemAt: ["$betsDetails.isfancyOrbookmaker", 0] } }
            

          }
        }
      ]);
      return res.send({
        success: true,
        message: 'Detailed reports',
        results: response,
        isDetailed: true,
        dealer: parent.userName,
        currentUser: currentUser.userName,
        Winner: match?.winner

      });

    } else {
      const userId = parseInt(req.decoded.userId);
      const directChild = await User.distinct("userId", { createdBy: userId });
      const grandchiltren = await User.distinct("userId", { createdBy: { $in: directChild }, role: '5' });
      const users = [userId, ...directChild, ...grandchiltren];

      //console.log(" users list  ======== ", users);

      const response = await CashDeposit.aggregate([
        {
          $match: {
            userId: { $in: users },
            matchId: matchId,
            cashOrCredit: { $in: ["Bet", "Commission", "loosing"] },
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: 'userId',
            foreignField: 'userId',
            as: 'userInfo'
          }
        },
        {
          $group: {
            _id: "$userId",
            amount: { $sum: "$amount" },
            name: { $first: { $arrayElemAt: ["$userInfo.userName", 0] } }
          }
        }
      ]);

      const parentResponse = await CashDeposit.aggregate([
        {
          $match: {
            userId: currentUser.createdBy,
            commissionFrom: currentUser.userId,
            cashOrCredit: { $in: ["Bet", "Commission", "loosing"] },
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: 'userId',
            foreignField: 'userId',
            as: 'userInfo'
          }
        },
        {
          $group: {
            _id: "$userId",
            // parent: true,
            amount: { $sum: "$upLineAmount" },
            name: { $first: { $arrayElemAt: ["$userInfo.userName", 0] } }
          }
        }
      ]);

      return res.send({
        success: true,
        message: 'Daily reports',
        results: response?.concat(parentResponse),
        isDetailed: false
      });
    }
  } catch (error) {
    //console.log("Error ============", error);
    return res.send({
      success: false,
      message: "Something went wrong !",
    });
  }
}

loginRouter.get('/bookDetailReport', bookDetailReport);
loginRouter.get('/bookDetailSportsWiseReport', bookDetailSportsWiseReport);
loginRouter.get('/bookDetailMatchWiseReports', bookDetailMatchWiseReports);
loginRouter.get('/bookDetailMatchWiseDetailedReports', bookDetailMatchWiseDetailedReports);

module.exports = { loginRouter };
