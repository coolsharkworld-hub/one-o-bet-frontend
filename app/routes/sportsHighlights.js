// Import required modules
const express = require('express');
const { validationResult } = require('express-validator');
const loginRouter = express.Router();
const inPlayEvents = require('../models/events');
const Odds = require('../models/odds');
const { default: mongoose } = require('mongoose');
const marketIds = require('../models/marketIds');

async function getAllSportsHighlight(req, res) {
  try {
    let now = new Date();  // Get the current date and time
    let startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    let startOfDayTimestamp = startOfDay.getTime();

    let endOfDayTimestamp

    const sportId = req.query.sport;

    if (sportId == '1') {
      let endOfDay = new Date(now);
      endOfDay.setHours(23, 59, 59, 999);
      endOfDayTimestamp = endOfDay.getTime();
    } else {
      endOfDayTimestamp = new Date(startOfDayTimestamp + (2 * 24 * 60 * 60 * 1000)).getTime(); // 2days
    }
    const sportsHighlights = await inPlayEvents.aggregate([
      {
        $match: {
          $expr: {
            $or: [
              { $eq: ["$inplay", true] }, // If inPlay is true, this part always evaluates to true, bypassing the date filter
              {
                $and: [
                  { $gte: ["$openDate", startOfDayTimestamp] },
                  { $lt: ["$openDate", endOfDayTimestamp] }
                ]
              }
            ]
          },
          sportsId: sportId,
        }
      },
      {
        $sort: {
          openDate: 1
        }
      },
      {
        $project: {
          _id: '$_id',
          match: '$name',
          openDate: '$openDate',
          lastCheckMarket: '$lastCheckMarket',
          sportsId: '$sportsId',
          matchType: '$matchType',
          amount: '$amount',
          Id: '$Id',
          inplayFromServer: "$inplayFromServer",
          isShowed: "$isShowed",
          inplay: '$inplay',
          marketIds: "$marketIds",
          status: "$status",
          iconStatus: '$iconStatus',
          matchTypeProvider: '$matchTypeProvider',
          betAllowed : "$betAllowed",
          matchCanceledStatus: "$matchCanceledStatus",
          matchStoppedReason: '$matchStoppedReason',
          CompanySetStatus: "$CompanySetStatus"
        },
      },
    ]);


    const ids = await inPlayEvents.distinct("Id", {
      sportsId: sportId,
      openDate: {
        $gte: startOfDayTimestamp,
        $lt: endOfDayTimestamp
      }
    })
    const totalOpenMarkets = await marketIds.countDocuments({ status: "OPEN", eventId :{ $in : ids }})

    //console.log(" ======== ids ", ids);

    return res.send({
      success: true,
      message: 'GETTING_ALL_SPORTSHIGHLIGHT_DATA_SUCCESS',
      results: sportsHighlights,
      totalOpenMarkets: totalOpenMarkets
    });
  } catch (err) {
    //console.log(err);
    return res.status(404).send({
      success: false,
      message: 'Something went WRONG ',
    });
  }
}

async function deleteSportHighlight(req, res) {
  try {
    const id = req.query.id;
    const sportsHighlights = await inPlayEvents.deleteOne({ _id: mongoose.Types.ObjectId(id) });

    return res.send({
      success: true,
      message: `${id} DELETED SUCCESSFULLY`,
      results: sportsHighlights,
    });
  } catch (err) {
    //console.log(err);
    return res.status(404).send({
      success: false,
      message: 'Internal server error',
    });
  }
}

loginRouter.get('/getAllSportsHighlight', getAllSportsHighlight);
loginRouter.delete('/deleteSport', deleteSportHighlight);

module.exports = { loginRouter };
