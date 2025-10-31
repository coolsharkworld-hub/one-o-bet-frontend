const { MongoClient } = require("mongodb");
require('dotenv').config();
const CasinoDebits = require("../../app/models/casinoCalls");
const SelectedCasino = require("../../app/models/selectedCasino");
const config = require("config");
const Cash = require("../../app/models/deposits");
const ExpRec = require("../../app/models/ExpRec");
const DBNAME = process.env.DB_NAME;
const DBHost = process.env.DBHost;
const casinoMultiples = config.casinoMultiples;

const WinLoseTransManagement = async (balance, payload, users123, action, res) => {
  try {
    const client = new MongoClient(`${DBHost}?directConnection=true`, {useUnifiedTopology: true});
    await client.connect();
    const session = client.startSession();
    const casinoCalls = client.db(`${DBNAME}`).collection('casinocalls');
    const users = client.db(`${DBNAME}`).collection('users');
    const user = await users.findOne({remoteId: Number(payload.remote_id)});

    /*
      action= 0 debit
      action= 1 credit( decsion came from casino )
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

    if (action == 0) {
      let amount = Number(payload.amount) * casinoMultiples;
      let UpdatedExposure = Number((user.exposure - amount).toFixed(3));
      let updatedavailableBalance = Number((user.availableBalance - (amount)).toFixed(3));

      /**
       * let lastMaxWithdrawRes = await Cash.find( {userId: user.userId}).sort({ _id: -1 });
       * let lastMaxWithdraw = lastMaxWithdrawRes.length > 0 ? lastMaxWithdrawRes[0]: null
       * console.log(" lastMaxWithdraw ============== ", lastMaxWithdraw);
       */
      await users.updateOne(
        {_id: user._id},
        {
          $set: {
            availableBalance: updatedavailableBalance,
            exposure: UpdatedExposure
          }
        },
        {session}
      );

      const casinoDebits = new CasinoDebits(payload);
      await casinoDebits.save();
      console.log(" allTrans created Successfully ");
      return 0
    } else if (action == 1) {
      const user_prev_balance = user.balance;
      const user_prev_availableBalance = user.availableBalance;
      const user_prev_exposure = user.exposure;

      const gamesList = await SelectedCasino.findOne(
        {"games.id": payload.game_id},
        {"games.$": 1}
      );

      const game = gamesList?.games[0];

      console.log(" ======================= CREDIT IS CAALED ======================= ");

      const lastDebits = await CasinoDebits.find({
        action: 'debit',
        game_id: payload.game_id,
        round_id: payload.round_id,
        remote_id: Number(payload.remote_id)
      });

      console.log(" ======================== lastDebits ======================== ", lastDebits.length);
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
        console.log("   ======================= difference < 0 =======================   ");
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
          {_id: user?._id},
          {
            $set: {
              availableBalance: updatedavailableBalance,
              exposure: UpdatedExposure,
              clientPL: updatedclientPL,
              balance: updatedbalance
            }
          },
          {session}
        );

        const lastMaxWithdrawRes = await Cash.find({userId: user.userId}).sort({_id: -1});
        const lastMaxWithdraw = lastMaxWithdrawRes.length > 0 ? lastMaxWithdrawRes[0] : null

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
            {userId: currentUserId},
            {session}
          );
          if (parentUser.role == "0") {
            console.log("break User area ");
            break;
          }
          parentUserIds.push(parentUser.createdBy);
          currentUserId = parentUser.createdBy;
        }

        console.log(" parentUser  ============ ", parentUserIds);
        const parentUser = await users.find(
          {userId: {$in: parentUserIds}, isDeleted: false}
        ).sort({role: -1}).toArray();

        console.log(" parentUser  ============ ", parentUser);

        if (!parentUser) {
          console.log(" ============ Parent User Not Found ============ ");
          return res.json({status: '500', msg: `Internal Server Error`});
        }
        let commissionFrom = user.userId;
        let upMovingAmount = bettor_lost_amount;
        let prev = 0;
        for (const user of parentUser) {
          let current = user.downLineShare;
          user["commission"] = current - prev;
          prev = current;
        }

        console.log(" ================= Commission Setting Done ================= ");
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
            {_id: user?._id},
            {
              $set: {
                availableBalance: availableBalance,
                clientPL: clientPL,
                balance: balance
              }
            },
            {session}
          );

          const lastMaxWithdrawRes = await Cash.find({userId: user.userId}).sort({_id: -1});
          const lastMaxWithdraw = lastMaxWithdrawRes.length > 0 ? lastMaxWithdrawRes[0] : null
          // console.log(' last Max Withdraw ========== ', lastMaxWithdraw);

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
        console.log(" ======================= difference > 0 ======================= ");

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

        console.log("=============start of giving commissions and loss shares on amount which is WON by bettor");
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
          {_id: user?._id},
          {
            $set: {
              availableBalance: updatedavailableBalance,
              clientPL: updatedclientPL,
              balance: updatedbalance,
              exposure: UpdatedExposure,
            }
          },
          {session}
        );

        const lastMaxWithdrawRes = await Cash.find({userId: user.userId}).sort({_id: -1});
        const lastMaxWithdraw = lastMaxWithdrawRes.length > 0 ? lastMaxWithdrawRes[0] : null

        console.log(" ================ lastMaxWithdraw ================ ", lastMaxWithdraw);
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
            {userId: currentUserId},
            {session}
          );
          if (parentUser.role == "0") {
            console.log("break User area ");
            break;
          }
          parentUserIds.push(parentUser.createdBy);
          currentUserId = parentUser.createdBy;
        }

        console.log(" parentUser  ============ ", parentUserIds);

        const parentUser = await users.find(
          {userId: {$in: parentUserIds}, isDeleted: false}
        ).sort({role: -1}).toArray();

        console.log(" parentUser  ============ ", parentUser);

        if (!parentUser) {
          console.log(" ============ Parent User Not Found ============ ");
          return res.json({status: '500', msg: `Internal Server Error`});
        }

        let prev = 0;
        for (const user of parentUser) {
          let current = user.downLineShare;
          user["commission"] = current - prev;
          prev = current;
        }

        console.log(" ================= Commission Setting Done ================= ");

        for (const user of parentUser) {

          const lastMaxWithdrawRes = await Cash.find({userId: user.userId}).sort({_id: -1});
          const lastMaxWithdraw = lastMaxWithdrawRes.length > 0 ? lastMaxWithdrawRes[0] : null
          console.log(' last Max Withdraw ========== ', lastMaxWithdraw);

          let availableBalance = Number((user.balance - (user.commission / 100) * remainingAmount).toFixed(3));
          let Balancebalance = Number((user.balance - (user.commission / 100) * remainingAmount).toFixed(3));
          let clientPL = user.downLineShare !== 100 ? Number((user.clientPL + ((100 - user.downLineShare) / 100) * remainingAmount).toFixed(3)) : 0;

          let userResponse = await users.updateOne(
            {_id: user?._id}, {
              $set: {
                availableBalance: availableBalance,
                clientPL: clientPL,
                balance: Balancebalance
              }
            },
            {session}
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
        console.log(" =============end of giving commissions and loss shares on amount which is WON by bettor");

        const casinoDebits = new CasinoDebits(payload);
        await casinoDebits.save();
        console.log(" =============end of }else if (difference > 0){=============");
      } else if ((difference == 0)) {
        // No Win lose
        const updatedavailableBalance = Number((user.availableBalance + (debit * casinoMultiples)).toFixed(3))
        const UpdatedExposure = Number((user.exposure + (debit * casinoMultiples)).toFixed(3))
        await users.updateOne(
          {_id: user?._id},
          {$set: {availableBalance: updatedavailableBalance, exposure: UpdatedExposure}},
          {session}
        );

        const casinoDebits = new CasinoDebits(payload);
        await casinoDebits.save();
      }

      const updatedUser = await users.findOne({remoteId: Number(payload.remote_id)});
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
      console.log(" ===================================================== ");
      console.log(" All Transection Successfull ");
      console.log(" ===================================================== ");
      return 0
    }
  } catch (err) {
    console.warn(`Error in Calculation ${err}`);
    return 1;
  }
}

module.exports = { WinLoseTransManagement }
