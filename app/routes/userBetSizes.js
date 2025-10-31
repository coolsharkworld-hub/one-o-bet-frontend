const express = require('express');
const { validationResult } = require('express-validator');
const User = require('../models/user');
const betSizeValidator = require('../validators/userBetSizes');
const betLimits = require('../models/betLimits');
const UserBetSizes = require('../models/userBetSizes');
const loginRouter = express.Router();

const updateBetSizes = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (errors.errors.length !== 0) {
      return res.status(400).send({ errors: errors.errors });

    }
    console.log(req.body)
    const betSizes = req.body.betSizes;
    for (const size of betSizes) {
      await UserBetSizes.updateOne(
        { _id: size._id },
        {
          amount: size.amount,           
          minAmount: size?.minAmount,      
          ExpAmount: size?.ExpAmount,  
        }
      )
    }
    
    return res.send({
      success: true,
      message: 'Bet sizes updated successfully',
    });
    
  } catch (error) {
    return res.status(404).send({
      success: false,
      message: 'Something went wrong',
    });
  }



  // const updatedBetSizes = betSizes.map((betSize) => ({
  //   updateOne: {
  //     filter: { betLimitId: betSize._id, userId: req.body.userId },
  //     update: { $set: { 
  //       amount: betSize.amount,           
  //       minAmount: betSize?.minAmount,      
  //       ExpAmount: betSize?.ExpAmount,      
  //       userId: req.body.userId                
  //     }},  
  //     upsert: true,
  //   },
  // }));



  // UserBetSizes.bulkWrite(updatedBetSizes, { ordered: false }, (err, result) => {
  //   if (err) {
  //     return res.status(404).send({ message: 'Error updating bet sizes' });
  //   }

  //   return res.send({
  //     success: true,
  //     message: 'Bet sizes updated successfully',
  //   });
  // });
}

function betsNews(req, res) {
  const errors = validationResult(req);
  if (errors.errors.length !== 0) {
    return res.status(400).send({ errors: errors.errors });
  }
  let results = {
    text: "Welcome to 1obet.com - System under Maintenance - Zero commissions on chota bara, kalli jotta, fancies - Customer complain cell 24 hours "
  };

  if (req.decoded.role == '5') {
    results = {
      text: 'Welcome to 1obet.com - System under Maintenance - Announcement - All casino Profit Loss will be 1 to 2 Ratio - Her casino may Jeet Har 1 ka 2 ho ge - Welcome to Exchange - Zero commissions on chota bara, kalli jotta, fancies - Customer complain cell 24 hours',
    };
  }
  return res.send({
    success: true,
    message: 'News Data',
    results,
  });
}

async function getAllBetSizes(req, res) {
  const userId = Number(req.query.userId);

  try {
    const user = await User.findOne({ userId: userId });
    if (!user) {
      return res.status(404).send({ message: 'USER_NOT_FOUND' });
    }

    const parent = await User.findOne({ userId: user.createdBy });
    if (!parent) {
      return res.status(404).send({ message: 'PARENT_USER_NOT_FOUND' });
    }

    // 
    let queryResult;
    if(parent.role == 0){
      queryResult = await UserBetSizes.aggregate([
        {
          $match:{
            userId: userId
          }
        },
        {
          $addFields: {
            betSizeId: { $toObjectId: "$betLimitId" },
          }
        },
        {
          $lookup: {
            from: "betlimits",
            localField: "betSizeId",
            foreignField: "_id",
            as: "limits",
          },
        },
        {
          $group: {
            _id: '$_id',
            name: { $first: "$name" },
            minAmount:{ $first: "$minAmount" },
            ExpAmount:{ $first: "$ExpAmount" },
            amount: { $first: "$amount" },
            limit_minAmount :  { $first: { $arrayElemAt: ["$limits.minAmount", 0] } },
            limit_ExpAmount :  { $first: { $arrayElemAt: ["$limits.ExpAmount", 0] } },
            limit_max_amount : { $first: { $arrayElemAt: ["$limits.maxAmount", 0] } }
          }
        }
      ])
    }else {
      queryResult = await UserBetSizes.aggregate([
        {
          $match:{
            userId: userId
          }
        },
        {
          $addFields: {
            betSizeId: { $toObjectId: "$betLimitId" },
          }
        },
        {
          $lookup: {
            // from: "userbetsizes",
            from: "betlimits",
            localField: "betSizeId",
            foreignField: "_id",
            as: "limits",
          },
        },
        {
          $group: {
            _id: '$_id',
            name: { $first: "$name" },
            minAmount:{ $first: "$minAmount" },
            ExpAmount:{ $first: "$ExpAmount" },
            amount: { $first: "$amount" },
            limit_minAmount :  { $first: { $arrayElemAt: ["$limits.minAmount", 0] } },
            limit_ExpAmount :  { $first: { $arrayElemAt: ["$limits.ExpAmount", 0] } },
            // limit_max_amount : { $first: { $arrayElemAt: ["$limits.amount", 0] } }
            limit_max_amount : { $first: { $arrayElemAt: ["$limits.maxAmount", 0] } }
          }
        }
      ])
    }

    // if (createdByZero) {
    //   queryResult = await betLimits.aggregate([
    //     {
    //       $project: {
    //         _id: 1,
    //         name: 1,
    //         maxAmount: '$maxAmount',
    //         userBetSizes: {
    //           $filter: {
    //             input: '$userBetSizes',
    //             as: 'userBetSize',
    //             cond: { $eq: ['$$userBetSize.userId', 0] }, // Condition to match createdByZero user's userId
    //           },
    //         },
    //       },
    //     },
    //     {
    //       $unwind: {
    //         path: '$userBetSizes',
    //         preserveNullAndEmptyArrays: true, // Preserve documents that don't have a match in the userbetsizes collection
    //       },
    //     },
    //     {
    //       $lookup: {
    //         from: 'userbetsizes',
    //         let: { betLimitId: { $toString: '$_id' } },
    //         pipeline: [
    //           {
    //             $match: {
    //               $expr: {
    //                 $and: [
    //                   { $eq: ['$userId', userId] }, // Match with logged-in user's userId
    //                   { $eq: ['$betLimitId', '$$betLimitId'] },
    //                 ],
    //               },
    //             },
    //           },
    //           {
    //             $project: {
    //               _id: 0,
    //               amount: 1,
    //             },
    //           },
    //         ],
    //         as: 'userBetSizes',
    //       },
    //     },
    //     {
    //       $unwind: {
    //         path: '$userBetSizes',
    //         preserveNullAndEmptyArrays: true, // Preserve documents that don't have a match in the userbetsizes collection
    //       },
    //     },
    //     {
    //       $project: {
    //         _id: 1,
    //         name: 1,
    //         maxAmount: '$maxAmount', // Use amount from logged-in userbetsizes if available, else use maxAmount from betLimits
    //         amount: { $ifNull: ['$userBetSizes.amount', 0] }, // Use amount from logged-in userbetsizes if available, else set to 0
    //       },
    //     },
    //   ]);
    // } else {
    //   //console.log('in else case');
    //   const createdBy = user.createdBy;
    //   queryResult = await betLimits.aggregate([
    //     {
    //       $lookup: {
    //         from: 'userbetsizes',
    //         let: { betLimitId: { $toString: '$_id' } },
    //         pipeline: [
    //           {
    //             $match: {
    //               $expr: {
    //                 $and: [
    //                   { $eq: ['$userId', createdBy] }, // Match with createdBy user's userId
    //                   { $eq: ['$betLimitId', '$$betLimitId'] },
    //                 ],
    //               },
    //             },
    //           },
    //           {
    //             $project: {
    //               _id: 0,
    //               amount: 1,
    //             },
    //           },
    //         ],
    //         as: 'createdByUserBetSizes',
    //       },
    //     },
    //     {
    //       $unwind: {
    //         path: '$createdByUserBetSizes',
    //         preserveNullAndEmptyArrays: true, // Preserve documents that don't have a match in the userbetsizes collection
    //       },
    //     },
    //     {
    //       $lookup: {
    //         from: 'userbetsizes',
    //         let: { betLimitId: { $toString: '$_id' } },
    //         pipeline: [
    //           {
    //             $match: {
    //               $expr: {
    //                 $and: [
    //                   { $eq: ['$userId', userId] }, // Match with logged-in user's userId
    //                   { $eq: ['$betLimitId', '$$betLimitId'] },
    //                 ],
    //               },
    //             },
    //           },
    //           {
    //             $project: {
    //               _id: 0,
    //               amount: 1,
    //             },
    //           },
    //         ],
    //         as: 'userBetSizes',
    //       },
    //     },
    //     {
    //       $unwind: {
    //         path: '$userBetSizes',
    //         preserveNullAndEmptyArrays: true, // Preserve documents that don't have a match in the userbetsizes collection
    //       },
    //     },
    //     {
    //       $project: {
    //         _id: 1,
    //         name: 1,
    //         maxAmount: { $ifNull: ['$createdByUserBetSizes.amount', '$maxAmount'] }, // Use amount from createdBy userbetsizes if available, else use maxAmount from betLimits
    //         amount: { $ifNull: ['$userBetSizes.amount', 0] }, // Use amount from logged-in userbetsizes, if available, else set to 0
    //       },
    //     },
    //   ]);
    // }

    // Log the query result
    // //console.log('Query Result:', queryResult);

    // const modifiedResults = queryResult.map((result) => ({
    //   _id: result._id,
    //   name: result.name,
    //   maxAmount: result.maxAmount,
    //   amount: result.amount,

    // }));

    // Log the modified results
    // //console.log('Modified Results:', queryResult);

    return res.send({
      success: true,
      message: 'BET_SIZES_FETCHED_SUCCESSFULLY',
      results: queryResult,
    });
  } catch (error) {
    // Log the error
    console.error('Error:', error);

    return res.status(500).send({ message: 'Internal Server Error' });
  }
}

loginRouter.post(
  '/updateBetSizes',
  betSizeValidator.validate('updateBetSizes'),
  updateBetSizes
);
loginRouter.get('/betsNews', betsNews);
loginRouter.get('/getAllBetSizes', getAllBetSizes);

module.exports = { loginRouter };
