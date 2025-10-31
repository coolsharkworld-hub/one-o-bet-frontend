const express = require('express');
const { validationResult } = require('express-validator');
const CashDeposit = require('../models/deposits');
const User = require('../models/user');
const Events = require('../models/events');
const loginRouter = express.Router();

const getDailyReport = async(req, res) => {

  const userId      = parseInt(req.decoded.userId)
  const currentUser = await User.findOne({ userId: userId});
  const users       = [userId];
  let parents       = [userId];
  let childUsers = [];

  do{
    childUsers     = await User.distinct("userId", {
      createdBy: {
        $in: parents
      }
    });
    // //console.log(" child users ======= ", childUsers);
    if(childUsers.length) users.push(...childUsers)
    parents = childUsers
  }while (childUsers.length > 0)

  //console.log(" users list  ======== ", users);

  var sportsIdQuery = {$ne: null};

  if (req.query.sportId) {
    sportsIdQuery = req.query.sportId;
  }

  const response = await CashDeposit.aggregate([
    {
      $match: {
        userId: { $in: users },
        sportsId: sportsIdQuery,
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
        from: 'users',
        localField: 'userId',
        foreignField: 'userId',
        as: 'userInfo'
      }
    }, 
    {
      $group:{
        _id: "$userId",
        amount: { $sum: "$amount"},
        name: { $first: { $arrayElemAt: ["$userInfo.userName", 0] } }
      }
    }
  ]);

  const parentResponse = await CashDeposit.aggregate([
    {  
      $match: {
        userId: currentUser.createdBy ,
        commissionFrom: currentUser.userId,
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
        from: 'users',
        localField: 'userId',
        foreignField: 'userId',
        as: 'userInfo'
      }
    }, 
    {
      $group:{
        _id: "$userId",
        // parent: true,
        amount: { $sum: "$upLineAmount"},
        name: { $first: { $arrayElemAt: ["$userInfo.userName", 0] } }
      }
    }
  ]);

  return res.send({
    success: true,
    message: 'Daily reports',
    results: response?.concat(parentResponse),
  });

}

const dailySportsWiseReport = async (req, res) => {
  const errors = validationResult(req);
  if (errors.errors.length !== 0) {
    return res.status(400).send({ errors: errors.errors });
  }

    const Id        =  parseInt(req.query.userId)
    //console.log(" Id ========== ", Id);
    const response = await CashDeposit.aggregate([
      {  
        $match: {
          userId: Id,
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
}

const dailyMatchWiseReports = async (req, res) => {
  const errors = validationResult(req);
  if (errors.errors.length !== 0) {
    return res.status(400).send({ errors: errors.errors });
  }
  
  const userId = req.decoded.userId
  //console.log(" userId ====== ", userId);
  const Id =  parseInt(req.query.userId)
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
          amount: { $sum: "$amount"},
          userId: { $first: "$userId" },
          date: { $first: "$date" },
          name: { $first: "$event" }
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
}

const dailyMatchWiseDetailedReports = async(req, res) => {

  const userId      = parseInt(req.query.userId)
  const matchId     = req.query.matchId;
  const currentUser = await User.findOne({ userId: userId});
  const parent      = await User.findOne({ userId: currentUser.createdBy});

  if(currentUser.role == '5'){
    let match = null
    matchId.length > 10 ? match = await Events.findById(matchId) : '';
    let response;
    if(match){
      //console.log(" =============================== Includes Part  =========================== ");
        response = await CashDeposit.aggregate([
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
            $group:{
              _id: "$_id",
              pl: { $sum: "$amount"},
              sattledAt: { $first: "$date" },
              sportsId: { $first: { $arrayElemAt: ["$betsDetails.sportsId", 0] } },
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
  
    }else {
      //console.log(" ================= matchId ================= ", matchId);
      response = await CashDeposit.aggregate([
        {
          $match: {
            marketId: matchId,
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
            type: 0,
            size: 1
          }
        },
        { 
          $group:{
            _id: "$betId",
            pl: { $sum: "$amount"},
            sattledAt: { $first: "$date" },
            sportsId:  { $first: "$sportsId" },
            event: { $first: "$event" },
            price: { $first: "$casinoBetAmount" },
            type: { $first: "$type" },
            size: { $first: "$size" },
            createdAt: { $first: "$betTime" }
            ,
          }
        }
      ])
      //console.log(" ================= Response ================= ", response);
    }
    return res.send({
      success: true,
      message: 'Detailed reports',
      results: response,
      isDetailed: true,
      dealer: parent.userName,
      currentUser: currentUser.userName,
      Winner: match?.winner
      
    });

  }else {
    const users       = [userId];
    let parents       = [userId];
    let childUsers;
    do{
      childUsers     = await User.distinct("userId", {
        createdBy: {
          $in: parents
        }
      });
      //console.log(" child users ======= ", childUsers);
      if(childUsers.length) users.push(...childUsers)
      parents = childUsers
    }while (childUsers.length > 0)
  
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
        $group:{
          _id: "$userId",
          amount: { $sum: "$amount"},
          name: { $first: { $arrayElemAt: ["$userInfo.userName", 0] } }
        }
      }
    ]);
  
    const parentResponse = await CashDeposit.aggregate([
      {  
        $match: {
          userId: currentUser.createdBy ,
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
        $group:{
          _id: "$userId",
          amount: { $sum: "$upLineAmount"},
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

}

const tesTingsheet = async(req, res) =>{
  const errors = validationResult(req);
  if (errors.errors.length !== 0) {
    return res.status(400).send({ errors: errors.errors });
  }

  const userId      = req.decoded.userId;
  const resp        = [];
  const users       = await User.distinct("userId", { createdBy:  userId });
  const currentUser = await User.findOne({ userId: userId })
  if(currentUser.role == 0){
    resp.push(
      {
        _id: currentUser.userId,
        name: "cash",
        amount : currentUser.cash
      },
      {
        _id: currentUser.userId,
        name: currentUser.userName,
        amount : currentUser.balance
      }
    )
  }
  else {
    const parentUser  = await User.findOne({ userId: currentUser.createdBy });
    //console.log(" ================== parentUser ================  ", parentUser);
    resp.push(    
      {
        _id: currentUser.userId,
        name: "cash",
        amount : currentUser.cash
      },
      {
        _id: currentUser.userId,
        name: currentUser.userName,
        amount : currentUser.balance
      },
      {
        _id: parentUser.userId,
        name: parentUser.userName,
        amount : currentUser.clientPL * (-1)
      }
    )
  }

  //console.log(" ================== currentUser ================  ", currentUser);

  const response = await User.aggregate([
    {  
      $match: {
        userId: {
          $in: users
        }
      }
    },
    {
      $group:{
        _id: "$userId",
        name: { $first: "$userName" },
        amount:  { $sum: "$clientPL" } 
      }
    }
  ]);

  return res.send({
    success: true,
    message: 'Final Sheet Reports',
    results: resp.concat(response)
  });

}

loginRouter.get('/getDailyReport', getDailyReport);
loginRouter.get('/dailySportsWiseReport', dailySportsWiseReport);
loginRouter.get('/dailyMatchWiseReports',  dailyMatchWiseReports);
loginRouter.get('/dailyMatchWiseDetailedReports',  dailyMatchWiseDetailedReports);
loginRouter.get('/tesTingsheet', tesTingsheet);
module.exports = { loginRouter };
