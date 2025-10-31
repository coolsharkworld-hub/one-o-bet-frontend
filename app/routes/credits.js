const express = require('express');
const { validationResult } = require('express-validator');
let config = require('config');
const CashCredit = require('../models/deposits');
const User = require('../models/user');
const cashValidator = require('../validators/deposits');
const ExpRec = require("../models/ExpRec");

const loginRouter = express.Router();

async function addCredit(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).send({ errors: errors.errors });
  }
  try {
    if ( req.body.amount < 1 ) {
      return res
        .status(400)
        .send({ message: `Invalid Amount!` });
    }
    const userToUpdate = await User.findOne({ userId: req.body.userId,
      isDeleted: false
    });
    if (!userToUpdate) {
      return res.status(404).send({ message: 'user not found' });
    }
    const user_prev_balance = userToUpdate.balance;
    const user_prev_availableBalance = userToUpdate.availableBalance;
    const user_prev_exposure = userToUpdate.exposure;

    const currentUserParent = await User.findOne({
      userId: userToUpdate.createdBy,
      isDeleted: false
    });

    //console.log("currentUserParent =========== ", currentUserParent);

    if (!currentUserParent) {
      return res.status(404).send({ message: 'user not found' });
    }

    if (currentUserParent.role != '0') {
      if ( req.body.amount > currentUserParent.creditRemaining  || 
          (currentUserParent.cash < 0 && req.body.amount >  currentUserParent.creditRemaining + currentUserParent.cash)
      ){
        return res
          .status(400)
          .send({ message: `Max available credit is is ${currentUserParent.cash < 0 ? currentUserParent.creditRemaining + currentUserParent.cash : currentUserParent.creditRemaining }` });
      }
    }


    const cUserRes = await CashCredit.find({ userId: userToUpdate.userId }).sort({ _id: -1 }).limit(1);
    const lastMaxWithdraw = cUserRes.length > 0? cUserRes[0] : null
    //console.log(" ======================= lastMaxWithdraw =================================  ", lastMaxWithdraw);
    const parentRes = await CashCredit.find({ userId: currentUserParent.userId }).sort({ _id: -1 }).limit(1);
    const parentLastMaxWithdraw = parentRes.length > 0? parentRes[0] : null
    //console.log(" ======================= parentLastMaxWithdraw =================================  ", parentLastMaxWithdraw);



    let Dealers = ['1', '2', '3', '4'];
    // Company to Dealer 
    if (currentUserParent.role == '0' && userToUpdate.role != '5') {

      userToUpdate.credit += req.body.amount;
      userToUpdate.creditRemaining += req.body.amount;

      let cashCredit = new CashCredit({
        userId: userToUpdate.userId,
        description: req.body.description ? req.body.description : '(Credit)',
        amount: req.body.amount,
        maxWithdraw: lastMaxWithdraw? lastMaxWithdraw.maxWithdraw + req.body.amount : req.body.amount,
        cash: lastMaxWithdraw?.cash || 0 ,
        credit: lastMaxWithdraw ? lastMaxWithdraw.credit + req.body.amount : req.body.amount,
        creditRemaining: lastMaxWithdraw ? lastMaxWithdraw.creditRemaining + req.body.amount : req.body.amount,
        cashOrCredit: 'Credit',
        createdBy: req.decoded.userId,
      });
      await cashCredit.save();
    } 
    //  Company to Battor 
    else if (currentUserParent.role == '0' && userToUpdate.role == '5') {
      userToUpdate.balance += req.body.amount;
      userToUpdate.availableBalance += req.body.amount;
      userToUpdate.credit += req.body.amount;

      let cashCredit = new CashCredit({
        userId: userToUpdate.userId,
        description: req.body.description ? req.body.description : '(Credit)',
        createdBy: req.decoded.userId,
        amount: req.body.amount,
        balance: lastMaxWithdraw ? lastMaxWithdraw.balance + req.body.amount : req.body.amount,
        availableBalance: lastMaxWithdraw ? lastMaxWithdraw.availableBalance + req.body.amount : req.body.amount,
        maxWithdraw: lastMaxWithdraw ? lastMaxWithdraw.maxWithdraw + req.body.amount : req.body.amount,
        cash: lastMaxWithdraw?.cash || 0 ,
        credit: lastMaxWithdraw ? lastMaxWithdraw.credit + req.body.amount : req.body.amount,
        creditRemaining: lastMaxWithdraw ? lastMaxWithdraw.creditRemaining +req.body.amount : req.body.amount,
        cashOrCredit: 'Credit'
      });
      await cashCredit.save();
    } 

    // Dealer to Dealer
    else if (Dealers.includes(currentUserParent.role) && Dealers.includes(userToUpdate.role)) {
      currentUserParent.creditRemaining -= req.body.amount;

      userToUpdate.credit += req.body.amount;
      userToUpdate.creditRemaining += req.body.amount;

      // Add Cash 
      let cashCredit = new CashCredit({
        userId: userToUpdate.userId,
        description: req.body.description ? req.body.description : '(Credit)',
        createdBy: req.decoded.userId,
        amount: req.body.amount,
        balance: lastMaxWithdraw ? lastMaxWithdraw.balance  : 0,
        availableBalance: lastMaxWithdraw ? lastMaxWithdraw.availableBalance : 0,
        maxWithdraw: lastMaxWithdraw ? lastMaxWithdraw.maxWithdraw + req.body.amount : req.body.amount,
        cash: lastMaxWithdraw?.cash || 0 ,
        credit: lastMaxWithdraw ? lastMaxWithdraw.credit + req.body.amount : req.body.amount,
        creditRemaining: lastMaxWithdraw ? lastMaxWithdraw.creditRemaining + req.body.amount : req.body.amount,
        cashOrCredit: 'Credit',
      });
      await cashCredit.save();
      // -ve Cash from parent 
      let parentCash = new CashCredit({
        userId: currentUserParent.userId,
        description: req.body.description ? req.body.description : '(Credit)',
        createdBy: req.decoded.userId,
        amount: -req.body.amount,
        balance: parentLastMaxWithdraw ? parentLastMaxWithdraw.balance  : 0,
        availableBalance: parentLastMaxWithdraw ? parentLastMaxWithdraw.availableBalance : 0,
        maxWithdraw: parentLastMaxWithdraw ? parentLastMaxWithdraw.maxWithdraw - req.body.amount : -req.body.amount,
        cash: parentLastMaxWithdraw?.cash || 0 ,
        credit: parentLastMaxWithdraw ? parentLastMaxWithdraw.credit : 0,
        creditRemaining: parentLastMaxWithdraw ? parentLastMaxWithdraw.creditRemaining - req.body.amount : -req.body.amount,
        cashOrCredit: 'Credit',
      });
      await parentCash.save();
    } 

    // Dealer to Battor 
    else if (Dealers.includes(currentUserParent.role) && userToUpdate.role == '5') {
      currentUserParent.creditRemaining -= req.body.amount;

      userToUpdate.balance += req.body.amount;
      userToUpdate.availableBalance += req.body.amount;
      userToUpdate.credit += req.body.amount;
      // userToUpdate.creditRemaining += req.body.amount;

      let cashCredit = new CashCredit({
        userId: userToUpdate.userId,
        description: req.body.description ? req.body.description : '(Credit)',
        createdBy: req.decoded.userId,
        amount: req.body.amount,
        balance: lastMaxWithdraw ? lastMaxWithdraw.balance + req.body.amount : req.body.amount,
        availableBalance: lastMaxWithdraw ? lastMaxWithdraw.availableBalance + req.body.amount : req.body.amount,
        maxWithdraw: lastMaxWithdraw ? lastMaxWithdraw.maxWithdraw + req.body.amount  : req.body.amount,
        cash: lastMaxWithdraw?.cash || 0 ,
        credit: lastMaxWithdraw ? lastMaxWithdraw.credit + req.body.amount : req.body.amount,
        creditRemaining: lastMaxWithdraw ? lastMaxWithdraw.creditRemaining +req.body.amount : req.body.amount,
        cashOrCredit: 'Credit',
      });
      await cashCredit.save();

      // parent update 
      let parentCash = new CashCredit({
        userId: currentUserParent.userId,
        description: req.body.description ? req.body.description : '(Credit)',
        createdBy: req.decoded.userId,
        amount: -req.body.amount,
        balance: parentLastMaxWithdraw ? parentLastMaxWithdraw.balance  : 0,
        availableBalance: parentLastMaxWithdraw ? parentLastMaxWithdraw.availableBalance : 0,
        maxWithdraw: parentLastMaxWithdraw? parentLastMaxWithdraw.maxWithdraw - req.body.amount : -req.body.amount,
        cash: parentLastMaxWithdraw?.cash || 0 ,
        credit: parentLastMaxWithdraw ? parentLastMaxWithdraw.credit : 0,
        creditRemaining: parentLastMaxWithdraw ? parentLastMaxWithdraw.creditRemaining - req.body.amount : -req.body.amount,
        cashOrCredit: 'Credit',
      });
      await parentCash.save();

    } 

    else {
      return res.status(400).send({ message: 'Invalid Request!' });
    }
    await userToUpdate.save();
    await currentUserParent.save();
    const updatedUser = await User.findOne({
      userId:  req.body.userId,
      isDeleted: false,
    });
    const user_new_balance = updatedUser.balance;
    const user_new_availableBalance = updatedUser.availableBalance;
    const user_new_exposure = updatedUser.exposure;
    const updatedUserLastLedger = await CashCredit.find({ userId: userToUpdate.userId }).sort({ _id: -1 }).limit(1);

    const ExpTran = new ExpRec({
      userId: updatedUser.userId,
      trans_from: "creditDeposit",
      trans_from_id: updatedUserLastLedger._id,
      trans_bet_status :  0,
      user_prev_balance: user_prev_balance,
      user_prev_availableBalance: user_prev_availableBalance,
      user_prev_exposure: user_prev_exposure,
      user_new_balance: user_new_balance,
      user_new_availableBalance: user_new_availableBalance,
      user_new_exposure: user_new_exposure,
    })
    await ExpTran.save();

    return res.send({
      success: true,
      message: 'Credit added successfully',
      results: null,
    });
  } catch (err) {
    console.error(err);
    return res.status(404).send({ message: 'server error', err });
  }
}

async function withdrawCredit(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).send({ errors: errors.errors });
  }
  try {
    if ( req.body.amount < 1 ) {
      return res.status(400).send({ message: `Invalid Amount!` });
    }
    const userToUpdate = await User.findOne({ userId: req.body.userId ,isDeleted: false});
    if (!userToUpdate) {
      return res.status(404).send({ message: 'user not found' });
    }
    const user_prev_balance = userToUpdate.balance;
    const user_prev_availableBalance = userToUpdate.availableBalance;
    const user_prev_exposure = userToUpdate.exposure;
    
    const currentUserParent = await User.findOne({ userId: userToUpdate.createdBy, isDeleted: false });
    if (!currentUserParent) {
      return res.status(404).send({ message: 'user not found' });
    }

    if (userToUpdate.role != '5' && (( req.body.amount >  userToUpdate.creditRemaining) ||  (userToUpdate.cash < 0   &&  req.body.amount >  (userToUpdate.creditRemaining + userToUpdate.cash )))) {
      if(userToUpdate.cash < 0 ){
        return res.status(400).send({ message: `Max credit to withdraw is ${userToUpdate.creditRemaining + userToUpdate.cash }` });
      } 
      return res.status(400).send({ message: `Max credit to withdraw is ${userToUpdate.creditRemaining}` });
    }
    
    else if( userToUpdate.role == '5'  && (req.body.amount >  userToUpdate.availableBalance || req.body.amount >  userToUpdate.credit )){
      if( userToUpdate.availableBalance >  userToUpdate.credit){
        return res.status(400).send({ message: `Max credit to withdraw is ${userToUpdate.credit}` });
      }
      return res.status(400).send({ message: `Max credit to withdraw is ${userToUpdate.availableBalance}` });
    }

    const cUserRes = await CashCredit.find({ userId: userToUpdate.userId }).sort({ _id: -1 }).limit(1);
    const lastMaxWithdraw = cUserRes.length > 0? cUserRes[0] : null
    //console.log(" ======================= lastMaxWithdraw =================================  ", lastMaxWithdraw);
    const parentRes = await CashCredit.find({ userId: currentUserParent.userId }).sort({ _id: -1 }).limit(1);
    const parentLastMaxWithdraw = parentRes.length > 0? parentRes[0] : null
    //console.log(" ======================= parentLastMaxWithdraw =================================  ", parentLastMaxWithdraw);


    let Dealers = ['1', '2', '3', '4'];
    //  Deealer to Company
    if (currentUserParent.role == '0' && userToUpdate.role != '5'){
      userToUpdate.credit -= req.body.amount;
      userToUpdate.creditRemaining -= req.body.amount;
      let cashCredit = new CashCredit({
        userId: userToUpdate.userId,
        description: req.body.description ? req.body.description : '(Credit)',
        createdBy: req.decoded.userId,
        amount: -req.body.amount,
        balance: lastMaxWithdraw ? lastMaxWithdraw.balance  : 0,
        availableBalance: lastMaxWithdraw ? lastMaxWithdraw.availableBalance : 0,
        maxWithdraw: lastMaxWithdraw ? lastMaxWithdraw.maxWithdraw - req.body.amount : req.body.amount,
        cash: lastMaxWithdraw?.cash || 0 ,
        credit: lastMaxWithdraw ? lastMaxWithdraw.credit - req.body.amount : -req.body.amount,
        creditRemaining: lastMaxWithdraw ? lastMaxWithdraw.creditRemaining - req.body.amount : -req.body.amount,
        cashOrCredit: 'Credit',
      });
      await cashCredit.save();
    } 

    //  battor  to company  
    else if (currentUserParent.role == '0' && userToUpdate.role == '5'){
      userToUpdate.balance -= req.body.amount;
      userToUpdate.availableBalance -= req.body.amount;
      userToUpdate.credit -= req.body.amount;

      let cashCredit = new CashCredit({
        userId: userToUpdate.userId,
        description: req.body.description ? req.body.description : '(Cash)',
        createdBy: req.decoded.userId,
        amount: - req.body.amount,
        balance: lastMaxWithdraw ? lastMaxWithdraw.balance - req.body.amount : req.body.amount,
        availableBalance: lastMaxWithdraw ? lastMaxWithdraw.availableBalance - req.body.amount : -req.body.amount,
        maxWithdraw: lastMaxWithdraw ? lastMaxWithdraw.maxWithdraw - req.body.amount : -req.body.amount,
        cash: lastMaxWithdraw?.cash || 0 ,
        credit: lastMaxWithdraw ? lastMaxWithdraw.credit - req.body.amount : -req.body.amount,
        creditRemaining: lastMaxWithdraw ? lastMaxWithdraw.creditRemaining - req.body.amount : -req.body.amount,
        cashOrCredit: 'Credit',
      });
      await cashCredit.save();
    } 

    // Dealer to Dealer
    else if (Dealers.includes(currentUserParent.role) && Dealers.includes(userToUpdate.role)) {
      userToUpdate.credit -= req.body.amount;
      userToUpdate.creditRemaining -= req.body.amount;

      currentUserParent.creditRemaining += req.body.amount;

      // Add Cash 
      let cashCredit = new CashCredit({
        userId: userToUpdate.userId,
        description: req.body.description ? req.body.description : '(Credit)',
        createdBy: req.decoded.userId,
        amount: -req.body.amount,
        balance: lastMaxWithdraw ? lastMaxWithdraw.balance  : 0,
        availableBalance: lastMaxWithdraw ? lastMaxWithdraw.availableBalance : 0,
        maxWithdraw: lastMaxWithdraw ? lastMaxWithdraw.maxWithdraw - req.body.amount : req.body.amount,
        cash: lastMaxWithdraw?.cash || 0 ,
        credit: lastMaxWithdraw ? lastMaxWithdraw.credit - req.body.amount : -req.body.amount,
        creditRemaining: lastMaxWithdraw ? lastMaxWithdraw.creditRemaining - req.body.amount : -req.body.amount,
        cashOrCredit: 'Credit',
      });
      await cashCredit.save();
      // -ve Cash from parent 
      let parentCash = new CashCredit({
        userId: currentUserParent.userId,
        description: req.body.description ? req.body.description : '(Credit)',
        createdBy: req.decoded.userId,
        amount: req.body.amount,
        balance: parentLastMaxWithdraw ? parentLastMaxWithdraw.balance  : 0,
        availableBalance: parentLastMaxWithdraw ? parentLastMaxWithdraw.availableBalance : 0,
        maxWithdraw: parentLastMaxWithdraw ? parentLastMaxWithdraw.maxWithdraw + req.body.amount : req.body.amount,
        cash: parentLastMaxWithdraw?.cash || 0 ,
        credit: parentLastMaxWithdraw ? parentLastMaxWithdraw.credit + req.body.amount : req.body.amount,
        creditRemaining: parentLastMaxWithdraw ? parentLastMaxWithdraw.creditRemaining + req.body.amount : req.body.amount,
        cashOrCredit: 'Credit',
      });

      await parentCash.save();

    } 
    
    // Battor to Dealer 
    else if(Dealers.includes(currentUserParent.role) && userToUpdate.role == '5'){
      userToUpdate.balance -= req.body.amount;
      userToUpdate.availableBalance -= req.body.amount;
      userToUpdate.credit -= req.body.amount;

      currentUserParent.creditRemaining += req.body.amount;

      let cashCredit = new CashCredit({
        userId: userToUpdate.userId,
        description: req.body.description ? req.body.description : '(Cash)',
        createdBy: req.decoded.userId,
        amount: -req.body.amount,
        balance: lastMaxWithdraw ? lastMaxWithdraw.balance - req.body.amount : req.body.amount,
        availableBalance: lastMaxWithdraw ? lastMaxWithdraw.availableBalance - req.body.amount : req.body.amount,
        maxWithdraw: lastMaxWithdraw ? lastMaxWithdraw.maxWithdraw - req.body.amount : req.body.amount,
        cash: lastMaxWithdraw?.cash || 0 ,
        credit: lastMaxWithdraw ? lastMaxWithdraw.credit - req.body.amount : -req.body.amount,
        creditRemaining: lastMaxWithdraw ? lastMaxWithdraw.creditRemaining - req.body.amount : -req.body.amount,
        cashOrCredit: 'Credit',
      });

      await cashCredit.save();

      // parent update 
      let parentCash = new CashCredit({
        userId: currentUserParent.userId,
        description: req.body.description ? req.body.description : '(Cash)',
        createdBy: req.decoded.userId,
        amount: req.body.amount,
        balance: parentLastMaxWithdraw ? parentLastMaxWithdraw.balance  : 0,
        availableBalance: parentLastMaxWithdraw ? parentLastMaxWithdraw.availableBalance : 0,
        maxWithdraw: parentLastMaxWithdraw ? parentLastMaxWithdraw.maxWithdraw + req.body.amount : req.body.amount,
        cash: parentLastMaxWithdraw?.cash || 0 ,
        credit: parentLastMaxWithdraw ? parentLastMaxWithdraw.credit : 0,
        creditRemaining: parentLastMaxWithdraw ? parentLastMaxWithdraw.creditRemaining + req.body.amount : req.body.amount,
        cashOrCredit: 'Credit',
      });

      await parentCash.save();

    } 

    else {
      return res.status(400).send({ message: 'Invalid Request!' });
    }

    await userToUpdate.save();
    await currentUserParent.save();

    const updatedUser = await User.findOne({
      userId:  req.body.userId,
      isDeleted: false,
    });
    const user_new_balance = updatedUser.balance;
    const user_new_availableBalance = updatedUser.availableBalance;
    const user_new_exposure = updatedUser.clientPL;

    const updatedUserLastLedger = await CashCredit.find({ userId: userToUpdate.userId }).sort({ _id: -1 }).limit(1);

    const ExpTran = new ExpRec({
      userId: updatedUser.userId,
      trans_from: "creditWithDraw",
      trans_from_id: updatedUserLastLedger._id,
      trans_bet_status :  0,
      user_prev_balance: user_prev_balance,
      user_prev_availableBalance: user_prev_availableBalance,
      user_prev_exposure: user_prev_exposure,
      user_new_balance: user_new_balance,
      user_new_availableBalance: user_new_availableBalance,
      user_new_exposure: user_new_exposure
    })
    await ExpTran.save();

    return res.send({
      success: true,
      message: 'Credit withdrawl added successfully',
      results: null,
    });
  } catch (err) {
    console.error(err);
    return res.status(404).send({ message: 'server error', err });
  }
}

function getAllCredits(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).send({ errors: errors.errors });
  }
  User.findOne({ userId: req.decoded.userId }, (err, success) => {
    if (err || !success)
      return res.status(404).send({ message: 'user not found' });

    CashCredit.findOne(
      { userId: req.query.userId, cashOrCredit:'Credit' },
      //creditlimit should be of the user that is login
      { credit: 1, availableBalance: 1 }
    )
      .sort({ _id: -1 })
      .exec((err, results) => {
        if (err || !results)
          return res.status(404).send({ message: 'Credit Record Not Found' });
        else
          return res.send({
            message: 'Credit Record Found',
            results: {
              ...results._doc,
              credit: success.credit,
            },
          });
      });
  });
}

loginRouter.post(
  '/addCredit',
  cashValidator.validate('withDrawCashDeposit'),
  addCredit
);
loginRouter.post(
  '/withdrawCredit',
  cashValidator.validate('withDrawCashDeposit'),
  withdrawCredit
);
loginRouter.get(
  '/getAllCredits',
  cashValidator.validate('getAllCashDeposits'),
  getAllCredits
);
module.exports = { loginRouter };
