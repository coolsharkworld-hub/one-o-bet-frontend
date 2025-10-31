const { MongoClient } = require("mongodb");
require('dotenv').config();
const CasinoDebits = require("../../app/models/casinoCalls");
const crypto = require("crypto");
const config = require("config");
const User = require("../../app/models/user");
const DBNAME = process.env.DB_NAME;
const DBHost = process.env.DBHost;
const saltKey = process.env.saltKey;
const casinoMultiples = config.casinoMultiples;
const { WinLoseTransManagement } = require('./casinoTransaction')
const { getParents } = require("../../app/routes/bets");

const transactionOptions = {
  readPreference: 'primary',
  readConcern: {level: 'local'},
  writeConcern: {w: 'majority'}
}

async function rollbackCasino(payload, res) {
  const client = new MongoClient(`${DBHost}?directConnection=true`, {useUnifiedTopology: true});
  await client.connect();
  try {
    const session = client.startSession();

    const casinoCalls = client.db(`${DBNAME}`).collection('casinocalls');
    const users = client.db(`${DBNAME}`).collection('users');

    let updatedBalance = 0;
    if (payload.action === 'rollback') {
      await session.withTransaction(async () => {
        const sameTransId = await casinoCalls.countDocuments(
          {
            transaction_id: payload.transaction_id,
            remote_id: parseInt(payload.remote_id),
            // round_id: payload.round_id,
          },
          {session}
        );
        const user = await users.findOne(
          {remoteId: parseInt(payload.remote_id)},
          {session}
        );
        if (!user) {
          // console.log("user not found ");
          await session.abortTransaction();
          return res.json({status: '500', msg: `Internal error User Not Found`});
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
            {session}
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
            {_id: user?._id}, {$set: {exposure: updatedExposureAmount, availableBalance: updatedBalance}},
            {session}
          );

          const casinoDebits = new CasinoDebits(payload);
          await casinoDebits.save();
          await session.commitTransaction();

          const updatedUser = await users.findOne(
            {remoteId: parseInt(payload.remote_id)},
            {session}
          )

          return res.send({
            success: true,
            message: "bet canceled Successfully !",
          });
        }

      }, transactionOptions);
    } else {
      const newUpdatedUser = await users.findOne(
        {remoteId: parseInt(payload.remote_id)}
      );
      if (!newUpdatedUser) {
        return res.json({status: '500', msg: `Internal error User Not Found`});
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
    await session.endSession();
    await client.close();
  }
}

async function creditCasino(payload, res) {
  const client = new MongoClient(`${DBHost}?directConnection=true`, {useUnifiedTopology: true});
  await client.connect();
  const session = client.startSession();

  try {
    const currentUser = await User.findOne(
      {remoteId: parseInt(payload.remote_id)}
    )
    if (!currentUser) {
      console.log(" ========================= User Not Found ============= ");
      return res.json({status: '500', msg: `Internal Error no User`});
    }
    const users = client.db(`${DBNAME}`).collection('users');

    const user = await users.findOne(
      {remoteId: parseInt(payload.remote_id)},
      {session, readPreference: 'primary'}
    );
    if (!user) {
      console.log(" ========================= User Not Found ============= ");
      await session.abortTransaction();
      return res.json({status: '500', msg: `Internal Error no User`});
    }

    const checkMarketBlockedResponse = await checkMarketBlocked(user);

    if (checkMarketBlockedResponse == 1) {
      await session.abortTransaction();
      return res.json({status: '500', msg: ' Batting is not allowed ! '});
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
        const amount = payload.amount * casinoMultiples;
        const response = await WinLoseTransManagement(0, payload, user, 1, res);
        await session.commitTransaction();
        const updatedUser = await users.findOne(
          {remoteId: parseInt(payload.remote_id)},
          {session}
        )
        console.log(" Amount Returning to Casino from Credit ", updatedUser.availableBalance / casinoMultiples);
        return res.json({
          status: 200,
          balance: updatedUser.availableBalance / casinoMultiples
        });
      }
    }, transactionOptions);

  } catch (err) {
    console.error('Error:', err);
    return res.json({status: 500, msg: `Internal error ${err}`});
  } finally {
    await session.endSession();
    await client.close();
  }
}

const checkMarketBlocked = async (user) => {
  let parentUserIds = await getParents(user.userId);
  const marketIds = await User.distinct("blockedMarketPlaces", {userId: {$in: parentUserIds}, isDeleted: false});
  const marketId = config.casinoMarketId;

  if (marketIds.includes(marketId)) {
    return 1;
  } else {
    return 0;
  }

}

module.exports = { rollbackCasino, creditCasino, checkMarketBlocked }
