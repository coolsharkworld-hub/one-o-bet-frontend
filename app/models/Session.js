let mongoose = require('mongoose');
let Schema = mongoose.Schema;
mongoose.set('debug', false);
let Global = require('../global/settings');

let sessionSchema = new Schema({
  sessionNo: { type: Number },
  Id: { type: String},
  eventId: { type: Number },
  score: { type: Number, default: 0 },
  scrap_session_score: { type: String, required: false },
  api_session_score: { type: String, required: false },
  updatedAt: { type: Number },
  createdAt: { type: Number },
  manuelSave: { type: Boolean, default: false },

});

sessionSchema.plugin(Global.aggregatePaginate);
sessionSchema.plugin(Global.paginate);
sessionSchema.pre('save', function (next) {
  const now = new Date().getTime();
  if (!this.createdAt) {
    this.createdAt = now;
    this.updatedAt = now;
  } else {
    this.updatedAt = now;
  }
  next();
});

const Session = mongoose.model('sessions', sessionSchema);
module.exports = Session;
