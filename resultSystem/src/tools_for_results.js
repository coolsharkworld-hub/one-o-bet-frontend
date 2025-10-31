'use strict';
module.exports = ToolForResults;
const sportsIdsForRacing = ['4339', '7'];
const sportsIds = ['4', '2', '1'];
const Bets = require('../../app/models/bets');
const { checkActiveBettors } = require('../../helper/bet');
const scoreChecker = require('./api/scoreChecker')();

function ToolForResults() {
  return { init };

  async function init() {
    getBetForEvents(sportsIds);
    setTimeout(() => {
      getBetForEvents(sportsIdsForRacing);
    }, 2000);
    getBetForFancy();
    getBetForAsianOdd();
    manuelBetChecker();
  }

  async function getBetForEvents(targetArray) {
    const currentTime = new Date().getTime();
    try {
      const results = await Bets.aggregate([
        {
          $match: {
            sportsId: { $in: targetArray },
            marketId: { $ne: null },
            isfancyOrbookmaker: false,
            status: 1,
            type: { $in: [0, 1] }
          }
        },
        {
          $group: {
            _id: '$marketId',
            betDocument: { $first: '$$ROOT' }
          }
        },
        {
          $sort: {
            lastCheckResult: 1
          }
        },
        {
          $limit: 5
        }
      ]).exec();

      for (const result of results) {
        const checkActive = await checkActiveBettors(result.betDocument);
        if (checkActive) continue;
        await Bets.updateMany(
          {
            _id: { $in: result.documentIds }
          },
          {
            $set: { lastCheckResult: currentTime }
          }
        ).catch((e) => console.error(e));

        if (!result.betDocument) continue;

        if (result.betDocument.sportsId === '1' || result.betDocument.sportsId === '2' || result.betDocument.sportsId === '4') {
          await scoreChecker.eventsResult(result.betDocument);
        } else if (result.betDocument.sportsId === '7' || result.betDocument.sportsId === '4339') {
          await scoreChecker.racingResult(result.betDocument);
        } else {
          //console.log("Undefined sports type ", result.betDocument);
        }
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setTimeout(() => {
        getBetForEvents(targetArray);
      }, 4 * 1000);
    }
  }

  async function getBetForFancy() {
    const currentTime = new Date().getTime();
    try {
      const betData = await Bets.findOne({
        sportsId: '4',
        isfancyOrbookmaker: true,
        status: 1
      })
        .sort({
          lastCheckResult: 1
        })
        .limit(1)
        .exec();

      const checkActive = await checkActiveBettors(betData);

      if (betData && !checkActive) {
        await Bets.updateOne(
          {
            _id: betData._id
          },
          {
            $set: { lastCheckResult: currentTime }
          }
        ).catch((e) => console.error(e));

        if (betData.fancyData) {
          await scoreChecker.fancyResult(betData, betData.fancyData);
        } else {
          await scoreChecker.bookMakerResult(betData);
        }
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setTimeout(() => {
        getBetForFancy();
      }, 5 * 1000);
    }
  }

  async function getBetForAsianOdd() {
    const currentTime = new Date().getTime();
    try {
      const results = await Bets.find({
        sportsId: '8',
        status: 1
      }).exec();

      for (const result of results) {
        await Bets.updateMany(
          {
            _id: { $in: result.documentIds }
          },
          {
            $set: { lastCheckResult: currentTime }
          }
        ).catch((e) => console.error(e));
      }
      if (results.length > 0) {
        await scoreChecker.asianResult(results);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setTimeout(() => {
        getBetForAsianOdd();
      }, 5 * 1000);
    }
  }

  async function manuelBetChecker() {
    try {
      const results = await Bets.aggregate([
        {
          $match: {
            status: 1,
            type: { $in: [2, 3, 4] },
            betSession: { $ne: null }
          }
        },
        {
          $lookup: {
            from: 'sessions',
            let: { matchId: '$matchId', betSession: '$betSession' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [{ $eq: ['$Id', '$$matchId'] }, { $eq: ['$sessionNo', '$$betSession'] }]
                  }
                }
              }
            ],
            as: 'sessionDetails'
          }
        },
        {
          $unwind: '$sessionDetails'
        },
        {
          $match: {
            'sessionDetails.score': { $ne: 0 },
            'sessionDetails.manuelSave': true
          }
        },
        {
          $project: {
            betData: '$$ROOT',
            score: '$sessionDetails.score'
          }
        }
      ]);
      if (results.length > 0) {
        await scoreChecker.manuel(results);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setTimeout(() => {
        manuelBetChecker();
      }, 5 * 1000);
    }
  }
}
