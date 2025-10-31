const express = require('express');
const { validationResult } = require('express-validator');
let config = require('config');
const Cash = require('../models/deposits');
const Bet = require('../models/bets')
const User = require('../models/user');
const Deposits = require('../models/deposits');
const cashValidator = require('../validators/deposits');
const loginRouter = express.Router();
const ExpRec = require('../models/ExpRec');

async function addCashDeposit(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).send({ errors: errors.errors });
  }
  try {
    if (req.body.amount < 1) {
      return res.status(400).send({ message: `Invalid Amount!` });
    }

    const userToUpdate = await User.findOne({
      userId: req.body.userId,
      isDeleted: false,
    });
    if (!userToUpdate) {
      return res.status(404).send({ message: 'user not found' });
    }
    const user_prev_balance = userToUpdate.balance;
    const user_prev_availableBalance = userToUpdate.availableBalance;
    const user_prev_exposure = userToUpdate.exposure;

    const currentUserParent = await User.findOne({
      userId: userToUpdate.createdBy,
      isDeleted: false,
    });
    if (!currentUserParent) {
      return res.status(404).send({ message: 'user not found' });
    }

    if (currentUserParent.role != '0') {
      if (
        req.body.amount >
        currentUserParent.cash + currentUserParent.creditRemaining
      ) {
        return res.status(400).send({
          message: `Max cash deposit is ${Math.floor(
            currentUserParent.cash + currentUserParent.creditRemaining
          )}`,
        });
      }
    }

    const cUserRes = await Cash.find({ userId: userToUpdate.userId }).sort({ _id: -1 }).limit(1);
    const lastMaxWithdraw = cUserRes.length > 0 ? cUserRes[0] : null;

    //console.log( ' ======================= lastMaxWithdraw =================================  ', lastMaxWithdraw );

    const parentRes = await Cash.find({ userId: currentUserParent.userId }).sort({ _id: -1 }).limit(1);
    const parentLastMaxWithdraw = parentRes.length > 0 ? parentRes[0] : null;

    //console.log(' ======================= parentLastMaxWithdraw =================================  ', parentLastMaxWithdraw);

    const Dealers = ['1', '2', '3', '4'];
    // company to Dealer  Deposit
    if (currentUserParent.role == '0' && userToUpdate.role != '5') {
      userToUpdate.clientPL += req.body.amount;
      userToUpdate.cash += req.body.amount;

      let cash = new Cash({
        userId: userToUpdate.userId,
        description: req.body.description ? req.body.description : '(Cash)',
        createdBy: req.decoded.userId,
        amount: req.body.amount,
        balance: lastMaxWithdraw ? lastMaxWithdraw.balance : 0,
        availableBalance: lastMaxWithdraw
          ? lastMaxWithdraw.availableBalance
          : 0,
        maxWithdraw: lastMaxWithdraw
          ? lastMaxWithdraw.maxWithdraw + req.body.amount
          : req.body.amount,
        cash: lastMaxWithdraw
          ? lastMaxWithdraw.cash + req.body.amount
          : req.body.amount,
        credit: lastMaxWithdraw?.credit || 0,
        creditRemaining: lastMaxWithdraw?.creditRemaining || 0,
        cashOrCredit: 'Cash',
      });
      await cash.save();
    }
    // company to Battor
    else if (currentUserParent.role == '0' && userToUpdate.role == '5') {
      userToUpdate.balance += req.body.amount;
      userToUpdate.availableBalance += req.body.amount;
      userToUpdate.clientPL += req.body.amount;
      userToUpdate.cash += req.body.amount;

      let cash = new Cash({
        userId: userToUpdate.userId,
        description: req.body.description ? req.body.description : '(Cash)',
        createdBy: req.decoded.userId,
        amount: req.body.amount,
        balance: lastMaxWithdraw
          ? lastMaxWithdraw.balance + req.body.amount
          : req.body.amount,
        availableBalance: lastMaxWithdraw
          ? lastMaxWithdraw.availableBalance + req.body.amount
          : req.body.amount,
        maxWithdraw: lastMaxWithdraw
          ? lastMaxWithdraw.maxWithdraw + req.body.amount
          : req.body.amount,
        cash: lastMaxWithdraw
          ? lastMaxWithdraw.cash + req.body.amount
          : req.body.amount,
        credit: lastMaxWithdraw?.credit || 0,
        creditRemaining: lastMaxWithdraw?.creditRemaining || 0,
        cashOrCredit: 'Cash',
      });
      await cash.save();
    }

    // Dealer to Dealer
    else if (Dealers.includes(currentUserParent.role) && Dealers.includes(userToUpdate.role)) {
      userToUpdate.clientPL += req.body.amount;
      userToUpdate.cash += req.body.amount;
      // currentUserParent.clientPL -= req.body.amount;
      currentUserParent.cash -= req.body.amount;

      // Add Cash
      let cash = new Cash({
        userId: userToUpdate.userId,
        description: req.body.description ? req.body.description : '(Cash)',
        createdBy: req.decoded.userId,
        amount: req.body.amount,
        balance: lastMaxWithdraw ? lastMaxWithdraw.balance : 0,
        availableBalance: lastMaxWithdraw
          ? lastMaxWithdraw.availableBalance
          : 0,
        maxWithdraw: lastMaxWithdraw
          ? lastMaxWithdraw.maxWithdraw + req.body.amount
          : req.body.amount,
        cash: lastMaxWithdraw
          ? lastMaxWithdraw.cash + req.body.amount
          : req.body.amount,
        credit: lastMaxWithdraw?.credit || 0,
        creditRemaining: lastMaxWithdraw?.creditRemaining || 0,
        cashOrCredit: 'Cash',
      });
      await cash.save();
      // -VS Cash from parent
      let parentCash = new Cash({
        userId: currentUserParent.userId,
        description: req.body.description ? req.body.description : '(Cash)',
        createdBy: req.decoded.userId,
        amount: -req.body.amount,
        balance: parentLastMaxWithdraw ? parentLastMaxWithdraw.balance : 0,
        availableBalance: parentLastMaxWithdraw
          ? parentLastMaxWithdraw.availableBalance
          : 0,
        maxWithdraw: parentLastMaxWithdraw
          ? parentLastMaxWithdraw.maxWithdraw - req.body.amount
          : -req.body.amount,
        cash: parentLastMaxWithdraw
          ? parentLastMaxWithdraw.cash - req.body.amount
          : -req.body.amount,
        credit: parentLastMaxWithdraw?.credit || 0,
        creditRemaining: parentLastMaxWithdraw?.creditRemaining || 0,
        cashOrCredit: 'Cash',
      });
      await parentCash.save();
    }

    // Dealer to Battor
    else if ( Dealers.includes(currentUserParent.role) && userToUpdate.role == '5' ) {
      userToUpdate.balance += req.body.amount;
      userToUpdate.availableBalance += req.body.amount;
      userToUpdate.clientPL += req.body.amount;
      userToUpdate.cash += req.body.amount;
      // currentUserParent.clientPL -= req.body.amount;
      currentUserParent.cash -= req.body.amount;

      let cash = new Cash({
        userId: userToUpdate.userId,
        description: req.body.description ? req.body.description : '(Cash)',
        createdBy: req.decoded.userId,
        amount: req.body.amount,
        balance: lastMaxWithdraw
          ? lastMaxWithdraw.balance + req.body.amount
          : req.body.amount,
        availableBalance: lastMaxWithdraw
          ? lastMaxWithdraw.availableBalance + req.body.amount
          : req.body.amount,
        maxWithdraw: lastMaxWithdraw
          ? lastMaxWithdraw.maxWithdraw + req.body.amount
          : req.body.amount,
        cash: lastMaxWithdraw
          ? lastMaxWithdraw.cash + req.body.amount
          : req.body.amount,
        credit: lastMaxWithdraw?.credit || 0,
        creditRemaining: lastMaxWithdraw?.creditRemaining || 0,
        cashOrCredit: 'Cash',
      });
      await cash.save();
      //console.log('cash', cash);

      // parent update
      let parentCash = new Cash({
        userId: currentUserParent.userId,
        description: req.body.description ? req.body.description : '(Cash)',
        createdBy: req.decoded.userId,
        amount: -req.body.amount,
        balance: parentLastMaxWithdraw ? parentLastMaxWithdraw.balance : 0,
        availableBalance: parentLastMaxWithdraw
          ? parentLastMaxWithdraw.availableBalance
          : 0,
        maxWithdraw: parentLastMaxWithdraw
          ? parentLastMaxWithdraw.maxWithdraw - req.body.amount
          : -req.body.amount,
        cash: parentLastMaxWithdraw
          ? parentLastMaxWithdraw.cash - req.body.amount
          : -req.body.amount,
        credit: parentLastMaxWithdraw?.credit || 0,
        creditRemaining: parentLastMaxWithdraw?.creditRemaining || 0,
        cashOrCredit: 'Cash',
      });
      await parentCash.save();
      //console.log('parentCash', parentCash);
    } else {
      return res.status(400).send({ message: 'Invalid Request' });
    }
    await userToUpdate.save();
    await currentUserParent.save();

    const updatedUser = await User.findOne({
      userId: req.body.userId,
      isDeleted: false,
    });
    const user_new_balance = updatedUser.balance;
    const user_new_availableBalance = updatedUser.availableBalance;
    const user_new_exposure = updatedUser.exposure;

    const updatedUserLastLedger = await Cash.find({
      userId: userToUpdate.userId,
    })
      .sort({ _id: -1 })
      .limit(1);
    const ExpTran = new ExpRec({
      userId: updatedUser.userId,
      trans_from: 'cashDeposit',
      trans_from_id: updatedUserLastLedger._id,
      trans_bet_status: 0,
      user_prev_balance: user_prev_balance,
      user_prev_availableBalance: user_prev_availableBalance,
      user_prev_exposure: user_prev_exposure,
      user_new_balance: user_new_balance,
      user_new_availableBalance: user_new_availableBalance,
      user_new_exposure: user_new_exposure,
    });
    await ExpTran.save();

    return res.send({
      success: true,
      message: 'Cash deposit added successfully',
      results: null,
    });
  } catch (err) {
    console.error(err);
    return res.status(404).send({ message: 'server error', err });
  }
}

//to do need to add balance and availablebalance for cronjob winning bet
async function withDrawCashDeposit(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).send({ errors: errors.errors });
  }
  try {
    if (req.body.amount < 1) {
      return res.status(400).send({ message: `Invalid Amount!` });
    }
    const userToUpdate = await User.findOne({
      userId: req.body.userId,
      isDeleted: false,
    });
    if (!userToUpdate) {
      return res.status(404).send({ message: 'user not found' });
    }
    const user_prev_balance = userToUpdate.balance;
    const user_prev_availableBalance = userToUpdate.availableBalance;
    const user_prev_exposure = userToUpdate.exposure;
    const transData = await Deposits.find({ userId: userToUpdate.userId }).sort({ _id: -1 }).limit(1);
    //console.log(transData);
    const lastTrans = transData[0];
    //console.log(lastTrans);
    const currentUserParent = await User.findOne({
      userId: userToUpdate.createdBy,
      isDeleted: false,
    });
    if (!currentUserParent) {
      return res.status(404).send({ message: 'user not found' });
    }

    if ( userToUpdate.role != '5' && req.body.amount > userToUpdate.cash + userToUpdate.creditRemaining ) {
      //console.log('comming');
      return res.status(400).send({
        message: `Max cash withdraw is: ${ userToUpdate.cash + userToUpdate.creditRemaining }`,
      });
    } else if ( userToUpdate.role == '5' && req.body.amount > userToUpdate.availableBalance ) {
      return res.status(400).send({
        message: `Max cash withdraw is= ${userToUpdate.availableBalance}`,
      });
    } else if (
      userToUpdate.role === '5' &&
      (req.body.amount > lastTrans.availableBalance || lastTrans.availableBalance < 0)
    ) {
      return res.status(400).send({
        message: `Something went wrong. Contact Support.`,
      });
    }

    const cUserRes = await Cash.find({ userId: userToUpdate.userId }).sort({ _id: -1 }).limit(1);
    const lastMaxWithdraw = cUserRes.length > 0 ? cUserRes[0] : null;
    //console.log(' ======================= lastMaxWithdraw =================================  ', lastMaxWithdraw );
    const parentRes = await Cash.find({ userId: currentUserParent.userId })
      .sort({ _id: -1 })
      .limit(1);
    const parentLastMaxWithdraw = parentRes.length > 0 ? parentRes[0] : null;
    //console.log( ' ======================= parentLastMaxWithdraw =================================  ', parentLastMaxWithdraw );

    let Dealers = ['1', '2', '3', '4'];
    // Company to Dealer
    if (currentUserParent.role == '0' && userToUpdate.role != '5') {
      userToUpdate.clientPL -= req.body.amount;
      userToUpdate.cash -= req.body.amount;

      let cash = new Cash({
        userId: userToUpdate.userId,
        description: req.body.description ? req.body.description : '(Cash)',
        createdBy: req.decoded.userId,
        amount: -req.body.amount,
        balance: lastMaxWithdraw ? lastMaxWithdraw.balance : 0,
        availableBalance: lastMaxWithdraw
          ? lastMaxWithdraw.availableBalance
          : 0,
        maxWithdraw: lastMaxWithdraw
          ? lastMaxWithdraw.maxWithdraw - req.body.amount
          : -req.body.amount,
        cash: lastMaxWithdraw
          ? lastMaxWithdraw.cash - req.body.amount
          : -req.body.amount,
        cashOrCredit: 'Cash',
        credit: lastMaxWithdraw?.credit || 0,
        creditRemaining: lastMaxWithdraw?.creditRemaining || 0,
        cash: lastMaxWithdraw
          ? lastMaxWithdraw.cash - req.body.amount
          : -req.body.amount,
      });

      await cash.save();
    }

    // Company to Battor
    else if (currentUserParent.role == '0' && userToUpdate.role == '5') {
      userToUpdate.balance -= req.body.amount;
      userToUpdate.availableBalance -= req.body.amount;
      userToUpdate.clientPL -= req.body.amount;
      userToUpdate.cash -= req.body.amount;

      let cash = new Cash({
        userId: userToUpdate.userId,
        description: req.body.description ? req.body.description : '(Cash)',
        createdBy: req.decoded.userId,
        amount: -req.body.amount,
        balance: lastMaxWithdraw
          ? lastMaxWithdraw.balance - req.body.amount
          : -req.body.amount,
        availableBalance: lastMaxWithdraw
          ? lastMaxWithdraw.availableBalance - req.body.amount
          : -req.body.amount,
        maxWithdraw: lastMaxWithdraw
          ? lastMaxWithdraw.maxWithdraw - req.body.amount
          : -req.body.amount,
        cash: lastMaxWithdraw
          ? lastMaxWithdraw.cash - req.body.amount
          : -req.body.amount,
        credit: lastMaxWithdraw?.credit || 0,
        creditRemaining: lastMaxWithdraw?.creditRemaining || 0,
        cashOrCredit: 'Cash',
      });
      await cash.save();
    }

    //  Dealer to Dealer
    else if ( Dealers.includes(currentUserParent.role) && Dealers.includes(userToUpdate.role)) {
      userToUpdate.clientPL -= req.body.amount;
      userToUpdate.cash -= req.body.amount;
      // currentUserParent.clientPL += req.body.amount;
      currentUserParent.cash += req.body.amount;

      // Add Cash
      let cash = new Cash({
        userId: userToUpdate.userId,
        description: req.body.description ? req.body.description : '(Cash)',
        createdBy: req.decoded.userId,
        amount: -req.body.amount,
        balance: lastMaxWithdraw ? lastMaxWithdraw.balance : 0,
        availableBalance: lastMaxWithdraw
          ? lastMaxWithdraw.availableBalance
          : 0,
        maxWithdraw: lastMaxWithdraw
          ? lastMaxWithdraw.maxWithdraw - req.body.amount
          : -req.body.amount,
        cash: lastMaxWithdraw
          ? lastMaxWithdraw.cash - req.body.amount
          : -req.body.amount,
        credit: lastMaxWithdraw?.credit || 0,
        creditRemaining: lastMaxWithdraw?.creditRemaining || 0,
        cashOrCredit: 'Cash',
      });
      await cash.save();
      // -VS Cash from parent
      let parentCash = new Cash({
        userId: currentUserParent.userId,
        description: req.body.description ? req.body.description : '(Cash)',
        createdBy: req.decoded.userId,
        amount: req.body.amount,
        balance: parentLastMaxWithdraw ? parentLastMaxWithdraw.balance : 0,
        availableBalance: parentLastMaxWithdraw
          ? parentLastMaxWithdraw.availableBalance
          : 0,
        maxWithdraw: parentLastMaxWithdraw
          ? parentLastMaxWithdraw.maxWithdraw + req.body.amount
          : req.body.amount,
        cash: parentLastMaxWithdraw
          ? parentLastMaxWithdraw.cash + req.body.amount
          : req.body.amount,
        credit: parentLastMaxWithdraw?.credit || 0,
        creditRemaining: parentLastMaxWithdraw?.creditRemaining || 0,
        cashOrCredit: 'Cash',
      });
      await parentCash.save();
    }
    //  Dealer to Battor
    else if (Dealers.includes(currentUserParent.role) && userToUpdate.role == '5') {
      userToUpdate.balance -= req.body.amount;
      userToUpdate.availableBalance -= req.body.amount;
      userToUpdate.clientPL -= req.body.amount;
      userToUpdate.cash -= req.body.amount;
      currentUserParent.cash += req.body.amount;
      let cash = new Cash({
        userId: userToUpdate.userId,
        description: req.body.description ? req.body.description : '(Cash)',
        createdBy: req.decoded.userId,
        amount: -req.body.amount,
        balance: lastMaxWithdraw
          ? lastMaxWithdraw.balance - req.body.amount
          : -req.body.amount,
        availableBalance: lastMaxWithdraw
          ? lastMaxWithdraw.availableBalance - req.body.amount
          : -req.body.amount,
        maxWithdraw: lastMaxWithdraw
          ? lastMaxWithdraw.maxWithdraw - req.body.amount
          : -req.body.amount,
        cash: lastMaxWithdraw
          ? lastMaxWithdraw.maxWithdraw - req.body.amount
          : -req.body.amount,
        credit: lastMaxWithdraw?.credit || 0,
        creditRemaining: lastMaxWithdraw?.creditRemaining || 0,
        cashOrCredit: 'Cash',
      });
      await cash.save();

      // parent update
      let parentCash = new Cash({
        userId: currentUserParent.userId,
        description: req.body.description ? req.body.description : '(Cash)',
        createdBy: req.decoded.userId,
        amount: req.body.amount,
        balance: parentLastMaxWithdraw ? parentLastMaxWithdraw.balance : 0,
        availableBalance: parentLastMaxWithdraw
          ? parentLastMaxWithdraw.availableBalance
          : 0,
        maxWithdraw: parentLastMaxWithdraw
          ? parentLastMaxWithdraw.maxWithdraw + req.body.amount
          : req.body.amount,
        cash: parentLastMaxWithdraw
          ? parentLastMaxWithdraw.maxWithdraw + req.body.amount
          : req.body.amount,
        credit: parentLastMaxWithdraw?.credit || 0,
        creditRemaining: parentLastMaxWithdraw?.creditRemaining || 0,
        cashOrCredit: 'Cash',
      });
      await parentCash.save();
    } else {
      return res.status(400).send({ message: 'Invalid Request' });
    }
    await userToUpdate.save();
    await currentUserParent.save();

    const updatedUser = await User.findOne({
      userId: req.body.userId,
      isDeleted: false,
    });
    const user_new_balance = updatedUser.balance;
    const user_new_availableBalance = updatedUser.availableBalance;
    const user_new_exposure = updatedUser.exposure;
    const updatedUserLastLedger = await Cash.find({
      userId: userToUpdate.userId,
    }).sort({ _id: -1 }).limit(1);
    const ExpTran = new ExpRec({
      userId: updatedUser.userId,
      trans_from: 'cashWithDraw',
      trans_from_id: updatedUserLastLedger._id,
      trans_bet_status: 0,
      user_prev_balance: user_prev_balance,
      user_prev_availableBalance: user_prev_availableBalance,
      user_prev_exposure: user_prev_exposure,
      user_new_balance: user_new_balance,
      user_new_availableBalance: user_new_availableBalance,
      user_new_exposure: user_new_exposure,
    });
    await ExpTran.save();

    return res.send({
      success: true,
      message: 'Cash withdrawl added successfully',
      results: null,
    });
  } catch (err) {
    console.error(err);
    return res.status(404).send({ message: 'server error', err });
  }
}

function getLedgerDetails(req, res) {
  try{
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).send({ errors: errors.errors });
    }
  
    const query = { userId: req.body.userId };
    let page = 1;
    let sort = -1;
    let sortValue = '_id';
    let limit = config.pageSize;
    //console.log('limit:', limit);
    if ( req.body.numRecords &&  req.body.numRecords > 0 && !isNaN(req.body.numRecords)) limit = Number(req.body.numRecords);
    if (req.body.sortValue) sortValue = req.body.sortValue;
    if (req.body.sort) sort = Number(req.body.sort);
    if (req.body.page) page = Number(req.body.page);
  
    User.findOne(query, (err, user) => {
      if (err || !user) {
        return res.status(404).send({ message: 'User not found' });
      }
      let cashPipeline = [{ 
        $match: { 
          userId: Number(req.body.userId),
          $and: [
            {
              createdAt: {$gte: req.body.startDate}
            },
            {
              createdAt: {$lte: req.body.endDate}
            }
          ]
        } 
      }];
  
      const userRole = user.role;
  
      if (userRole !== '5' && req.body.type ){
        cashPipeline.push({ $match: { cashOrCredit: req.body.type }, });
      }

      if (req.body.searchValue) {
        const searchRegex = new RegExp(req.body.searchValue, 'i');
        cashPipeline.push({
          $match: {
            $or: [
              { description: { $regex: searchRegex } },
              {
                $expr: {
                  $regexMatch: {
                    input: { $toString: '$amount' },
                    regex: searchRegex,
                  },
                },
              },
              {
                $expr: {
                  $regexMatch: {
                    input: { $toString: '$maxWithdraw' },
                    regex: searchRegex,
                  },
                },
              },
            ],
          },
        });
      }

      cashPipeline.push({
        $group: {
          // _id: "$_id",
          _id: {
            $cond: {
              if: 
              { $in: ["$cashOrCredit", ['Cash', 'Credit']] }, 
              then: "$_id", 
              else: {
                matchId: "$matchId",
                marketId: "$marketId",
                betSession: "$betSession",
                roundId: "$roundId"
              }
            }
          },
          originalId: { $first: "$_id" },
          description:  { $first: "$description" },
          amount:  { $sum: "$amount" },
          balance:  { $last: "$balance" },
          availableBalance:  { $last: "$availableBalance" },
          maxWithdraw:  { $last: "$maxWithdraw" },
          betTime	:  { $first: "$betDateTime" },
          cashOrCredit : { $first: "$cashOrCredit" },
          date	:  { $first: "$date" },
          createdAt	:  { $first: "$createdAt" },
          sportsId: { $first: "$sportsId" },
          marketId: { $first: "$marketId" },
          roundId: { $first: "$roundId" },
          betId: { $first: "$betId" },
          userId: { $first: "$userId" },
          matchId: { $first: "$matchId" },
        },
      })
  
      cashPipeline.push(
        {
          $sort: { date: 1 },
        },
        {
          $facet: {
            metadata: [{ $count: 'total' }],
            results: [{ $skip: (page - 1) * limit }, { $limit: limit }],
          },
        }
      );

      //console.log('cashPipeline:', cashPipeline);

      Cash.aggregate(cashPipeline, async (err, result) => {

        if(result[0].results&&result[0].results.length>0){
         for(let i=0;i<result[0].results.length;i++){
          //console.log()
          if(result[0].results[i].betId){
            try{
              const betInfo = await Bet.findOne({
                _id: result[0].results[i].betId
              })

              result[0].results[i].betSession = betInfo?.betSession;
              result[0].results[i].matchType = betInfo?.matchType;
              result[0].results[i].matchId = betInfo?.matchId;
              result[0].results[i].SessionScore = betInfo?.SessionScore;
              result[0].results[i].winnerRunnerData = betInfo?.winnerRunnerData;
              result[0].results[i].fancyData = betInfo?.fancyData;
              result[0].results[i].isfancyOrbookmaker = betInfo?.isfancyOrbookmaker;
              result[0].results[i].roundId = betInfo?.roundId;
            } catch (err) {
              continue;
            }
          }
         }
        }
        if (
          err ||
          !result ||
          result.length === 0 ||
          result[0].results.length === 0
        ) {
          return res.status(200).send({ message: 'Deposit record not found' });
        }
  
        const responseData = {
          message: 'Deposit Records',
  
          results: {
            docs: result[0].results,
            total: result[0].metadata[0] ? result[0].metadata[0].total : 0,
            limit: limit ? limit : 0,
            page: page ? page : 0,
            pages:
              limit && result[0].metadata[0].total
                ? Number((result[0].metadata[0].total / limit).toFixed(0))
                : 0,
          },
        };
  
        return res.send(responseData);
      });
  
   
    });
  } catch (err) {
    res.status(500).json({success: false, msg: "Failed to get Ledger Detail info"})
  }
  
}

function getLedgerDetails2(req, res) {
  try{
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).send({ errors: errors.errors });
    }
  
    const query = { userId: req.body.userId };
    let page = 1;
    let sort = -1;
    let sortValue = '_id';
    let limit = config.pageSize;
    //console.log('limit:', limit);
    if ( req.body.numRecords &&  req.body.numRecords > 0 && !isNaN(req.body.numRecords)) limit = Number(req.body.numRecords);
    if (req.body.sortValue) sortValue = req.body.sortValue;
    if (req.body.sort) sort = Number(req.body.sort);
    if (req.body.page) page = Number(req.body.page);
  
    User.findOne(query, (err, user) => {
      if (err || !user) {
        return res.status(404).send({ message: 'User not found' });
      }
      let cashPipeline = [{ 
        $match: { 
          userId: Number(req.body.userId),
          $and: [
            {
              createdAt: {$gte: req.body.startDate}
            },
            {
              createdAt: {$lte: req.body.endDate}
            }
          ]
        } 
      }];
  
      const userRole = user.role;
  
      if (userRole !== '5' && req.body.type ){
        cashPipeline.push({ $match: { cashOrCredit: req.body.type }, });
      }

      if (req.body.searchValue) {
        const searchRegex = new RegExp(req.body.searchValue, 'i');
        cashPipeline.push({
          $match: {
            $or: [
              { description: { $regex: searchRegex } },
              {
                $expr: {
                  $regexMatch: {
                    input: { $toString: '$amount' },
                    regex: searchRegex,
                  },
                },
              },
              {
                $expr: {
                  $regexMatch: {
                    input: { $toString: '$maxWithdraw' },
                    regex: searchRegex,
                  },
                },
              },
            ],
          },
        });
      }

      cashPipeline.push({
        $group: {
          _id: "$_id",
          // _id: {
          //   $cond: {
          //     if: 
          //     { $in: ["$cashOrCredit", ['Cash', 'Credit']] }, 
          //     then: "$_id", 
          //     else: {
          //       matchId: "$matchId",
          //       marketId: "$marketId",
          //       betSession: "$betSession",
          //       roundId: "$roundId"
          //     }
          //   }
          // },
          originalId: { $first: "$_id" },
          description:  { $first: "$description" },
          amount:  { $sum: "$amount" },
          balance:  { $last: "$balance" },
          availableBalance:  { $last: "$availableBalance" },
          maxWithdraw:  { $last: "$maxWithdraw" },
          betTime	:  { $first: "$betDateTime" },
          date	:  { $first: "$date" },
          createdAt	:  { $first: "$createdAt" },
          cashOrCredit : { $first: "$cashOrCredit" },
          sportsId: { $first: "$sportsId" },
          marketId: { $first: "$marketId" },
          betId: { $first: "$betId" },
          userId: { $first: "$userId" },
        },
      })
  
      cashPipeline.push(
        {
          $sort: { date: 1 },
        },
        {
          $facet: {
            metadata: [{ $count: 'total' }],
            results: [{ $skip: (page - 1) * limit }, { $limit: limit }],
          },
        }
      );

      //console.log('cashPipeline:', cashPipeline);

      Cash.aggregate(cashPipeline, async (err, result) => {

        if(result[0].results&&result[0].results.length>0){
         for(let i=0;i<result[0].results.length;i++){
          if(result[0].results[i].betId){
            try{
              const betInfo = await Bet.findOne({
                _id: result[0].results[i].betId
              })

              result[0].results[i].betSession = betInfo?.betSession;
              result[0].results[i].matchType = betInfo?.matchType;
              result[0].results[i].SessionScore = betInfo?.SessionScore;
              result[0].results[i].winnerRunnerData = betInfo?.winnerRunnerData;
              result[0].results[i].fancyData = betInfo?.fancyData;
              result[0].results[i].isfancyOrbookmaker = betInfo?.isfancyOrbookmaker;
              result[0].results[i].roundId = betInfo?.roundId;
            } catch (err) {
              continue;
            }
          }
         }
        }
        if (
          err ||
          !result ||
          result.length === 0 ||
          result[0].results.length === 0
        ) {
          return res.status(200).send({ message: 'Deposit record not found' });
        }
  
        const responseData = {
          message: 'Deposit Records',
  
          results: {
            docs: result[0].results,
            total: result[0].metadata[0] ? result[0].metadata[0].total : 0,
            limit: limit ? limit : 0,
            page: page ? page : 0,
            pages:
              limit && result[0].metadata[0].total
                ? Number((result[0].metadata[0].total / limit).toFixed(0))
                : 0,
          },
        };
  
        return res.send(responseData);
      });
  
   
    });
  } catch (err) {
    res.status(500).json({success: false, msg: "Failed to get Ledger Detail info"})
  }
  
}
function getdeopsitDetailsCash(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).send({ errors: errors.errors });
    }

    const query = { userId: req.decoded.userId };
    let page = 1;
    let sort = -1;
    let sortValue = '_id';
    let limit = config.pageSize;

    if (req.body.numRecords && req.body.numRecords > 0 && !isNaN(req.body.numRecords)) 
      limit = Number(req.body.numRecords);
    
    if (req.body.sortValue) 
      sortValue = req.body.sortValue;
    
    if (req.body.sort) 
      sort = Number(req.body.sort);
    
    if (req.body.page) 
      page = Number(req.body.page);

    User.findOne(query, (err, user) => {
      if (err || !user) {
        return res.status(404).send({ message: 'User not found' });
      }
      console.log(req.decoded)

      let depositPipeline = [
     
        {
          $match: {
            userId: Number(req.decoded.userId),
            credit: 0, // Match deposits where cash field is zero
            cash: { $gt: 0 },
            cashOrCredit: "Cash",
            $and: [
              {
                createdAt: { $gte: req.body.startDate }
              },
              {
                createdAt: { $lte: req.body.endDate }
              }
            ]
          }
        },
     
      ];
      if (req.body.searchValue) {
        const searchRegex = new RegExp(req.body.searchValue, 'i');
        depositPipeline.push({
          $match: {
            $or: [
              { description: { $regex: searchRegex } },
              {
                $expr: {
                  $regexMatch: {
                    input: { $toString: '$amount' },
                    regex: searchRegex,
                  },
                },
              },
              {
                $expr: {
                  $regexMatch: {
                    input: { $toString: '$maxWithdraw' },
                    regex: searchRegex,
                  },
                },
              },
            ],
          },
        });
      }
      depositPipeline.push(
        {
          $group: {
            _id: "$_id",
            originalId: { $first: "$_id" },
            description: { $first: "$description" },
            amount: { $sum: "$amount" },
            balance: { $last: "$balance" },
            availableBalance: { $last: "$availableBalance" },
            maxWithdraw: { $last: "$maxWithdraw" },
            betTime: { $first: "$betDateTime" },
            date: { $first: "$date" },
            createdAt: { $first: "$createdAt" },
            cashOrCredit: { $first: "$cashOrCredit" },
            sportsId: { $first: "$sportsId" },
            marketId: { $first: "$marketId" },
            betId: { $first: "$betId" },
            userId: { $first: "$userId" },
            deposits:{$last: "$cash"}
          },
        },
        {
          $sort: { date: -1 },
        },
          {
            $facet: {
              metadata: [{ $count: 'total' }],
              results: [{ $skip: (page - 1) * limit }, { $limit: limit }],
            },
          }
      )
      Deposits.aggregate(depositPipeline, async (err, result) => {
        console.log(result);
        if (result[0].results && result[0].results.length > 0) {
          for (let i = 0; i < result[0].results.length; i++) {
            if (result[0].results[i].betId) {
              try {
                const betInfo = await Bet.findOne({
                  _id: result[0].results[i].betId
                })

                result[0].results[i].betSession = betInfo?.betSession;
                result[0].results[i].matchType = betInfo?.matchType;
                result[0].results[i].SessionScore = betInfo?.SessionScore;
                result[0].results[i].winnerRunnerData = betInfo?.winnerRunnerData;
                result[0].results[i].fancyData = betInfo?.fancyData;
                result[0].results[i].isfancyOrbookmaker = betInfo?.isfancyOrbookmaker;
                result[0].results[i].roundId = betInfo?.roundId;
              } catch (err) {
                continue;
              }
            }
          }
        }
        if (err || !result || result.length === 0 || result[0].results.length === 0) {
          return res.status(200).send({ message: 'Deposit record not found' });
        }

        const responseData = {
          message: 'Deposit Records',
          results: {
            docs: result[0].results,
            total: result[0].metadata[0] ? result[0].metadata[0].total : 0,
            limit: limit ? limit : 0,
            page: page ? page : 0,
            pages: limit && result[0].metadata[0].total ? Number((result[0].metadata[0].total / limit).toFixed(0)) : 0,
          },
        };

        return res.send(responseData);
      });

    });
  } catch (err) {
    res.status(500).json({ success: false, msg: "Failed to get Ledger Detail info" });
  }

}
function getdepositDetailsCredit(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).send({ errors: errors.errors });
    }
   

    const query = { userId: req.decoded.userId };
    let page = 1;
    let sort = -1;
    let sortValue = '_id';
    let limit = config.pageSize;

    if (req.body.numRecords && req.body.numRecords > 0 && !isNaN(req.body.numRecords)) 
      limit = Number(req.body.numRecords);
    
    if (req.body.sortValue) 
      sortValue = req.body.sortValue;
    
    if (req.body.sort) 
      sort = Number(req.body.sort);
    
    if (req.body.page) 
      page = Number(req.body.page);

    User.findOne(query, (err, user) => {
      if (err || !user) {
        return res.status(404).send({ message: 'User not found' });
      }

      let depositPipeline = [
       
        {
          $match: {
            cash: 0,
            credit: { $gt: 0 },
            cashOrCredit: "Credit",
            userId: Number(req.decoded.userId),
            $and: [
              {
                createdAt: { $gte: req.body.startDate }
              },
              {
                createdAt: { $lte: req.body.endDate }
              }
            ]
          }
        },
      
      ];
      if (req.body.searchValue) {
        const searchRegex = new RegExp(req.body.searchValue, 'i');
        depositPipeline.push({
          $match: {
            $or: [
              { description: { $regex: searchRegex } },
              {
                $expr: {
                  $regexMatch: {
                    input: { $toString: '$amount' },
                    regex: searchRegex,
                  },
                },
              },
              {
                $expr: {
                  $regexMatch: {
                    input: { $toString: '$maxWithdraw' },
                    regex: searchRegex,
                  },
                },
              },
            ],
          },
        });
      }
      depositPipeline.push(
        {
          $group: {
            _id: "$_id",
            originalId: { $first: "$_id" },
            description: { $first: "$description" },
            amount: { $sum: "$amount" },
            balance: { $last: "$balance" },
            availableBalance: { $last: "$availableBalance" },
            maxWithdraw: { $last: "$maxWithdraw" },
            betTime: { $first: "$betDateTime" },
            date: { $first: "$date" },
            createdAt: { $first: "$createdAt" },
            cashOrCredit: { $first: "$cashOrCredit" },
            sportsId: { $first: "$sportsId" },
            marketId: { $first: "$marketId" },
            betId: { $first: "$betId" },
            userId: { $first: "$userId" },
            deposits:{$last: "$cash"}
          },
        },
        {
          $sort: { date: -1 },
        },
          {
            $facet: {
              metadata: [{ $count: 'total' }],
              results: [{ $skip: (page - 1) * limit }, { $limit: limit }],
            },
          }
      )
      Deposits.aggregate(depositPipeline, async (err, result) => {
        console.log(result);
        if (result[0].results && result[0].results.length > 0) {
          for (let i = 0; i < result[0].results.length; i++) {
            if (result[0].results[i].betId) {
              try {
                const betInfo = await Bet.findOne({
                  _id: result[0].results[i].betId
                })

                result[0].results[i].betSession = betInfo?.betSession;
                result[0].results[i].matchType = betInfo?.matchType;
                result[0].results[i].SessionScore = betInfo?.SessionScore;
                result[0].results[i].winnerRunnerData = betInfo?.winnerRunnerData;
                result[0].results[i].fancyData = betInfo?.fancyData;
                result[0].results[i].isfancyOrbookmaker = betInfo?.isfancyOrbookmaker;
                result[0].results[i].roundId = betInfo?.roundId;
              } catch (err) {
                continue;
              }
            }
          }
        }
        if (err || !result || result.length === 0 || result[0].results.length === 0) {
          return res.status(200).send({ message: 'Deposit record not found' });
        }

        const responseData = {
          message: 'Deposit Records',
          results: {
            docs: result[0].results,
            total: result[0].metadata[0] ? result[0].metadata[0].total : 0,
            limit: limit ? limit : 0,
            page: page ? page : 0,
            pages: limit && result[0].metadata[0].total ? Number((result[0].metadata[0].total / limit).toFixed(0)) : 0,
          },
        };

        return res.send(responseData);
      });

    });
  } catch (err) {
    res.status(500).json({ success: false, msg: "Failed to get Ledger Detail info" });
  }

}

async function getAllDeposits(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).send({ errors: errors.errors });
  }

  User.findOne({ userId: req.query.userId }, (err, user) => {
    if (err || !user)
      return res.status(404).send({ message: 'User not found' });
    User.findOne({ userId: user.createdBy }, (err, parentUser) => {
      if (err || !parentUser)
        return res.status(404).send({ message: 'User not found' });
      Cash.findOne(
        { userId: req.query.userId },
        // creditlimit should be of the parent user
        { maxWithdraw: 1 }
      )
        .sort({ _id: -1 })
        .exec( async (err, results) => {
          // const resp = await userWithdrawStatusCheck(Number(req.query.userId))
          if (err) {
            //console.log('Error'.err);
            return res.status(404).send({ message: 'Record not found' });
          }
          if (!results) {
            return res.status(200).send({
              message: 'Record not found',
              // status: resp,
              results: {
                maxWithdraw: 0,
                creditLimit: 0,
                balance: 0,
                credit: 0,
                availableBalance: 0,
              },
            });
          }

          

          if (user.role == '5') {
            return res.send({
              message: 'Deposit Record Found',
              // status: resp,
              results: {
                maxWithdraw: user.availableBalance,
                creditLimit: parentUser.creditRemaining,
                balance: user.balance,
                credit: user.credit,
                availableBalance: user.availableBalance,
              },
            });
          } else {
            return res.send({
              message: 'Deposit Record Found',
              // status: resp,
              results: {
                ...results._doc,
                creditLimit: parentUser.creditRemaining,
                balance: user.balance,
                credit: user.credit,
                availableBalance: user.availableBalance,
              },
            });
          }
        });
    });
  });
}

// const userWithdrawStatusCheck = async (userId) => {
//   const resp = {
//     status: 200,
//     englush: "Take screenshot and contact support team",
//     urdu: "اسکرین شاٹ لیں اور سپورٹ ٹیم سے رابطہ کریں۔"
//   }
//   // const userId = Number(req.query.id);
//   const user   = await  User.findOne({ userId: userId })
//   const deposit = await Cash.find({ userId: userId }).sort({ _id: -1 }).limit(1);
//   const lastDeposit = deposit[0]
//   const activeBetsCount = await Bet.countDocuments({ userId: userId, status: 1 });
//   const difference = lastDeposit.availableBalance - user.availableBalance - (-user.exposure)
//   if(user.exposure > 1 ){
//     resp.status = 400;
//   }else if(user.exposure < -1 && activeBetsCount === 0){
//     resp.status = 400;
//   }else if(user.exposure < -1 && activeBetsCount > 0 &&   ( difference < -1 || difference > 1 )){
//     resp.status = 400;
//   }
//   return resp
// }

loginRouter.post(
  '/addCashDeposit',
  cashValidator.validate('addCashDeposit'),
  addCashDeposit
);
loginRouter.post(
  '/withDrawCashDeposit',
  cashValidator.validate('withDrawCashDeposit'),
  withDrawCashDeposit
);
loginRouter.post('/getLedgerDetails', getLedgerDetails);
loginRouter.post('/getLedgerDetails2', getLedgerDetails2);
loginRouter.post('/getdeopsitDetailsCredit', getdeopsitDetailsCash);
loginRouter.get('/getAllDeposits', getAllDeposits);
module.exports = { loginRouter ,getdeopsitDetailsCash,getdepositDetailsCredit};
