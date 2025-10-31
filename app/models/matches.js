const mongoose = require('mongoose');
mongoose.set('debug', false);

let Global = require('../global/settings');
const matchSchema = new mongoose.Schema({
  sportsId: {
    type: Number,
    required: true,
  },
  team1: {
    type: Number,
    required: true,
  },
  team2: {
    type: Number,
    required: true,
  },
  startDate: {
    type: String,
    required: true,
  },
  opening: {
    type: String,
    required: true,
  },
  favourite: {
    type: String,
    required: true,
  },
  openingRate: {
    type: Number,
    required: true,
  },
  createdAt: {
    type: Number,
  },
  updatedAt: {
    type: Number,
  },
});
matchSchema.pre('save', function (next) {
  var now = new Date().getTime() / 1000;
  if (!this.createdAt) {
    this.createdAt = now;
  } else {
    this.updatedAt = now;
  }
  next();
});

matchSchema.plugin(Global.paginate);
matchSchema.plugin(Global.aggregatePaginate);

module.exports = mongoose.model('match', matchSchema);
