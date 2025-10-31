const mongoose = require('mongoose');
mongoose.set('debug', false);

let Global = require('../global/settings');
const tncSchema = new mongoose.Schema({
  termAndConditionsContent: { type: String, required: false },
  privacyPolicyContent: { type: String, required: false },
  createdAt: { type: Number },
  updatedAt: { type: Number },
});
tncSchema.pre('save', function (next) {
  var now = new Date().getTime() / 1000;
  if (!this.createdAt) {
    this.createdAt = now;
  } else {
    this.updatedAt = now;
  }
  next();
});

tncSchema.plugin(Global.paginate);
tncSchema.plugin(Global.aggregatePaginate);

module.exports = mongoose.model('termsAndConditions', tncSchema);
