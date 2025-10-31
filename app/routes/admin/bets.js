const Bets = require("../../models/bets");
const CasinoCalls = require("../../models/casinoCalls");

const GetAllBets = async (req, res) => {
  try {
    const eventId = req.query?.eventId ?? ''
    const page = req.query?.page ?? 1;
    const limit = req.query?.limit ?? 10;

    let pipeline = [];
    if (eventId) {
      pipeline.push({
        $match: {
          eventId: eventId // Filter documents by game_id
        }
      })
    }
    pipeline.push({
      $match: {
        status: 1,
        fancyData: { $ne: null },
        isfancyOrbookmaker: true
      }
    })
    pipeline.push({
      $lookup: {
        from: "users",
        localField: "userId",
        foreignField: "userId",
        as: "userDetails"
      }
    })
    pipeline.push({
      $unwind: {
        path: "$userDetails",
        preserveNullAndEmptyArrays: true // Keep documents even if there's no match in the Users collection
      }
    });
    pipeline.push({
      $lookup: {
        from: "users",
        localField: "userDetails.createdBy",
        foreignField: "userId",
        as: "userParent"
      }
    })
    pipeline.push({
      $unwind: {
        path: "$userParent",
        preserveNullAndEmptyArrays: true // Keep documents even if there's no match in the Users collection
      }
    });

    let result = await Bets.aggregate(pipeline).exec()

    const results = result.slice((Number(page) - 1) * limit, page * limit);

    // for (const bet of results){
    //   const user = await User.findOne({ _id: bet.userId })
    //   bet.userName = user.userName
    // }

    return res.send({
      status: true,
      message: "Bets List !",
      results: results,
      total: result.length,
      limit: limit,
      page: page,
      pages: Math.ceil(result.length * 1.0 / limit)
    });

  } catch (err) {
    return res.send({
      message: `Error ${err} !`,
    });
  }
}

const CasinoList = async (req, res) => {
  try {
    const page = req.query?.page ?? 1;
    const limit = req.query?.limit ?? 10;
    const eventId = req.query?.eventId ?? ''
    let result = null;
    let pipeline = [];
    if (eventId) {
      pipeline.push({
        $match: {
          game_id: eventId // Filter documents by game_id
        }
      });
    }

    pipeline = pipeline.concat([
      {
        $group: {
          _id: {
            remote_id: "$remote_id",
            game_id: "$game_id",
            round_id: "$round_id"
          },
          actions: { $push: "$action" },
          docs: { $push: "$$ROOT" } // Store the whole documents to return them later
        }
      },
      {
        $match: {
          actions: { $all: ["debit"] }, // This checks for 'debit' in the actions array
          $expr: {
            $and: [
              { $eq: [{ $size: "$actions" }, { $size: { $setIntersection: ["$actions", ["debit"]] } }] } // Ensure all actions are 'debit'
            ]
          }
        }
      },
      {
        $unwind: "$docs"
      },
      {
        $replaceRoot: { newRoot: "$docs" }
      }
    ])
    pipeline.push({
      $lookup: {
        from: "users", // The collection to join.
        localField: "remote_id", // Field from the input documents.
        foreignField: "remoteId", // Field from the documents of the "from" collection.
        as: "userDetails" // The array field name where the joined documents will be placed.
      }
    });
    pipeline.push({
      $unwind: {
        path: "$userDetails",
        preserveNullAndEmptyArrays: true // Keep documents even if there's no match in the Users collection
      }
    });

    result = await CasinoCalls.aggregate(pipeline).exec()

    const results = result.slice((page - 1) * limit, page * limit);

    return res.send({
      status: true,
      message: "CasinoCalls List!",
      results: results,
      total: result.length,
      limit: limit,
      page: page,
      pages: Math.ceil(result.length / limit)
    });

  } catch (err) {
    return res.send({
      message: `Error ${err} !`,
    });
  }
}

module.exports = {GetAllBets, CasinoList}
