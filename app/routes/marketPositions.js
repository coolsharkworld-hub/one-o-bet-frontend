const express = require("express");
const { validationResult } = require("express-validator");
const User = require("../models/user");
const loginRouter = express.Router();

const getMarketPositions = async (req, res) => {
  const errors = validationResult(req);
  if (errors.errors.length !== 0) {
    return res.status(400).send({ errors: errors.errors });
  }

  const userId = req.body.userId;

  const users = await User.distinct("userId", { createdBy: userId });
  const currentUser = await User.findOne({ userId: userId });

  const parentUser = await User.findOne({ userId: currentUser.createdBy });

  const response = await User.aggregate([
    {
      $match: {
        userId: {
          $in: users,
        },
      },
    },
    {
      $group: {
        _id: "$userId",
        name: { $first: "$userName" },
        amount: { $sum: "$clientPL" },
        role: { $first: "$role" },
      },
    },
  ]);

  currentUser &&
    response.push({
      _id: currentUser.userId,
      name: currentUser.userName,
      amount: currentUser.clientPL,
      role: currentUser.role,
    });

  parentUser &&
    response.push({
      _id: parentUser.userId,
      name: parentUser.userName,
      amount: parentUser.clientPL,
      role: parentUser.role,
    });

  return res.send({
    success: true,
    message: "Market Positions Reports !",
    results: response,
  });
};

loginRouter.post("/marketPositions", getMarketPositions);

module.exports = { loginRouter };
