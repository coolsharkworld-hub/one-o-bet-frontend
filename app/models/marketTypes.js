/* eslint no-unused-vars: "off" */
const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const Global = require('../global/settings');
/**
 * [marketTypesSchema description]
 * @status [ 0(non-active), 1 (active)]
 */
let marketTypesSchema = new Schema({
  Id: { type: Number },
  name: { type: String, required: true },
  status: { type: Number, required: true },
  updatedAt: { type: Number },
  createdAt: { type: Number },
  lightIcon: { type: String },
  darkIcon: { type: String },
  route: { type: String },
  link: { type: String },
  maxLimit: { type: Number, default: 500000 },
  minLimit: { type: Number, default:200 },
});

marketTypesSchema.pre('save', function (next) {
  var now = new Date().getTime() / 1000;
  if (!this.createdAt) {
    this.createdAt = now;
  } else {
    this.updatedAt = now;
  }
  next();
});
marketTypesSchema.plugin(Global.paginate);
marketTypesSchema.plugin(Global.aggregatePaginate);

const MarketType = mongoose.model('marketType', marketTypesSchema);
// MarketType.createIndexes();

module.exports = MarketType;
