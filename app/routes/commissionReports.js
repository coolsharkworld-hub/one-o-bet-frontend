const express = require('express');
const { validationResult } = require('express-validator');
let config = require('config');
const CashDeposit = require('../models/deposits');
const User = require('../models/user');

const reportValidator = require('../validators/reports');
const Deposits = require('../models/deposits');
const MarketType = require('../models/marketTypes');
const Bets = require('../models/bets');
const cricketMatch = require('../models/cricketMatches');
const loginRouter = express.Router();

const getCommissionReport = async (req, res) => {
  const errors = validationResult(req);
  if (errors.errors.length != 0) {
    return res.status(400).send({ errors: errors.errors });
  }
  const userId = parseInt(req.decoded.userId)
  //console.log("usersId ====== ", userId);
  const response = await CashDeposit.aggregate([
    {  
      $match: {
        userId: userId,
        cashOrCredit: "Commission",
        $and: [
          {
            createdAt: {$gte: req.query.startDate}
          },
          {
            createdAt: {$lte: req.query.endDate}
          }
        ]
      }
    },
    {
      $lookup: {
        from: 'users',
        localField: 'commissionFrom',
        foreignField: 'userId',
        as: 'userInfo'
      }
    }, 
    {
      $group:{
        _id: "$commissionFrom",
        amount: { $sum: "$amount"},
        name: { $first: { $arrayElemAt: ["$userInfo.userName", 0] } }
      }
    }
  ]);
  return res.send({
    success: true,
    message: 'commition records',
    results: response,
  });
}

const SportWiseCommissionReport = async (req, res) => {
  const errors = validationResult(req);
  if (errors.errors.length !== 0) {
    return res.status(400).send({ errors: errors.errors });
  }

  const userId = parseInt(req.decoded.userId)
  const Id     =  parseInt(req.query.userId)
  //console.log(" Id ========== ", Id);

  const response = await CashDeposit.aggregate([
    {  
      $match: {
        commissionFrom: Id,
        userId: userId,
        cashOrCredit: "Commission",
        $and: [
          {
            createdAt: {$gte: req.query.startDate}
          },
          {
            createdAt: {$lte: req.query.endDate}
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
      $group:{
        _id: "$sportsId",
        amount: { $sum: "$amount"},
        name: { $first: { $arrayElemAt: ["$marketInfo.name", 0] } }
      }
    }
  ]);

  return res.send({
    success: true,
    message: 'Market wise Commission records !',
    results: response,
  });
}

const MatchWiseCommissionReport = async (req, res) => {
  const errors = validationResult(req);
  if (errors.errors.length !== 0) {
    return res.status(400).send({ errors: errors.errors });
  }

  const userId = req.decoded.userId
  //console.log(" userId ====== ", userId);
  const Id =  parseInt(req.query.userId);
  let response = [];
  if(req.query.sportsId == 6){
    response = await CashDeposit.aggregate([
      {  
        $match: {
          userId: userId,
          commissionFrom: Id,
          sportsId: req.query.sportsId,
          cashOrCredit: "Commission",
          $and: [
            {
              createdAt: {$gte: req.query.startDate}
            },
            {
              createdAt: {$lte: req.query.endDate}
            }
          ]
        }
      },
      {
        $group:{
          _id: "$marketId",
          amount: { $sum: "$amount" },
          name:   { $first: "$event" }
        }
      }
    ]);
  }
  else{
    response = await CashDeposit.aggregate([
      {  
        $match: {
          userId: userId,
          commissionFrom: Id,
          sportsId: req.query.sportsId,
          cashOrCredit: "Commission",
          $and: [
            {
              createdAt: {$gte: req.query.startDate}
            },
            {
              createdAt: {$lte: req.query.endDate}
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
        $group:{
          _id: {$arrayElemAt: ["$bets.matchId", 0]},
          amount: { $sum: "$amount"},
          name: { $first: { $arrayElemAt: ["$bets.event", 0] } }
        }
      }
    ]);
  }

  return res.send({
    success: true,
    message: 'Sport wise Commissions !',
    results: response,
  });

}



loginRouter.get(
  '/getCommissionReport',
  reportValidator.validate('getDailyPLReport'),
  getCommissionReport
);
loginRouter.get(
  '/SportWiseCommissionReport',
  reportValidator.validate('dailyPLSportsWiseReport'),
  SportWiseCommissionReport
);
loginRouter.get(
  '/MatchWiseCommissionReport',
  reportValidator.validate('dailyPlMarketsReports'),
  MatchWiseCommissionReport
);

module.exports = { loginRouter };
