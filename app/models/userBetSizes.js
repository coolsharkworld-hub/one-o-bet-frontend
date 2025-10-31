/* eslint no-unused-vars: "off" */
let mongoose = require('mongoose');
let Schema = mongoose.Schema;
mongoose.set('debug', false);
// let Global = require('../global/settings')

let userBetSizesSchema = new Schema({
  userId:     { type: Number },
  amount:     { type: Number },
  minAmount:  { type: Number, default: 100 },
  ExpAmount:  { type: Number, default: 200000 },
  betLimitId: { type: String },
  name:       { type: String },
  subarket:   { type: Number },
  sportsId:   { type:String },
  createdAt:  { type: Number },
  updatedAt:  { type: Number }
});

// betSizesSchema.plugin(Global.aggregatePaginate)
// betSizesSchema.plugin(Global.paginate)

userBetSizesSchema.pre('save', function (next) {
  var now = new Date().getTime() / 1000;
  if (!this.createdAt) {
    this.createdAt = now;
  } else {
    this.updatedAt = now;
  }
  next();
});

const userBetSizes = mongoose.model('userBetSizes', userBetSizesSchema);
// userBetSizes.createIndexes();

module.exports = userBetSizes;
