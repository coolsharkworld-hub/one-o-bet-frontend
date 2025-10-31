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

const bookDetail2Report = async (req, res) => {
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
        userId: userId,
        cashOrCredit: { $in: ["Bet", "Commission", "loosing"] },
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





  let depositsQuery = {};

  if (req.query.endDate && req.query.startDate) {
    depositsQuery.createdAt = {
      $gte: req.query.startDate,
      $lte: req.query.endDate,
    };
  }


  User.find({userId: req.decoded.userId})
    .then((users) => {
      if (!users || users.length === 0) {
        return res.status(404).send({ message: 'No users found' });
      }
      const userIds = users.map((user) => user.userId);


      Deposits.find({ userId: { $in: userIds },  ...depositsQuery })
        .exec()
        .then((deposits) => {
          if (!deposits || deposits.length === 0) {
            return res.status(404).send({ message: 'No records found' });
          }

          const marketIds = deposits.map((deposit) => deposit.marketId);

          MarketType.find({ marketId: { $in: marketIds } }, 'marketId name')
            .then((markets) => {
              const marketMap = {};
              markets.forEach((market) => {
                marketMap[market.marketId] = market.name;
              });

              const results = deposits.reduce((acc, deposit) => {
                const existingMarket = acc.find((item) => item.name === marketMap[deposit.marketId]);
                if (existingMarket) {
                  existingMarket.amount += deposit.amount;
                } else {
                  acc.push({
                    name: marketMap[deposit.marketId],
                    amount: deposit.amount,
                  });
                }
                return acc;
              }, []);

              return res.send({
                success: true,
                message: 'daily sportswise pl records found',
                results: results,
              });
            })
            .catch((err) => {
              return res.status(404).send({ message: 'RETRIEVAL_FAILED' });
            });
        })
        .catch((err) => {
          return res.status(404).send({ message: 'RETRIEVAL_FAILED' });
        });
    })
    .catch((err) => {
      return res.status(404).send({ message: 'RETRIEVAL_FAILED' });
    });
}

loginRouter.get('/bookDetail2Report',reportValidator.validate('bookDetail2Report'), bookDetail2Report);

module.exports = { loginRouter };
