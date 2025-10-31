const express = require('express');
const User = require('../models/user');
const router = express.Router();
const ExpRec = require("../models/ExpRec");
const CasinoDebits = require('../models/casinoCalls');
const Cash = require("../../app/models/deposits");
const crypto = require('crypto');
const config = require('config');
const { MongoClient } = require('mongodb');
const casinoMultiples = config.casinoMultiples;
const { getParents } = require("./bets");
const SelectedCasino = require("../models/selectedCasino");
const DBNAME = process.env.DB_NAME;
const DBHost = process.env.DBHost;
const saltKey = process.env.saltKey;

let transactionIdMap = new Map()

/**
 *
 * Latest tasks
 * 1 > Description include game name in it
 * 2 > roundId in Deposits
 *
 */

const transactionOptions = {
  readPreference: 'primary',
  readConcern: { level: 'local' },
  writeConcern: { w: 'majority' }
}
const dbClient = new MongoClient(`${DBHost}?directConnection=true`, { useUnifiedTopology: true });
const casinoCalls = dbClient.db(`${DBNAME}`).collection('casinocalls');
const users = dbClient.db(`${DBNAME}`).collection('users');

const checkMarketBlocked = async (user) => {
  let parentUserIds = await getParents(user.userId);
  const marketIds = await User.distinct("blockedMarketPlaces", { userId: { $in: parentUserIds }, isDeleted: false });
  const marketId = config.casinoMarketId;

  if (marketIds.includes(marketId)) {
    return 1;
  } else {
    return 0;
  }
}

const WinLoseTransManagement = async (balance, payload, users123, action, res, session) => {
  try {
    const user = await users.findOne({ remoteId: Number(payload.remote_id) });
    /*
      action= 0 debit
      action= 1 credit( decision came from casino )
      debit = 1350
      credit=  600 or 1350 or 1800
      let bettor_winning_amount = 0;
      let bettor_lost_amount = 0;
    */

    const now = new Date();
    const year = now.getFullYear().toString();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    const formattedDate = `${year}-${month}-${day}`;

    if (action === 0) {
      let amount = Number(payload.amount) * casinoMultiples;
      let UpdatedExposure = Number((user.exposure - amount).toFixed(3));
      let updatedavailableBalance = Number((user.availableBalance - (amount)).toFixed(3));

      /**
       * let lastMaxWithdraw = await Cash.findOne( {userId: user.userId}).sort({ _id: -1 });
       * ////console.log(" lastMaxWithdraw ============== ", lastMaxWithdraw);
       */
      await users.updateOne(
        { _id: user._id },
        {
          $set: {
            availableBalance: updatedavailableBalance,
            exposure: UpdatedExposure
          }
        },
        { session }
      );

      const casinoDebits = new CasinoDebits(payload);
      await casinoDebits.save();
      // ////console.log(" allTrans created Successfully ");
      return 0
    } else if (action === 1) {
      const user_prev_balance = user.balance;
      const user_prev_availableBalance = user.availableBalance;
      const user_prev_exposure = user.exposure;

      const gamesList = await SelectedCasino.findOne(
        { "games.id": payload.game_id },
        { "games.$": 1 }
      );

      const game = gamesList?.games[0];

      // ////console.log(" ======================= CREDIT IS CAALED ======================= ");

      const lastDebits = await CasinoDebits.find({
        action: 'debit',
        game_id: payload.game_id,
        round_id: payload.round_id,
        remote_id: Number(payload.remote_id)
      });

      // ////console.log(" ======================== lastDebits ======================== ", lastDebits.length);
      let debit = 0;
      for (const lastDebit of lastDebits) {
        debit = debit + Number(lastDebit.amount)
      }

      const credit = Number(payload.amount);
      const difference = credit - debit;
      const allTrans = [];
      // lose some Amount 
      const betTime = new Date().getTime();
      if (difference < 0) {
        // ////console.log("   ======================= difference < 0 =======================   ");
        /**
         * lose some money mean there will not be any commission only adjust the lost amount into exposure.
         * 400-1500 = -1100 OR 1499-1500 = -1 OR 0-1500 = -1500
         * suppose 1300 was lost money. credit of 200 will be added to available balance
         *
         * debit  1500
         * credit  400
         *
         * differencee = -1100
         *
         * its mean User lose 1100
         *
         */
        const updatedavailableBalance = user.availableBalance + (credit * casinoMultiples);
        const updatedclientPL = Number((user.clientPL + (difference * casinoMultiples)).toFixed(3));
        const updatedbalance = Number((user.balance + (difference * casinoMultiples)).toFixed(3));
        const bettor_lost_amount = Number(((debit - credit) * casinoMultiples).toFixed(3));
        const allTrans = [];

        // remove all exposure equal to total debit money of 1500

        const amount = Number((debit * config.casinoMultiples).toFixed(3));
        const UpdatedExposure = Number((user.exposure + amount).toFixed(3));

        await users.updateOne(
          { _id: user?._id },
          {
            $set: {
              availableBalance: updatedavailableBalance,
              exposure: UpdatedExposure,
              clientPL: updatedclientPL,
              balance: updatedbalance
            }
          },
          { session }
        );

        const lastMaxWithdraw = await Cash.findOne({ userId: user.userId }).sort({ _id: -1 });

        //divide lost money to all share holders.

        let BettorLostTran = {
          userId: user.userId,
          description: `Casino (${game.name})`,
          date: now.getTime(),
          createdAt: formattedDate,
          amount: -bettor_lost_amount,
          balance: lastMaxWithdraw ? lastMaxWithdraw.balance - bettor_lost_amount : -bettor_lost_amount,
          availableBalance: lastMaxWithdraw ? lastMaxWithdraw.availableBalance - bettor_lost_amount : -bettor_lost_amount,
          maxWithdraw: lastMaxWithdraw ? lastMaxWithdraw.maxWithdraw - bettor_lost_amount : 0,
          cash: lastMaxWithdraw?.cash || 0,
          credit: lastMaxWithdraw?.credit || 0,
          creditRemaining: lastMaxWithdraw?.creditRemaining || 0,
          calledArea: " difference < 0 ",
          createdBy: 0,
          casinoBetAmount: debit,
          event: game.name,
          betDateTime: betTime,
          betId: payload.transaction_id,
          marketId: payload.game_id,
          roundId: payload.round_id,
          matchId: payload.game_id,
          cashOrCredit: "Bet",
          sportsId: "6",
        }
        allTrans.push(BettorLostTran)

        //start of code for giving shares to all share holders

        const parentUserIds = [];
        let currentUserId = user.userId;
        while (currentUserId) {

          const parentUser = await users.findOne(
            { userId: currentUserId },
            { session }
          );
          if (parentUser.role == "0") {
            // ////console.log("break User area ");
            break;
          }
          parentUserIds.push(parentUser.createdBy);
          currentUserId = parentUser.createdBy;
        }

        // ////console.log(" parentUser  ============ ", parentUserIds);
        const parentUser = await users.find(
          { userId: { $in: parentUserIds }, isDeleted: false }
        ).sort({ role: -1 }).toArray();

        // ////console.log(" parentUser  ============ ", parentUser);

        if (!parentUser) {
          ////console.log(" ============ Parent User Not Found ============ ");
          return res.json({ status: '500', msg: `Internal Server Error` });
        }
        let commissionFrom = user.userId;
        let upMovingAmount = bettor_lost_amount;
        let prev = 0;
        for (const user of parentUser) {
          let current = user.downLineShare;
          user["commission"] = current - prev;
          prev = current;
        }

        ////console.log(" ================= Commission Setting Done ================= ");
        for (const user of parentUser) {
          /**
           * 85 Admin  15
           * 70 Smaster  20
           * 50 Master  50
           * 0 Battor
           */

          const availableBalance = Number((user.availableBalance + (user.commission / 100) * bettor_lost_amount).toFixed(3));
          const balance = Number((user.balance + (user.commission / 100) * bettor_lost_amount).toFixed(3));
          const clientPL = user.clientPL - user.downLineShare !== 100 ? Number((user.clientPL - ((100 - user.downLineShare) / 100) * bettor_lost_amount).toFixed(3)) : 0;
          const userResponse = await users.updateOne(
            { _id: user?._id },
            {
              $set: {
                availableBalance: availableBalance,
                clientPL: clientPL,
                balance: balance
              }
            },
            { session }
          );

          const lastMaxWithdraw = await Cash.findOne({ userId: user.userId }).sort({ _id: -1 });
          // ////console.log(' last Max Withdraw ========== ', lastMaxWithdraw);

          let betTransaction = {
            userId: user.userId,
            description: `Casino (${game.name})`,
            date: now.getTime(),
            createdAt: formattedDate,
            commissionFrom: commissionFrom,
            createdBy: 0,
            betDateTime: betTime,
            casinoBetAmount: debit,
            amount: (user.commission / 100) * bettor_lost_amount,
            balance: lastMaxWithdraw ? lastMaxWithdraw.balance + (user.commission / 100) * bettor_lost_amount : (user.commission / 100) * bettor_lost_amount,
            availableBalance: lastMaxWithdraw ? lastMaxWithdraw.availableBalance + (user.commission / 100) * bettor_lost_amount : (user.commission / 100) * bettor_lost_amount,
            maxWithdraw: lastMaxWithdraw ? lastMaxWithdraw.maxWithdraw + (user.commission / 100) * bettor_lost_amount : 0,  // max withdraw cant be negative
            cash: lastMaxWithdraw ? lastMaxWithdraw.cash : 0,
            credit: lastMaxWithdraw ? lastMaxWithdraw.credit : 0,
            creditRemaining: lastMaxWithdraw ? lastMaxWithdraw.creditRemaining : 0,
            betId: payload.transaction_id,
            cashOrCredit: "Bet",
            sportsId: "6",
            event: game.name,
            roundId: payload.round_id,
            marketId: payload.game_id,
            matchId: payload.game_id,
            upLineAmount: upMovingAmount
          }

          allTrans.push(betTransaction);

          upMovingAmount = Number((upMovingAmount - (user.commission / 100) * bettor_lost_amount).toFixed(3));
          commissionFrom = user.userId;
        }
        await Cash.insertMany(allTrans);
        //end of code to give lost money to all share holders
        const casinoDebits = new CasinoDebits(payload);
        await casinoDebits.save();
      } else if (difference > 0) {
        // Win some Amount
        ////console.log(" ======================= difference > 0 ======================= ");

        /**
         * Win Some Amount
         * so available balance will be updated with credit money ( user.availablebalance+credit ),
         */

        /**
         * remove all exposure equal to total debit money of 1500
         * set exposure to original ( user.exposure +  debit )
         * let amount = debit * config.casinoMultiples;
         * avl balance - 1500
         * Expoisure -1500
         * Credit  Amount 1600
         * Winning Amount 100
         *
         */

          ////console.log("=============start of giving commissions and loss shares on amount which is WON by bettor");
        let bettor_won_amount = credit - debit;
        //deduct commission amount from above bettor_won_amount, and UpdatedAvailableBalance ( debit + wonAmountAfterCommission )

        const amount = bettor_won_amount * casinoMultiples;
        const remainingAmount = Number(((amount / 100) * (100 - config.commission)).toFixed(3));
        const commissionAmount = Number(((amount / 100) * config.commission).toFixed(3));
        let upMovingAmount = Number(amount.toFixed(3));
        let commissionFrom = user.userId;
        let upMovingCommAmount = Number(commissionAmount.toFixed(3));

        const updatedavailableBalance = Number((user.availableBalance + (remainingAmount) + debit * config.casinoMultiples).toFixed(3));
        const updatedclientPL = Number((user.clientPL + (remainingAmount)).toFixed(3));
        const updatedbalance = Number((user.balance + (remainingAmount)).toFixed(3));
        const UpdatedExposure = Number(((user.exposure) + (debit * config.casinoMultiples)).toFixed(3));

        const userResponse = await users.updateOne(
          { _id: user?._id },
          {
            $set: {
              availableBalance: updatedavailableBalance,
              clientPL: updatedclientPL,
              balance: updatedbalance,
              exposure: UpdatedExposure,
            }
          },
          { session }
        );

        const lastMaxWithdraw = await Cash.findOne({ userId: user.userId }).sort({ _id: -1 });

        ////console.log(" ================ lastMaxWithdraw ================ ", lastMaxWithdraw);
        let UserWinBetTrans = {
          userId: user.userId,
          description: `Casino (${game.name})`,
          date: now.getTime(),
          createdAt: formattedDate,
          createdBy: 0,
          betDateTime: betTime,
          casinoBetAmount: debit,
          amount: remainingAmount,
          balance: lastMaxWithdraw ? lastMaxWithdraw.balance + remainingAmount : remainingAmount,
          availableBalance: lastMaxWithdraw ? lastMaxWithdraw.availableBalance + remainingAmount : remainingAmount,
          maxWithdraw: lastMaxWithdraw ? lastMaxWithdraw.maxWithdraw + remainingAmount : remainingAmount,
          cashOrCredit: "Bet",
          cash: lastMaxWithdraw ? lastMaxWithdraw.cash : 0,
          credit: lastMaxWithdraw?.credit || 0,
          creditRemaining: lastMaxWithdraw?.creditRemaining || 0,
          betId: payload.transaction_id,
          roundId: payload.round_id,
          calledArea: "difference > 0",
          event: game.name,
          sportsId: "6",
          marketId: payload.game_id,
          matchId: payload.game_id,
        }

        allTrans.push(UserWinBetTrans)

        const parentUserIds = [];
        let currentUserId = user.userId;
        while (currentUserId) {
          const parentUser = await users.findOne(
            { userId: currentUserId },
            { session }
          );
          if (parentUser.role == "0") {
            ////console.log("break User area ");
            break;
          }
          parentUserIds.push(parentUser.createdBy);
          currentUserId = parentUser.createdBy;
        }

        ////console.log(" parentUser  ============ ", parentUserIds);

        const parentUser = await users.find(
          { userId: { $in: parentUserIds }, isDeleted: false }
        ).sort({ role: -1 }).toArray();

        ////console.log(" parentUser  ============ ", parentUser);

        if (!parentUser) {
          ////console.log(" ============ Parent User Not Found ============ ");
          return res.json({ status: '500', msg: `Internal Server Error` });
        }

        let prev = 0;
        for (const user of parentUser) {
          let current = user.downLineShare;
          user["commission"] = current - prev;
          prev = current;
        }

        ////console.log(" ================= Commission Setting Done ================= ");

        for (const user of parentUser) {

          const lastMaxWithdraw = await Cash.findOne({ userId: user.userId }).sort({ _id: -1 });
          ////console.log(' last Max Withdraw ========== ', lastMaxWithdraw);

          let availableBalance = Number((user.balance - (user.commission / 100) * remainingAmount).toFixed(3));
          let Balancebalance = Number((user.balance - (user.commission / 100) * remainingAmount).toFixed(3));
          let clientPL = user.downLineShare !== 100 ? Number((user.clientPL + ((100 - user.downLineShare) / 100) * remainingAmount).toFixed(3)) : 0;

          let userResponse = await users.updateOne(
            { _id: user?._id }, {
              $set: {
                availableBalance: availableBalance,
                clientPL: clientPL,
                balance: Balancebalance
              }
            },
            { session }
          );

          let betTransaction = {
            userId: user.userId,
            description: `Casino (${game.name})`,
            date: now.getTime(),
            createdAt: formattedDate,
            createdBy: 0,
            betDateTime: betTime,
            casinoBetAmount: debit,
            amount: -(user.commission / 100) * amount,
            balance: lastMaxWithdraw ? lastMaxWithdraw.balance - (user.commission / 100) * amount : -(user.commission / 100) * amount,
            availableBalance: lastMaxWithdraw ? lastMaxWithdraw.availableBalance - (user.commission / 100) * amount : -(user.commission / 100) * amount,
            maxWithdraw: lastMaxWithdraw ? lastMaxWithdraw.maxWithdraw - (user.commission / 100) * amount : 0,
            cash: lastMaxWithdraw ? lastMaxWithdraw.cash : 0,
            credit: lastMaxWithdraw?.credit || 0,
            creditRemaining: lastMaxWithdraw?.creditRemaining || 0,
            cashOrCredit: "Bet",
            sportsId: "6",
            event: game.name,
            marketId: payload.game_id,
            roundId: payload.round_id,
            betId: payload.transaction_id,
            matchId: payload.game_id,
            upLineAmount: upMovingCommAmount
          }
          allTrans.push(betTransaction)

          const prevBalance = lastMaxWithdraw ? lastMaxWithdraw.balance - (user.commission / 100) * amount : -(user.commission / 100) * amount;
          const prevAvailableBalance = lastMaxWithdraw ? lastMaxWithdraw.availableBalance - (user.commission / 100) * amount : -(user.commission / 100) * amount;
          const prevMaxWithdraw = lastMaxWithdraw ? lastMaxWithdraw.maxWithdraw - (user.commission / 100) * amount : 0;

          let commissionTransaction = {
            userId: user.userId,
            description: `Casino (${game.name})`,
            date: now.getTime(),
            createdAt: formattedDate,
            createdBy: 0,
            betDateTime: betTime,
            casinoBetAmount: debit,
            commissionFrom: commissionFrom,
            amount: (user.commission / 100) * commissionAmount,
            balance: prevBalance + (user.commission / 100) * commissionAmount,
            availableBalance: prevAvailableBalance + (user.commission / 100) * commissionAmount,
            maxWithdraw: prevMaxWithdraw + (user.commission / 100) * commissionAmount,
            // balance: lastMaxWithdraw ? lastMaxWithdraw.balance + (user.commission / 100) * commissionAmount : (user.commission / 100) * commissionAmount,
            // availableBalance: lastMaxWithdraw ? lastMaxWithdraw.availableBalance + (user.commission / 100) * commissionAmount : (user.commission / 100) * commissionAmount,
            // maxWithdraw: lastMaxWithdraw ? lastMaxWithdraw.maxWithdraw + (user.commission / 100) * commissionAmount : (user.commission / 100) * commissionAmount,
            cash: lastMaxWithdraw ? lastMaxWithdraw.cash + (user.commission / 100) * commissionAmount : (user.commission / 100) * commissionAmount,
            credit: lastMaxWithdraw?.credit || 0,
            creditRemaining: lastMaxWithdraw?.creditRemaining || 0,
            cashOrCredit: "Commission",
            betId: payload.transaction_id,
            roundId: payload.round_id,
            sportsId: "6",
            event: game.name,
            marketId: payload.game_id,
            matchId: payload.game_id,
            upLineAmount: upMovingCommAmount
          }

          allTrans.push(commissionTransaction);

          upMovingAmount = Number((upMovingAmount - (user.commission / 100) * amount).toFixed(3));
          upMovingCommAmount = Number((upMovingCommAmount - (user.commission / 100) * commissionAmount).toFixed(3));
          commissionFrom = user.userId;
        }

        await Cash.insertMany(allTrans);
        ////console.log(" =============end of giving commissions and loss shares on amount which is WON by bettor");

        const casinoDebits = new CasinoDebits(payload);
        await casinoDebits.save();
        ////console.log(" =============end of }else if (difference > 0){=============");
      } else if ((difference === 0)) {
        // No Win lose
        const updatedavailableBalance = Number((user.availableBalance + (debit * casinoMultiples)).toFixed(3))
        const UpdatedExposure = Number((user.exposure + (debit * casinoMultiples)).toFixed(3))
        await users.updateOne(
          { _id: user?._id },
          { $set: { availableBalance: updatedavailableBalance, exposure: UpdatedExposure } },
          { session }
        );

        const casinoDebits = new CasinoDebits(payload);
        await casinoDebits.save();
      }

      const updatedUser = await users.findOne({ remoteId: Number(payload.remote_id) });
      const user_new_balance = updatedUser.balance;
      const user_new_availableBalance = updatedUser.availableBalance;
      const user_new_exposure = updatedUser.exposure;

      const ExpTran = new ExpRec({
        userId: user.userId,
        trans_from: "casinobet",
        trans_from_id: payload.transaction_id,
        trans_bet_status: 0,
        user_prev_balance: user_prev_balance,
        user_prev_availableBalance: user_prev_availableBalance,
        user_prev_exposure: user_prev_exposure,
        user_new_balance: user_new_balance,
        user_new_availableBalance: user_new_availableBalance,
        user_new_exposure: user_new_exposure,
        marketId: payload.game_id,
        sportsId: 6,
      });

      await ExpTran.save();
      ////console.log(" ===================================================== ");
      ////console.log(" All Transection Successfull ");
      ////console.log(" ===================================================== ");
      return 0
    }
  } catch (err) {
    console.warn(`Error in Calculation ${err}`);
    return 1;
  }
}

function createHashKey(salt, queryString) {
  return crypto.createHash('sha1').update(salt + queryString).digest('hex');
}

async function balanceFun(req, res) {
  const payload = req.query;
  const salt = saltKey;
  const key = payload.key;
  delete payload.key;

  const queryString = Object.keys(payload)
    .map(key => `${key}=${payload[key]}`)
    .join('&');

  const hash = createHashKey(salt, queryString);

  // ////console.log('key:', key);
  // ////console.log('hash:', hash);
  // ////console.log('queryString:', queryString);

  if (hash !== key) {
    return res.json({
      status: 403,
      msg: 'INCORRECT_KEY_VALIDATION'
    });
  }

  try {
    const user = await User.findOne({ remoteId: payload.remote_id }).exec();

    if (!user) {
      return res.json({ status: 500, msg: 'Internal error no user' });
    }

    const checkMarketBlockedResponse = await checkMarketBlocked(user);
    if (checkMarketBlockedResponse == 1) {
      return res.json({ status: '500', msg: ' Batting is not allowed ! ' });
    }

    const balance = user.availableBalance;
    if (balance < 0) {
      return res.json({ status: 500, msg: 'Negative amount not allowed!' });
    }

    return res.json({
      status: 200,
      balance: balance / casinoMultiples,
    });
  } catch (err) {
    console.error(err);
    return res.json({ status: 500, msg: `Internal error ${err}` });
  } finally {
    res.json({
      status: 200,
    });
  }
}

async function debitFun(req, res) {
  const session = dbClient.startSession();
  try {
    const payload = req.query;
    const transactionId = payload.transaction_id
    const currentUser = await User.findOne(
      { remoteId: parseInt(payload.remote_id) }
    )
    if (!currentUser) {
      ////console.log(" ========================= User Not Found ============= ");
      return res.json({ status: '500', msg: `Internal Error no User` });
    }
    if (transactionIdMap.has(transactionId)) {
      ////console.log('====== same Trans already Exists', transactionId)
      return res.json({
        status: 200,
        balance: currentUser.availableBalance / casinoMultiples,
      });
    } else {
      transactionIdMap.set(transactionId, transactionId)
    }

    //console.log(" debt req.query ============== ", req.query);
    const salt = saltKey;
    const key = payload.key;
    delete payload.key;

    const queryString = Object.keys(payload)
      .map(key => `${key}=${payload[key]}`)
      .join('&');
    const hash = createHashKey(salt, queryString);
    if (hash !== key) {
      return res.json({
        status: 403,
        msg: 'INCORRECT_KEY_VALIDATION'
      });
    }
    const user = await users.findOne(
      { remoteId: parseInt(payload.remote_id) },
      { session }
    )
    if (!user) {
      await session.abortTransaction();
      return res.json({ status: '500', msg: `Internal error no user` });
    }

    const checkMarketBlockedResponse = await checkMarketBlocked(user);
    if (checkMarketBlockedResponse == 1) {
      await session.abortTransaction();
      return res.json({ status: '500', msg: ' Batting is not allowed ! ' });
    }

    let updatedavailableBalance = 0
    await session.withTransaction(async () => {

      let debitAmount = parseInt(payload.amount);
      const amount = debitAmount * casinoMultiples;
      updatedavailableBalance = user.availableBalance - (amount);
      if (debitAmount > user.availableBalance * casinoMultiples) {
        await session.abortTransaction();
        return res.json({
          status: 403,
          message: "Insufficient balance amount",
        });
      } else if (parseInt(payload.amount) < 0) {
        await session.abortTransaction();
        return res.json({ status: '500', msg: 'Negative bet not allowed!' });
      } else if (updatedavailableBalance < 0) {
        await session.abortTransaction();
        return res.json({ status: 500, msg: 'Negative balance not allowed!' });
      } else {
        let balance = user.availableBalance / casinoMultiples;
        const resp = await WinLoseTransManagement(balance, payload, user, 0, res);
        await session.commitTransaction();
      }
    }, transactionOptions);
    const updatedUser = await users.findOne(
      { remoteId: parseInt(payload.remote_id) },
      { session }
    )
    ////console.log(" Amount Returning to Casino from Debit  ", updatedUser.availableBalance / casinoMultiples);
    return res.json({
      status: 200,
      balance: updatedUser.availableBalance / casinoMultiples
    });


  } catch (err) {
    console.error('Error:', err);
    return res.json({ status: 500, msg: `Internal error ${err}` });
  } finally {
    await session.endSession();
    res.json({
      status: 200,
    });
  }
}

async function creditFun(req, res) {
  const session = dbClient.startSession();
  try {
    const payload = req.query;
    const transactionId = payload.transaction_id
    // const sameTransaction = await CasinoDebits.countDocuments({
    //   transaction_id: payload.transaction_id,
    //   remote_id: parseInt(payload.remote_id),
    //   round_id: payload.round_id,
    //   game_id: payload.game_id,
    //   action: "credit"
    // })
    const currentUser = await User.findOne(
      { remoteId: parseInt(payload.remote_id) }
    )
    if (!currentUser) {
      ////console.log(" ========================= User Not Found ============= ");
      return res.json({ status: '500', msg: `Internal Error no User` });
    }
    if (transactionIdMap.has(transactionId)) {
      ////console.log('====== same Trans already Exists', transactionId)
      return res.json({
        status: 200,
        balance: currentUser.availableBalance / casinoMultiples,
      });
    } else {
      transactionIdMap.set(transactionId, transactionId)
    }

    //console.log(" credit req.query ======= ", req.query);
    const salt = saltKey;
    const key = payload.key;
    delete payload.key;

    const queryString = Object.keys(payload).map(key => `${key}=${payload[key]}`).join('&');

    //console.log('queryString', queryString);

    const hash = createHashKey(salt, queryString);
    //console.log('hash', hash);

    if (hash !== key) {
      return res.json({
        status: 403,
        msg: 'INCORRECT_KEY_VALIDATION'
      });
    }
    const user = await users.findOne(
      { remoteId: parseInt(payload.remote_id) },
      { session, readPreference: 'primary' }
    );
    if (!user) {
      ////console.log(" ========================= User Not Found ============= ");
      await session.abortTransaction();
      return res.json({ status: '500', msg: `Internal Error no User` });
    }

    const checkMarketBlockedResponse = await checkMarketBlocked(user);
    if (checkMarketBlockedResponse == 1) {
      await session.abortTransaction();
      return res.json({ status: '500', msg: 'Batting is not allowed !' });
    }

    // let updatedavailableBalance = 0
    await session.withTransaction(async () => {
      if (parseInt(payload.amount) < 0) {
        await session.abortTransaction();
        return res.json({
          status: 500,
          balance: user.availableBalance / casinoMultiples
        });
      } else {
        // const amount = payload.amount * casinoMultiples;
        const response = await WinLoseTransManagement(0, payload, user, 1, res, session);
        await session.commitTransaction();
        //console.log(" Amount Returning to Casino from Credit ", updatedUser.availableBalance / casinoMultiples);
      }
    }, transactionOptions);

    const updatedUser = await users.findOne(
      { remoteId: parseInt(payload.remote_id) },
      { session }
    )
    return res.json({
      status: 200,
      balance: updatedUser.availableBalance / casinoMultiples
    });

  } catch (err) {
    console.error('Error:', err);
    return res.json({ status: 500, msg: `Internal error ${err}` });
  } finally {
    await session.endSession();
    res.json({
      status: 200,
    });
  }
}

async function rollbackFun(req, res) {
  const session = dbClient.startSession();
  try {
    const payload = req.query;
    ////console.log(" rollback req.query ======= ", req.query);
    const salt = saltKey;
    const key = payload.key;
    delete payload.key;
    const queryString = Object.keys(payload)
      .map(key => `${key}=${payload[key]}`)
      .join('&');
    const hash = createHashKey(salt, queryString);
    if (hash !== key) {
      return res.json({
        status: 403,
        msg: 'INCORRECT_KEY_VALIDATION'
      });
    }

    let updatedBalance = 0;
    if (payload.action === 'rollback') {
      await session.withTransaction(async () => {
        const sameTransId = await casinoCalls.countDocuments(
          {
            transaction_id: payload.transaction_id,
            remote_id: parseInt(payload.remote_id),
            // round_id: payload.round_id,
          },
          { session }
        );
        const user = await users.findOne(
          { remoteId: parseInt(payload.remote_id) },
          { session }
        );
        if (!user) {
          // ////console.log("user not found ");
          await session.abortTransaction();
          return res.json({ status: '500', msg: `Internal error User Not Found` });
        } else if (sameTransId === 0) {
          await session.abortTransaction();
          return res.json({
            status: 404,
            balance: user.availableBalance / casinoMultiples,
          });
        } else if (sameTransId > 1) {
          await session.abortTransaction();
          return res.json({
            status: 200,
            balance: user.availableBalance / casinoMultiples,
          });
        } else {
          const rollbackTransaction = await casinoCalls.findOne(
            {
              transaction_id: payload.transaction_id,
              remote_id: parseInt(payload.remote_id)
            },
            { session }
          );

          let amount = 0;
          // let exposureAmount = 0
          const action = rollbackTransaction.action;

          if (action === "credit") {
            amount = -parseInt(rollbackTransaction.amount);
          } else if (action === "debit") {
            amount = parseInt(rollbackTransaction.amount);
            // exposureAmount = parseInt(rollbackTransaction.amount);
          } else if (action === 'rollback') {
            await session.abortTransaction();
            return res.json({
              status: 404,
              balance: user.availableBalance / casinoMultiples
            });
          }

          updatedBalance = user.availableBalance + (amount * casinoMultiples);
          let updatedExposureAmount = user.exposure + (amount * casinoMultiples);

          await users.updateOne(
            { _id: user?._id }, { $set: { exposure: updatedExposureAmount, availableBalance: updatedBalance } },
            { session }
          );

          const casinoDebits = new CasinoDebits(payload);
          await casinoDebits.save();
          await session.commitTransaction();

          const updatedUser = await users.findOne(
            { remoteId: parseInt(payload.remote_id) },
            { session }
          )

          return res.json({
            status: 200,
            balance: updatedUser.availableBalance / casinoMultiples
          });
        }

      }, transactionOptions);
      await session.endSession();
    } else {
      const newUpdatedUser = await users.findOne(
        { remoteId: parseInt(payload.remote_id) }
      );
      if (!newUpdatedUser) {
        return res.json({ status: '500', msg: `Internal error: User Not Found` });
      } else {
        return res.json({
          status: 404,
          balance: newUpdatedUser.availableBalance / casinoMultiples
        });
      }
    }
  } catch (err) {
    await session.abortTransaction();
    console.error(err);
    return res.json({
      status: 500,
      msg: `Internal error ${err}`
    });
  } finally {
    await session.endSession()
    res.json({
      status: 200,
    });
  }
}

function casino(req, res) {
  const { action, remote_id } = req.query;
  if (!remote_id || !action) {
    return res.send({ status: '400', msg: 'Invalid Request' });
  }
  switch (action) {
    case 'balance':
      return balanceFun(req, res);
    case 'debit':
      return debitFun(req, res);
    case 'credit':
      return creditFun(req, res);
    case 'rollback':
      return rollbackFun(req, res);
    default:
      return res.send({ status: '400', msg: 'Invalid action' });
  }
}

router.get('/casino', casino);
module.exports = { router };
