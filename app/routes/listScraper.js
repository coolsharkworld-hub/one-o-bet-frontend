const express = require("express");
const router = express.Router();
const Crickets = require("../models/Crickets");
const InPlayEvents = require("../models/events")
const Score = require("../models/score")
let config = require('config');

async function listScraper(req, res) {
  let query = {};
  let page = 1;
  let sort = -1;
  var limit = config.pageSize;
  if (
    req.query.numRecords &&
    !isNaN(req.query.numRecords) &&
    req.query.numRecords > 0
  )
    limit = Number(req.query.numRecords);
  if (req.query.sort) sort = Number(req.query.sort);
  if (req.query.page) page = Number(req.query.page);

  // Crickets.find(query)
  // .sort({ state: 'live', timestamp: -1 })
  Crickets.aggregate([
    {
      $addFields: {
        sortField: {
          $switch: {
            branches: [
              {case: {$eq: ["$state", "live"]}, then: 1},
              {case: {$eq: ["$state", "info"]}, then: 2}
            ],
            default: 3
          }
        }
      }
    },
    {$sort: {sortField: 1, timestamp: 1}}
  ])
    .exec((err, allRecords) => {
      if (err) return res.status(404).send({message: 'Something went wrong'});

      // Apply custom sorting logic
      // const sortedRecords = allRecords.sort((a, b) => {
      //   if (a.state === 'live' && b.state !== 'live') {
      //     return -1;
      //   } else if (a.state !== 'live' && b.state === 'live') {
      //     return 1;
      //   } else {
      //     // If states are the same or both not 'live', sort by timestamp
      //     return b.timestamp - a.timestamp;
      //   }
      // });

      // Implement your own pagination logic
      const startIndex = (page - 1) * limit;
      const endIndex = page * limit;
      const paginatedRecords = allRecords.slice(startIndex, endIndex);

      return res.send({
        success: true,
        message: 'Paginated and sorted Crickets list',
        total: allRecords.length,
        results: paginatedRecords,
      });
    });
}

async function editCricket(req, res) {
  const {_id, eventId} = req.body;

  try {
    await Crickets.updateOne(
      {_id: _id},
      {$set: {eventId: eventId}},
    );

    const cricketInfo = await Crickets.findOne({_id: _id})

    const seriesKey = cricketInfo.seriesKey;

    await InPlayEvents.updateOne(
      {Id: eventId},
      {$set: {seriesKey: seriesKey, matchType: cricketInfo.type}},
    );

    // Check if the update was successful
    res.status(200).json({success: true, message: 'Cricket updated successfully'});
  } catch (error) {
    console.error('Error updating cricket:', error);
    res.status(500).json({success: false, message: 'Internal server error'});
  }
}

async function deleteCricket(req, res) {
  const {seriesKey} = req.body;

  try {
    await Crickets.deleteOne({seriesKey});

    res.status(200).json({success: true, message: 'Cricket deleted successfully'});
  } catch (error) {
    console.error('Error updating cricket:', error);
    res.status(500).json({success: false, message: 'Internal server error'});
  }
}

async function deleteSoccer(req, res) {
  const {seriesKey} = req.body;

  try {
    await Score.deleteOne({scoreKey: seriesKey, sportsId: '1'});

    res.status(200).json({success: true, message: 'Cricket deleted successfully'});
  } catch (error) {
    console.error('Error updating cricket:', error);
    res.status(500).json({success: false, message: 'Internal server error'});
  }
}

async function deleteTennis(req, res) {
  const {seriesKey} = req.body;

  try {
    await Score.deleteOne({scoreKey: seriesKey, sportsId: '2'});

    res.status(200).json({success: true, message: 'Cricket deleted successfully'});
  } catch (error) {
    console.error('Error updating cricket:', error);
    res.status(500).json({success: false, message: 'Internal server error'});
  }
}

async function listSoccer(req, res) {
  let query = {};
  let page = 1;
  let sort = -1;
  let keyword = '';
  var limit = config.pageSize;
  if (
    req.query.numRecords &&
    !isNaN(req.query.numRecords) &&
    req.query.numRecords > 0
  )
    limit = Number(req.query.numRecords);
  if (req.query.sort) sort = Number(req.query.sort);
  if (req.query.page) page = Number(req.query.page);
  if (req.query.keyword) keyword = req.query.keyword;

  // Crickets.find(query)
  // .sort({ state: 'live', timestamp: -1 })
  Score.aggregate([
    {
      $match: {
        "data.openTime": {$ne: 'FT'},
        sportsId: '1',
        $or: [
          { "data.home": { $regex: keyword, $options: 'i' } },
          { "data.away": { $regex: keyword, $options: 'i' } }
        ]
      } // Match bets for the specific user
    },
    {
      $addFields: {
        sortField: {
          $switch: {
            branches: [
              {case: {$eq: ["$state", "live"]}, then: 1},
              {case: {$eq: ["$state", "info"]}, then: 2}
            ],
            default: 3
          }
        }
      }
    },
    {$sort: {sortField: 1, timestamp: 1}}
  ])
    .exec((err, allRecords) => {
      if (err) return res.status(404).send({message: 'Something went wrong'});

      // Apply custom sorting logic
      // const sortedRecords = allRecords.sort((a, b) => {
      //   if (a.state === 'live' && b.state !== 'live') {
      //     return -1;
      //   } else if (a.state !== 'live' && b.state === 'live') {
      //     return 1;
      //   } else {
      //     // If states are the same or both not 'live', sort by timestamp
      //     return b.timestamp - a.timestamp;
      //   }
      // });

      // Implement your own pagination logic
      const startIndex = (page - 1) * limit;
      const endIndex = page * limit;
      const paginatedRecords = allRecords.slice(startIndex, endIndex);

      return res.send({
        success: true,
        message: 'Paginated and sorted Soccer list',
        total: allRecords.length,
        results: paginatedRecords,
      });
    });
}

async function editSoccer(req, res) {
  const {_id, eventId} = req.body;

  try {
    await Score.updateOne(
      {_id: _id},
      {$set: {eventId: eventId}},
    );

    const cricketInfo = await Score.findOne({_id: _id})

    const scoreKey = cricketInfo.scoreKey;

    await InPlayEvents.updateOne(
      {Id: eventId},
      {$set: {seriesKey: scoreKey}},
    );

    // Check if the update was successful
    res.status(200).json({success: true, message: 'Soccer updated successfully'});
  } catch (error) {
    console.error('Error updating soccer:', error);
    res.status(500).json({success: false, message: 'Internal server error'});
  }
}

async function listTennis(req, res) {
  let query = {};
  let page = 1;
  let sort = -1;
  let keyword = '';
  var limit = config.pageSize;
  if (
    req.query.numRecords &&
    !isNaN(req.query.numRecords) &&
    req.query.numRecords > 0
  )
    limit = Number(req.query.numRecords);
  if (req.query.sort) sort = Number(req.query.sort);
  if (req.query.page) page = Number(req.query.page);
  if (req.query.keyword) keyword = req.query.keyword;

  // Crickets.find(query)
  // .sort({ state: 'live', timestamp: -1 })
  Score.aggregate([
    {
      $match: {
        "data.openTime": {$ne: 'FT'},
        sportsId: '2',
        $or: [
          { "data.home": { $regex: keyword, $options: 'i' } },
          { "data.away": { $regex: keyword, $options: 'i' } }
        ]
      }
    },
    {
      $addFields: {
        sortField: {
          $switch: {
            branches: [
              {case: {$eq: ["$state", "live"]}, then: 1},
              {case: {$eq: ["$state", "info"]}, then: 2}
            ],
            default: 3
          }
        }
      }
    },
    {$sort: {sortField: 1, timestamp: 1}}
  ])
    .exec((err, allRecords) => {
      if (err) return res.status(404).send({message: 'Something went wrong'});

      // Apply custom sorting logic
      // const sortedRecords = allRecords.sort((a, b) => {
      //   if (a.state === 'live' && b.state !== 'live') {
      //     return -1;
      //   } else if (a.state !== 'live' && b.state === 'live') {
      //     return 1;
      //   } else {
      //     // If states are the same or both not 'live', sort by timestamp
      //     return b.timestamp - a.timestamp;
      //   }
      // });

      // Implement your own pagination logic
      const startIndex = (page - 1) * limit;
      const endIndex = page * limit;
      const paginatedRecords = allRecords.slice(startIndex, endIndex);

      return res.send({
        success: true,
        message: 'Paginated and sorted Tennis list',
        total: allRecords.length,
        results: paginatedRecords,
      });
    });
}

async function editTennis(req, res) {
  const {_id, eventId} = req.body;

  try {
    await Score.updateOne(
      {_id: _id},
      {$set: {eventId: eventId}},
    );

    const cricketInfo = await Score.findOne({_id: _id})

    const scoreKey = cricketInfo.scoreKey;

    await InPlayEvents.updateOne(
      {Id: eventId},
      {$set: {seriesKey: scoreKey}},
    );

    // Check if the update was successful
    res.status(200).json({success: true, message: 'Tennis updated successfully'});
  } catch (error) {
    console.error('Error updating tennis:', error);
    res.status(500).json({success: false, message: 'Internal server error'});
  }
}

router.get("/listCricket", listScraper);
router.post("/editCricket", editCricket);
router.post("/delete-cricket", deleteCricket);
router.post("/delete-soccer", deleteSoccer);
router.post("/delete-tennis", deleteTennis);

router.get("/list-soccer", listSoccer);
router.post("/edit-soccer", editSoccer);

router.get("/list-tennis", listTennis);
router.post("/edit-tennis", editTennis);

module.exports = {router};