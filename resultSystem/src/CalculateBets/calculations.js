require('dotenv').config();
const Bets = require('../../../app/models/bets');
const User = require('../../../app/models/user');
const { getParents } = require('../../../app/routes/bets');
const Events = require('../../../app/models/events');
const Deposits = require('../../../app/models/deposits');
const CurrentPosition = require('../../../app/models/CurrentPosition');
const MarketIDS = require('../../../app/models/marketIds');
const Sessions = require('../../../app/models/Session');
const ExpRec = require('../../../app/models/ExpRec');
const { CALC_FANCY_URI, CALC_LIVE_BET_TV_URI } = require('../../../app/global/constants');

const config = {
  apisFileName: 'config/settings/apis/allApis.json',
  saltRounds: 10,
  pageSize: 10,
  staging_apiUrl: 'https://stage.game-program.com/api/seamless/provider',
  apiUrl: 'https://em-api.thegameprovider.com/api/seamless/provider',
  eventListAPIUrl: 'https://tvlivestreaming.online:3440/api',
  sportsAPIUrl: 'http://209.250.242.175:33332',
  fancyUrl: CALC_FANCY_URI,
  liveTvUrl: 'https://livesportscore.xyz:3440/api',
  liveBetTvUrl: CALC_LIVE_BET_TV_URI,
  liveScoreUrl: 'https://livesportscore.xyz:3443/api/getScoreId',
  roundResultUrl: 'http://103.228.112.83:8997',
  sportsLiveScore: 'https://livesportscore.xyz:3440/api/bf_scores/',
  horseRaceUrl: 'http://136.244.77.249:33333',
  worldCasinoOnlineAuthUrl: 'https://stageapiauth.worldcasinoonline.com/api/auth/userauthentication',
  worldCasinoOnlineApiUrl: 'https://stageapi.worldcasinoonline.com/api',
  oldSaltKey: 'Loa0192Jua',
  betMinimumAmount: 100,
  language: 'en',
  play_for_fun: false,
  currency: 'PKR',
  createCasinoUser: true,
  casinoMultiples: 10,
  commission: 2,
  SportOddsSubMarkets: [6, 13, 15],
  sportMarkets: ['1', '2', '4'],
  raceMarkets: ['7', '4339'],
  casinoMarketId: '6',
  FigureEvenOddSmallBig: [9, 10, 34],
  asianSubMarket: [36, 37, 38, 39, 40, 41, 42, 43, 44],
  commissionLessSubMarkets: [2, 3, 4],
  balls: ['1', '2', '3', '4', '5', '6'],
  matchTypes: ['T10', 'T20', 'ODI', 'TEST'],
  ExcludedBackLay: [7, 8],
  soccerOdds: 13,
  tennisOdds: 15,
  cricketOdds: 6,
  Fancy: 7,
  BookMaker: 8,
  Figure: 9,
  EvenOdd: 10,
  SmallBig: 34,
  Toss: 11,
  Cup: 12,
  tiedMatch: 35,
  overUnder: 14,
  raceOpenBefore: 180000,
  sportsOpenBefore: 600000,
  tossCloseTime: 2700000
};

async function getEndedMatches(sportsId) {
  try {
    const endedMatches = await Events.find({
      sportsId,
      winner: { $ne: 0 },
      betSettled: false
    });
    return endedMatches;
  } catch (err) {
    console.error(err);
    return [];
  }
}

async function getAllBets(Id) {
  try {
    const allBets = await Bets.find({ matchId: Id, status: 1 });
    return allBets;
  } catch (err) {
    console.error(err);
    return [];
  }
}

async function handleLosingBet(bet) {
  const now = new Date();
  const year = now.getFullYear().toString();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate().toString().padStart(2, '0');
  const formattedDate = `${year}-${month}-${day}`;
  try {
    if (bet.status == 1) {
      const betStatus = await Bets.findById(bet._id);
      if (betStatus.status == 1) {
        let calculatedExp = 0;
        const userId = bet.userId;
        const loosingAmount = Number(bet.loosingAmount.toFixed(3));
        const userToUpdate = await User.findOne({
          userId: userId,
          isDeleted: false
        });
        if (!userToUpdate) {
          console.error('Error: User Not Found Location:(_handle losing bet)');
          return;
        } else {
          const exists = await Deposits.findOne({
            userId: userToUpdate.userId,
            betId: bet._id,
            amount: -loosingAmount,
            marketId: bet.marketId,
            sportsId: bet.sportsId,
            matchId: bet.matchId
          });
          if (exists) {
            console.log('=====================handleLosingBet exists=====================');
            console.log(bet._id, bet.status);
            console.log('=====================handleLosingBet exists=====================');
            // await Bets.updateOne(
            //   { _id: bet._id },
            //   {
            //     status: 0,
            //     updatedAt: new Date().getTime()
            //   }
            // );
            // await CurrentPosition.deleteMany({ betId: betIdString });
            return;
          }
          const user_prev_balance = userToUpdate.balance;
          const user_prev_availableBalance = userToUpdate.availableBalance;
          const user_prev_exposure = userToUpdate.exposure;

          const updatedBalance = Number((userToUpdate.balance - loosingAmount).toFixed(3));
          const updatedClientPL = Number((userToUpdate.clientPL - loosingAmount).toFixed(3));
          let userToUpdateAvailableBalance = -loosingAmount;
          let addExposureAmount = 0;
          if (bet.calculateExp === true) {
            userToUpdateAvailableBalance = Number((userToUpdateAvailableBalance + Number(bet.exposureAmount.toFixed(3))).toFixed(3));
            addExposureAmount = Number(bet.exposureAmount.toFixed(3));
            calculatedExp = 1;
          }
          const expAmount = Number((userToUpdate.exposure + addExposureAmount).toFixed(3));
          const updatedAvailableBalance = Number(userToUpdate.availableBalance + Number(userToUpdateAvailableBalance.toFixed(3)));
          await User.updateOne(
            {
              userId: userId,
              isDeleted: false
            },
            {
              balance: updatedBalance,
              clientPL: updatedClientPL,
              exposure: expAmount,
              availableBalance: updatedAvailableBalance
            }
          );
          const lastMaxWithdraw = await Deposits.findOne({ userId: userToUpdate.userId }).sort({ _id: -1 });
          await Deposits.create({
            userId: userToUpdate.userId,
            description: `Event (${bet.event}) Runner (${bet.runnerName})`,
            amount: -loosingAmount,
            balance: lastMaxWithdraw ? lastMaxWithdraw.balance - loosingAmount : -loosingAmount,
            availableBalance: lastMaxWithdraw ? lastMaxWithdraw.availableBalance - loosingAmount : -loosingAmount,
            maxWithdraw: lastMaxWithdraw ? lastMaxWithdraw.maxWithdraw - loosingAmount : loosingAmount,
            cash: lastMaxWithdraw ? lastMaxWithdraw.cash : 0,
            credit: lastMaxWithdraw?.credit || 0,
            creditRemaining: lastMaxWithdraw?.creditRemaining || 0,
            createdBy: 0,
            cashOrCredit: 'Bet',
            marketId: bet.marketId,
            sportsId: bet.sportsId,
            matchId: bet.matchId,
            betId: bet._id,
            betType: bet.type,
            betDateTime: bet.betTime,
            date: new Date().getTime(),
            createdAt: formattedDate,
            betSession: bet.betSession,
            roundId: bet.roundId,
            addedExpoisureAmount: addExposureAmount,
            UserPrevexposure: userToUpdate.exposure,
            UpdatedExposure: expAmount,
            sourceCodeBlock: 'handleLosingBet',
            userAvailableBalanceBFTrans: user_prev_availableBalance,
            userAvailableBalanceAFTrans: updatedAvailableBalance,
            UserBalanceBFTrans: user_prev_balance,
            UserBalanceAFTrans: updatedBalance
          });
          const parentUserIds = await getParents(userId);
          const parentUser = await User.find({
            userId: { $in: parentUserIds },
            isDeleted: false
          }).sort({ userId: -1 });
          if (!parentUser) {
            console.error(' Error: Parent Users Not Found Location:(_handle losing bet) ');
            return;
          } else {
            const remainingAmount = Number(bet.winningAmount.toFixed(3));
            const TotalLoosingAmount = Number(bet.loosingAmount.toFixed(3));
            let prev = 0;
            for (const user of parentUser) {
              let current = user.downLineShare;
              user['commission'] = current - prev;
              prev = current;
            }
            let commissionFrom = userToUpdate.userId;
            let upMovingAmount = TotalLoosingAmount;
            for (const user of parentUser) {
              const totalExpoisure = Number((user.exposure + Number(((user.commission / 100) * remainingAmount).toFixed(3))).toFixed(3));
              const totalavailableBalance = Number((user.availableBalance + Number(((user.commission / 100) * remainingAmount + (user.commission / 100) * TotalLoosingAmount).toFixed(3))).toFixed(3));
              const totalBalance = Number((user.balance + Number(((user.commission / 100) * TotalLoosingAmount).toFixed(3))).toFixed(3));
              const totalClientPLAmount = user.downLineShare != 100 ? Number((((100 - user.downLineShare) / 100) * TotalLoosingAmount).toFixed(3)) : 0;
              const totalClientPL = Number((user.clientPL - totalClientPLAmount).toFixed(3));

              await User.updateOne(
                {
                  _id: user?._id
                },
                {
                  balance: totalBalance,
                  clientPL: totalClientPL,
                  exposure: totalExpoisure,
                  availableBalance: totalavailableBalance
                }
              );

              const lastMaxWithdraw = await Deposits.findOne({ userId: user.userId }).sort({ _id: -1 });

              await Deposits.create({
                userId: user.userId,
                description: `Paid to Battor for  Event (${bet.event}) Runner (${bet.runnerName})`,
                createdBy: 0,
                amount: (user.commission / 100) * TotalLoosingAmount,
                balance: lastMaxWithdraw ? lastMaxWithdraw.balance + (user.commission / 100) * TotalLoosingAmount : (user.commission / 100) * TotalLoosingAmount,
                availableBalance: lastMaxWithdraw ? lastMaxWithdraw.availableBalance + (user.commission / 100) * TotalLoosingAmount : (user.commission / 100) * TotalLoosingAmount,
                maxWithdraw: lastMaxWithdraw ? lastMaxWithdraw.maxWithdraw + (user.commission / 100) * TotalLoosingAmount : (user.commission / 100) * TotalLoosingAmount,
                commissionFrom: commissionFrom,
                cash: lastMaxWithdraw ? lastMaxWithdraw.cash : 0,
                credit: lastMaxWithdraw ? lastMaxWithdraw.credit : 0,
                creditRemaining: lastMaxWithdraw ? lastMaxWithdraw.creditRemaining : 0,
                cashOrCredit: 'loosing',
                marketId: bet.marketId,
                sportsId: bet.sportsId,
                upLineAmount: upMovingAmount,
                betId: bet._id,
                matchId: bet.matchId,
                betType: bet.type,
                betDateTime: bet.betTime,
                date: new Date().getTime(),
                createdAt: formattedDate,
                betSession: bet.betSession,
                roundId: bet.roundId,
                addedExpoisureAmount: Number(((user.commission / 100) * remainingAmount).toFixed(3)),
                UserPrevexposure: user.exposure,
                UpdatedExposure: totalExpoisure,
                exposure: 'Number(((user.commission / 100) * remainingAmount).toFixed(3))',
                sourceCodeBlock: 'handleLosingBet'
              });

              upMovingAmount = Number((upMovingAmount - Number(((user.commission / 100) * TotalLoosingAmount).toFixed(3))).toFixed(3));
              commissionFrom = user.userId;
            }

            let winnerRunnerData = 0;
            let SessionScore = 0;

            if (bet.isfancyOrbookmaker && bet.fancyData != null) {
              const marketInfo = await MarketIDS.findOne({
                sportID: bet.sportsId,
                marketId: bet.marketId
              });
              winnerRunnerData = marketInfo?.winnerRunnerData;
            } else if (config.FigureEvenOddSmallBig.includes(Number(bet.subMarketId))) {
              const match = await Events.findById(bet.matchId);
              const marketInfo = await Sessions.findOne({
                eventId: Number(match.Id),
                sessionNo: bet.betSession
              });
              SessionScore = marketInfo?.score;
            }
            await Bets.updateOne(
              {
                _id: bet._id
              },
              {
                status: 0,
                position: bet.loosingAmount * -1,
                iscalculatedExp: calculatedExp,
                winnerRunnerData: winnerRunnerData,
                SessionScore: SessionScore,
                updatedAt: new Date().getTime()
              }
            );
            const betIdString = bet._id.toString();
            await CurrentPosition.deleteMany({ betId: betIdString });
            const updatedUser = await User.findOne({
              userId: userId,
              isDeleted: false
            });
            if (bet.calculateExp) {
              await ExpRec.create({
                userId: updatedUser.userId,
                trans_from: 'BetLose',
                trans_from_id: bet._id,
                trans_bet_status: 0,
                user_prev_balance: user_prev_balance,
                user_prev_availableBalance: user_prev_availableBalance,
                user_prev_exposure: user_prev_exposure,
                user_new_balance: updatedBalance,
                user_new_availableBalance: updatedAvailableBalance,
                user_new_exposure: expAmount,
                marketId: bet.marketId,
                sportsId: bet.sportsId,
                calculatedExp: calculatedExp,
                DateTime: new Date(),
                calculateExp: calculatedExp,
                position: bet.position,
                exposureAmount: bet.exposureAmount,
                betSession: bet.betSession,
                roundId: bet.roundId
              });
            }
          }
        }
      }
    }
  } catch (error) {
    console.error('Error: Handle Losing Bet ', error);
    return;
  }
}

async function handleWinningBet(bet, winner) {
  const now = new Date();
  const year = now.getFullYear().toString();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate().toString().padStart(2, '0');
  const formattedDate = `${year}-${month}-${day}`;
  try {
    if (bet.status == 1) {
      const betStatus = await Bets.findById(bet._id);
      if (betStatus.status == 1) {
        let calculatedExp = 0;
        const userId = bet.userId;
        let TotalWin = 0;
        let TotalLose = 0;
        if (Number(bet.sportsId) != 8) {
          const winnings = await Bets.find(
            {
              sportsId: bet.sportsId,
              marketId: bet.marketId,
              matchId: bet.matchId,
              userId: bet.userId,
              subMarketId: { $ne: '7' },
              $or: [
                { type: 0, runner: winner },
                { type: 1, runner: { $ne: winner } }
              ]
            },
            { winningAmount: 1, _id: 0 }
          );
          const loosings = await Bets.find(
            {
              sportsId: bet.sportsId,
              marketId: bet.marketId,
              matchId: bet.matchId,
              userId: bet.userId,
              subMarketId: { $ne: '7' },
              $or: [
                { type: 1, runner: winner },
                { type: 0, runner: { $ne: winner } }
              ]
            },
            { loosingAmount: 1, _id: 0 }
          );

          for (const singleWin of winnings) {
            TotalWin = Number((TotalWin + singleWin.winningAmount).toFixed(3));
          }

          for (const singleLose of loosings) {
            TotalLose = Number((TotalLose + singleLose.loosingAmount).toFixed(3));
          }
        }

        const userToUpdate = await User.findOne({
          userId: userId,
          isDeleted: false
        });

        if (!userToUpdate) {
          console.error('Error: user not found Location:(_handle winning bet)');
          return;
        } else {
          let remainingAmount;
          let commissionAmount;
          let totalRemainingAmount;
          let TotalLoosingAmount;
          let upMovingAmount;
          let upMovingCommAmount;
          if (!config.commissionLessSubMarkets.includes(bet.type) && bet.subMarketId != config.Fancy && bet.subMarketId != config.BookMaker && (TotalWin > TotalLose || Number(bet.sportsId) == 8)) {
            const absouteWin = Number((TotalWin - TotalLose).toFixed(3));
            const totalCooission = Number((absouteWin * 0.02).toFixed(3));
            commissionAmount = Number(((totalCooission / TotalWin) * bet.winningAmount).toFixed(3));
            if (Number(bet.sportsId) == 8) commissionAmount = Number((bet.winningAmount * 0.02).toFixed(3));
            remainingAmount = Number((bet.winningAmount - commissionAmount).toFixed(3));
            totalRemainingAmount = Number(bet.winningAmount.toFixed(3));
            TotalLoosingAmount = Number(bet.loosingAmount.toFixed(3));
            upMovingAmount = totalRemainingAmount;
            upMovingCommAmount = commissionAmount;
          } else {
            remainingAmount = Number(bet.winningAmount.toFixed(3));
            commissionAmount = 0;
            totalRemainingAmount = Number(bet.winningAmount.toFixed(3));
            TotalLoosingAmount = Number(bet.loosingAmount.toFixed(3));
            upMovingAmount = totalRemainingAmount;
            upMovingCommAmount = commissionAmount;
          }

          const user_prev_balance = userToUpdate.balance;
          const user_prev_availableBalance = userToUpdate.availableBalance;
          const user_prev_exposure = userToUpdate.exposure;

          const UpdatedBalance = Number((userToUpdate.balance + remainingAmount).toFixed(3));
          const UpdatedclientPL = Number((userToUpdate.clientPL + remainingAmount).toFixed(3));
          let userToUpdateAvailableBalance = remainingAmount;
          let addExposureAmount = 0;
          if (bet.calculateExp) {
            userToUpdateAvailableBalance = Number((userToUpdateAvailableBalance + Number(bet.exposureAmount.toFixed(3))).toFixed(3));
            addExposureAmount = Number(bet.exposureAmount.toFixed(3));
            calculatedExp = 1;
          }
          const UpdatedExposure = Number((userToUpdate.exposure + addExposureAmount).toFixed(3));
          const UpdatedAvailableBalance = Number((userToUpdate.availableBalance + Number(userToUpdateAvailableBalance.toFixed(3))).toFixed(3));
          const exists = await Deposits.findOne({
            userId: userToUpdate.userId,
            betId: bet._id,
            amount: remainingAmount,
            marketId: bet.marketId,
            sportsId: bet.sportsId,
            matchId: bet.matchId
          });
          if (exists) {
            console.log('=====================handleWinningBet exists=====================');
            console.log(bet._id, bet.status);
            console.log('=====================handleWinningBet exists=====================');
            // await Bets.updateOne(
            //   { _id: bet._id },
            //   {
            //     status: 0,
            //     updatedAt: new Date().getTime()
            //   }
            // );
            // await CurrentPosition.deleteMany({ betId: betIdString });
            return;
          }
          await User.updateOne(
            {
              userId: userId,
              isDeleted: false
            },
            {
              balance: UpdatedBalance,
              clientPL: UpdatedclientPL,
              exposure: UpdatedExposure,
              availableBalance: UpdatedAvailableBalance
            }
          );
          const lastMaxWithdraw = await Deposits.findOne({ userId: userToUpdate.userId }).sort({ _id: -1 });

          await Deposits.create({
            userId: userToUpdate.userId,
            description: `Event (${bet.event}) Runner (${bet.runnerName})`,
            betId: bet._id,
            createdBy: 0,
            amount: remainingAmount,
            balance: lastMaxWithdraw ? lastMaxWithdraw.balance + remainingAmount : remainingAmount,
            availableBalance: lastMaxWithdraw ? lastMaxWithdraw.availableBalance + remainingAmount : remainingAmount,
            maxWithdraw: lastMaxWithdraw ? lastMaxWithdraw.maxWithdraw + remainingAmount : remainingAmount,
            cashOrCredit: 'Bet',
            cash: lastMaxWithdraw ? lastMaxWithdraw.cash : 0,
            credit: lastMaxWithdraw?.credit || 0,
            creditRemaining: lastMaxWithdraw?.creditRemaining || 0,
            marketId: bet.marketId,
            sportsId: bet.sportsId,
            matchId: bet.matchId,
            betType: bet.type,
            betDateTime: bet.betTime,
            date: new Date().getTime(),
            createdAt: formattedDate,
            betSession: bet.betSession,
            roundId: bet.roundId,
            addedExpoisureAmount: addExposureAmount,
            UserPrevexposure: userToUpdate.exposure,
            UpdatedExposure: UpdatedExposure,
            sourceCodeBlock: 'handleWinningBet',
            userAvailableBalanceBFTrans: user_prev_availableBalance,
            userAvailableBalanceAFTrans: UpdatedAvailableBalance,
            UserBalanceBFTrans: user_prev_balance,
            UserBalanceAFTrans: UpdatedBalance
          });
          const parentUserIds = await getParents(userId);
          const parentUser = await User.find({
            userId: {
              $in: [...parentUserIds]
            },
            isDeleted: false
          }).sort({ userId: -1 });
          if (!parentUser) {
            console.error(' Error: Parent Users Not Found Location:(_handle Winning  bet) ');
            return;
          } else {
            let prev = 0;
            for (const user of parentUser) {
              let current = user.downLineShare;
              user['commission'] = current - prev;
              prev = current;
            }
            let commissionFrom = userToUpdate.userId;
            for (const user of parentUser) {
              const totalExpoisure = Number((user.exposure + Number(((user.commission / 100) * totalRemainingAmount).toFixed(3))).toFixed(3));
              const totalBalance = Number((user.balance - Number(((user.commission / 100) * remainingAmount).toFixed(3))).toFixed(3));
              const totalavailableBalance = Number((user.availableBalance + Number(((user.commission / 100) * commissionAmount).toFixed(3))).toFixed(3));
              const totalClientPLAmount = user.downLineShare != 100 ? Number((((100 - user.downLineShare) / 100) * remainingAmount).toFixed(3)) : 0;
              const totalClientPL = Number((user.clientPL + totalClientPLAmount).toFixed(3));
              await User.updateOne(
                {
                  userId: user.userId,
                  isDeleted: false
                },
                {
                  balance: totalBalance,
                  exposure: totalExpoisure,
                  availableBalance: totalavailableBalance,
                  clientPL: totalClientPL
                }
              );

              const lastMaxWithdraw = await Deposits.findOne({ userId: user.userId }).sort({ _id: -1 });
              await Deposits.create({
                userId: user.userId,
                description: `Event (${bet.event}) Runner (${bet.runnerName})`,
                createdBy: 0,
                amount: -(user.commission / 100) * totalRemainingAmount,
                balance: lastMaxWithdraw ? lastMaxWithdraw.balance - (user.commission / 100) * totalRemainingAmount : -(user.commission / 100) * totalRemainingAmount,
                availableBalance: lastMaxWithdraw ? lastMaxWithdraw.availableBalance - (user.commission / 100) * totalRemainingAmount : -(user.commission / 100) * totalRemainingAmount,
                maxWithdraw: lastMaxWithdraw ? lastMaxWithdraw.maxWithdraw - (user.commission / 100) * totalRemainingAmount : -(user.commission / 100) * totalRemainingAmount,
                cash: lastMaxWithdraw ? lastMaxWithdraw.cash : 0,
                marketId: bet.marketId,
                credit: lastMaxWithdraw?.credit || 0,
                creditRemaining: lastMaxWithdraw?.creditRemaining || 0,
                cashOrCredit: 'Bet',
                commissionFrom: commissionFrom,
                sportsId: bet.sportsId,
                upLineAmount: -upMovingAmount,
                betId: bet._id,
                matchId: bet.matchId,
                betType: bet.type,
                betDateTime: bet.betTime,
                date: new Date().getTime(),
                createdAt: formattedDate,
                betSession: bet.betSession,
                roundId: bet.roundId,

                addedExpoisureAmount: Number(((user.commission / 100) * totalRemainingAmount).toFixed(3)),
                UserPrevexposure: user.exposure,
                UpdatedExposure: totalExpoisure,
                exposure: 'Number(((user.commission / 100) * totalRemainingAmount).toFixed(3))',
                sourceCodeBlock: 'handleWinningBet'
              });
              upMovingAmount = Number((upMovingAmount - (user.commission / 100) * totalRemainingAmount).toFixed(3));

              if (!config.commissionLessSubMarkets.includes(bet.type) && bet.subMarketId != config.Fancy && bet.subMarketId != config.BookMaker && TotalWin > TotalLose) {
                const lastMaxWithdraw = await Deposits.findOne({ userId: user.userId }).sort({ _id: -1 });

                await Deposits.create({
                  userId: user.userId,
                  description: `Commission From Event (${bet.event}) Runner (${bet.runnerName})`,
                  createdBy: 0,
                  commissionFrom: commissionFrom,
                  amount: (user.commission / 100) * commissionAmount,
                  balance: lastMaxWithdraw ? lastMaxWithdraw.balance + (user.commission / 100) * commissionAmount : (user.commission / 100) * commissionAmount,
                  availableBalance: lastMaxWithdraw ? lastMaxWithdraw.availableBalance + (user.commission / 100) * commissionAmount : (user.commission / 100) * commissionAmount,
                  maxWithdraw: lastMaxWithdraw ? lastMaxWithdraw.maxWithdraw + (user.commission / 100) * commissionAmount : (user.commission / 100) * commissionAmount,
                  cashOrCredit: 'Commission',
                  betId: bet._id,
                  cash: lastMaxWithdraw ? lastMaxWithdraw.cash : 0,
                  marketId: bet.marketId,
                  sportsId: bet.sportsId,
                  credit: lastMaxWithdraw?.credit || 0,
                  creditRemaining: lastMaxWithdraw?.creditRemaining || 0,
                  upLineAmount: upMovingCommAmount,
                  matchId: bet.matchId,
                  betType: bet.type,
                  betDateTime: bet.betTime,
                  date: new Date().getTime(),
                  createdAt: formattedDate,
                  betSession: bet.betSession,
                  roundId: bet.roundId
                });

                upMovingCommAmount = Number((upMovingCommAmount - (user.commission / 100) * commissionAmount).toFixed(3));
              }
              commissionFrom = user.userId;
            }

            let winnerRunnerData = 0;
            let SessionScore = 0;
            if (bet.isfancyOrbookmaker && bet.fancyData != null) {
              const marketInfo = await MarketIDS.findOne({
                sportID: bet.sportsId,
                marketId: bet.marketId
              });
              winnerRunnerData = marketInfo?.winnerRunnerData;
            } else if (config.FigureEvenOddSmallBig.includes(Number(bet.subMarketId))) {
              const match = await Events.findById(bet.matchId);
              const marketInfo = await Sessions.findOne({
                eventId: Number(match.Id),
                sessionNo: bet.betSession
              });
              SessionScore = marketInfo?.score;
            }
            await Bets.updateOne(
              { _id: bet._id },
              {
                status: 0,
                position: Number(bet.winningAmount.toFixed(3)),
                iscalculatedExp: calculatedExp,
                winnerRunnerData: winnerRunnerData,
                SessionScore: SessionScore,
                updatedAt: new Date().getTime()
              }
            );
            const betIdString = bet._id.toString();
            await CurrentPosition.deleteMany({ betId: betIdString });

            const updatedUser = await User.findOne({
              userId: userId,
              isDeleted: false
            });
            if (bet.calculateExp) {
              await ExpRec.create({
                userId: updatedUser.userId,
                trans_from: 'BetWin',
                trans_from_id: bet._id,
                trans_bet_status: 0,
                user_prev_balance: user_prev_balance,
                user_prev_availableBalance: user_prev_availableBalance,
                user_prev_exposure: user_prev_exposure,
                user_new_balance: UpdatedBalance,
                user_new_availableBalance: UpdatedAvailableBalance,
                user_new_exposure: UpdatedExposure,
                marketId: bet.marketId,
                sportsId: bet.sportsId,
                calculatedExp: calculatedExp,
                DateTime: new Date(),
                calculateExp: calculatedExp,
                position: bet.position,
                exposureAmount: bet.exposureAmount
              });
            }
          }
        }
      }
    }
  } catch (error) {
    console.error(' Error: Handle Winning Bet ', error);
    return;
  }
}

const handleDrawBet = async (bet, status = 0) => {
  try {
    if (bet.status == 1) {
      const betStatus = await Bets.findById(bet._id);
      if (betStatus.status == 1) {
        let calculatedExp = 0;
        const totalRemainingAmount = Number(bet.winningAmount.toFixed(3));
        const userId = bet.userId;
        const userToUpdate = await User.findOne({
          userId: userId,
          isDeleted: false
        });
        if (!userToUpdate) {
          console.error('Error: User Not Found Location:(_handle draw bet)');
          return;
        } else {
          const user_prev_balance = userToUpdate.balance;
          const user_prev_availableBalance = userToUpdate.availableBalance;
          const user_prev_exposure = userToUpdate.exposure;

          const updatedUserAvlBalance = Number((userToUpdate.availableBalance + Number(bet.exposureAmount.toFixed(3))).toFixed(3));
          const updatedUserExp = Number((userToUpdate.exposure + Number(bet.exposureAmount.toFixed(3))).toFixed(3));

          if (bet.calculateExp === true) {
            calculatedExp = 1;
            await User.updateOne(
              {
                userId: userId,
                isDeleted: false
              },
              {
                availableBalance: updatedUserAvlBalance,
                exposure: updatedUserExp
              }
            );
          }

          const parentUserIds = await getParents(userId);
          const parentUser = await User.find({
            userId: { $in: [...parentUserIds] },
            isDeleted: false
          }).sort({ role: -1 });
          if (!parentUser) {
            console.error(' Error : Parent User Not Found Location:(_handle Draw bet ) ');
            return;
          } else {
            let prev = 0;
            for (const user of parentUser) {
              let current = user.downLineShare;
              user['commission'] = current - prev;
              prev = current;
            }
            for (const user of parentUser) {
              const amountToBeAddedExp = Number((user.exposure + Number(((user.commission / 100) * totalRemainingAmount).toFixed(3))).toFixed(3));
              const amountToBeAddedAvlBalance = Number((user.availableBalance + Number(((user.commission / 100) * totalRemainingAmount).toFixed(3))).toFixed(3));
              await User.updateOne(
                {
                  _id: user._id
                },
                {
                  exposure: amountToBeAddedExp,
                  availableBalance: amountToBeAddedAvlBalance
                }
              );
            }
            await Bets.updateOne(
              { _id: bet._id },
              {
                position: 0,
                status: status,
                iscalculatedExp: calculatedExp,
                updatedAt: new Date().getTime()
              }
            );
            const betIdString = bet._id.toString();
            await CurrentPosition.deleteMany({ betId: betIdString });
            const updatedUser = await User.findOne({
              userId: userId,
              isDeleted: false
            });
            const user_new_balance = updatedUser.balance;
            if (bet.calculateExp) {
              await ExpRec.create({
                userId: updatedUser.userId,
                trans_from: 'BetDrawOrCanceled',
                trans_from_id: bet._id,
                trans_bet_status: status,
                user_prev_balance: user_prev_balance,
                user_prev_availableBalance: user_prev_availableBalance,
                user_prev_exposure: user_prev_exposure,
                user_new_balance: user_new_balance,
                user_new_availableBalance: updatedUserAvlBalance,
                user_new_exposure: updatedUserExp,
                marketId: bet.marketId,
                sportsId: bet.sportsId,
                calculatedExp: calculatedExp,
                DateTime: new Date(),
                calculateExp: calculatedExp,
                position: bet.position,
                exposureAmount: bet.exposureAmount
              });
            }
          }
        }
      }
    }
  } catch (error) {
    console.error('Error: Draw Bet_', error);
    return;
  }
};

module.exports = {
  handleDrawBet,
  getAllBets,
  getEndedMatches,
  handleLosingBet,
  handleWinningBet
};
