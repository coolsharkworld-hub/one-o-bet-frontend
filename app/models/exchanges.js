const mongoose = require('mongoose');
mongoose.set('debug', false);

let Global = require('../global/settings');
const exchangesSchema = new mongoose.Schema({
  currency: { type: String, required: false },
  exchangeAmount: { type: Number, required: false },
  createdAt: { type: Number },
  updatedAt: { type: Number },
});
exchangesSchema.pre('save', function (next) {
  var now = new Date().getTime();
  if (!this.createdAt) {
    this.createdAt = now;
  } else {
    this.updatedAt = now;
  }
  next();
});

exchangesSchema.plugin(Global.paginate);
exchangesSchema.plugin(Global.aggregatePaginate);

module.exports = mongoose.model('exchanges', exchangesSchema);
