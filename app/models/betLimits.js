/* eslint no-unused-vars: "off" */
let mongoose = require('mongoose');
let Schema = mongoose.Schema;
mongoose.set('debug', false);
// let Global = require('../global/settings')

let betLimitsSchema = new Schema({
  name:      { type: String, required: true },
  maxAmount: { type: Number, required: true },
  minAmount: { type: Number, default: 100 },
  ExpAmount: { type: Number, default: 200000 },
  sportsId:  { type: String },
  subarket:  { type: Number },
  updatedAt: { type: Number },
  createdAt: { type: Number }
});

betLimitsSchema.pre('save', function (next) {
  var now = new Date().getTime();
  if (!this.createdAt) {
    this.createdAt = now;
  } else {
    this.updatedAt = now;
  }
  next();
});

const betLimits = mongoose.model('betLimits', betLimitsSchema);

module.exports = betLimits;
