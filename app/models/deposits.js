/* eslint no-unused-vars: "off" */
let mongoose = require('mongoose');
let Schema = mongoose.Schema;
mongoose.set('debug', false);
let Global = require('../global/settings');

let depositsSchema = new Schema({
  userId: { type: Number, index: true },
  description: { type: String, required: false },
  amount: { type: Number, required: true, default: 0 },
  balance: { type: Number, required: false, default: 0 },
  availableBalance: { type: Number , default: 0},
  maxWithdraw: { type: Number, default: 0 },
  cash: { type : Number, default: 0 },
  credit: { type : Number, default: 0 },
  creditRemaining: { type : Number, default: 0 },
  cashOrCredit: { type: String },
  calledArea: { type: String },
  createdBy: { type: String },
  loosingAmount:{ type: String , default: '.'},
  winningAmount:{ type: String , default: '.'},
  matchId: { type: String, index: true },
  marketId : { type : String },
  commissionFrom: { type: Number },
  betId: { type: String, required: false },
  sportsId: { type: String },
  upLineAmount: { type : Number },
  updatedAt: { type: String },
  createdAt: { type: String },
  date: { type: Number },
  event: { type: String },
  betType: {type: Number},
  betDateTime: {type: Number},
  casinoBetAmount: {type: Number, default: 0},
  betTime : {type: Number, default: new Date().getTime()- 30},
  betSession: { type: Number, default: null },
  roundId: { type: String, default: null },
  sourceCodeBlock:{ type: String , default: 0 },
  addedExpoisureAmount:{ type: String , default: 0 },
  UserPrevexposure:{ type: String , default: 0 },
  UpdatedExposure:{ type: String , default: 0 },
  exposure:{ type: String },
  userAvailableBalanceBFTrans:{ type: Number , default: 0 },
  userAvailableBalanceAFTrans:{ type: Number , default: 0 },
  UserBalanceBFTrans:{ type: Number , default: 0 },
  UserBalanceAFTrans:{ type: Number , default: 0 },
});

depositsSchema.plugin(Global.aggregatePaginate);
depositsSchema.plugin(Global.paginate);

depositsSchema.pre('save', function (next) {
  let now = new Date();
  let year = now.getFullYear().toString(); // Extract last two digits of year
  let month = (now.getMonth() + 1).toString().padStart(2, '0'); // Convert month to two digits and pad with zero if necessary
  let day = now.getDate().toString().padStart(2, '0'); // Convert day to two digits and pad with zero if necessary
  let formattedDate = `${year}-${month}-${day}`;
  this.date = now.getTime();
  if (!this.createdAt) {
    this.createdAt = formattedDate ;
  } else {
    this.updatedAt = formattedDate;
  }
  next();
});

const Deposits = mongoose.model('deposits', depositsSchema);
// Deposits.createIndexes();

module.exports = Deposits;
