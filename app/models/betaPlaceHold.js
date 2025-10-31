/* eslint no-unused-vars: "off" */
let mongoose = require("mongoose");
let Schema = mongoose.Schema;
// mongoose.set('debug', false);
// let Global = require('../global/settings')

let betPlaceHoldSchema = new Schema({
  sportsId: { type: Number, default: 6 },
  secondsValue: { type: Number, required: true, default: 5.3 },
  eventId: { type: Number },
  updatedAt: { type: Number },
  createdAt: { type: Number },
});

betPlaceHoldSchema.pre("save", function (next) {
  var now = new Date().getTime();
  if (!this.createdAt) {
    this.createdAt = now;
  } else {
    this.updatedAt = now;
  }
  next();
});

const BetPlaceHold = mongoose.model("betPlaceHold", betPlaceHoldSchema);

module.exports = BetPlaceHold;
