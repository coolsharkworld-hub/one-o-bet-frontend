/* eslint no-unused-vars: "off" */
let mongoose = require('mongoose');
let Schema = mongoose.Schema;
mongoose.set('debug', false);
// let Global = require('../global/settings')

let betSizesSchema = new Schema({
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

// betSizesSchema.plugin(Global.aggregatePaginate)
// betSizesSchema.plugin(Global.paginate)

betSizesSchema.pre('save', function (next) {
  var now = new Date().getTime();
  if (!this.createdAt) {
    this.createdAt = now;
  } else {
    this.updatedAt = now;
  }
  next();
});

const BetSizes = mongoose.model('betSize', betSizesSchema);
// BetSizes.createIndexes();

module.exports = BetSizes;
