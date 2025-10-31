/* eslint no-unused-vars: "off" */
let mongoose = require('mongoose');
let Schema = mongoose.Schema;
mongoose.set('debug', false);
// let Global = require('../global/settings')

let betRatesSchema = new Schema({
  match     : { type: String },
  teams     : { type: Array },
  updatedAt : { type: Number },
  createdAt : { type: Number },
});

betRatesSchema.pre('save', function (next) {
  var now = new Date().getTime();
  if (!this.createdAt) {
    this.createdAt = now;
  } else {
    this.updatedAt = now;
  }
  next();
});

const betRates = mongoose.model('betRates', betRatesSchema);

module.exports = betRates;
