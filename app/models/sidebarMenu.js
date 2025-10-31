/* eslint no-unused-vars: "off" */
const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const Global = require('../global/settings');

// type 0 for company / bettor type 1

let sideBarSchema = new Schema({
  name: { type: String, required: true },
  lightIcon: { type: String },
  darkIcon: { type: String },
  link: { type: String },
  type: { type: Number, default: 0 },
  sort_by: { type: Number },
  marketId: { type: String },
  updatedAt: { type: Number },
  createdAt: { type: Number }
});

sideBarSchema.pre('save', function (next) {
  var now = new Date().getTime() / 1000;
  if (!this.createdAt) {
    this.createdAt = now;
  } else {
    this.updatedAt = now;
  }
  next();
});
sideBarSchema.plugin(Global.paginate);
sideBarSchema.plugin(Global.aggregatePaginate);

const SideBarMenu = mongoose.model('sideBarMenu', sideBarSchema);

module.exports = SideBarMenu;
