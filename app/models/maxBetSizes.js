/* eslint no-unused-vars: "off" */
let mongoose = require('mongoose');
let Schema = mongoose.Schema;
mongoose.set('debug', false);
// let Global = require('../global/settings')

let maxBetSizesSchema = new Schema({
  userId: { type: Number, unique: true, index: true },
  soccer: { type: Number },
  tennis: { type: Number },
  cricket: { type: Number },
  fancy: { type: Number },
  races: { type: Number },
  casino: { type: Number },
  greyHound: { type: Number },
  bookMaker: { type: Number },
  tPin: { type: Number },
  updatedAt: { type: Number },
  createdAt: { type: Number },
  kabbadi: { type: Number },
  snooker: { type: Number },
  iceHockey: { type: Number },
});

maxBetSizesSchema.pre('save', function (next) {
  var now = new Date().getTime() / 1000;
  if (!this.createdAt) {
    this.createdAt = now;
  } else {
    this.updatedAt = now;
  }
  next();
});

const maxBetSizes = mongoose.model('maxbetsizes', maxBetSizesSchema);

module.exports = maxBetSizes;
