const mongoose = require('mongoose');
let Global = require('../global/settings');

const CricketSchema = new mongoose.Schema({
  eventId: { type: String, required: false, index: true },
  Title: { type: String, required: false },
  activeTeam: { type: String, required: false },
  type: { type: String, required: false },
  matchEnglishTitle: { type: String, required: false },
  matchNo: { type: Number, required: false },
  inning: { type: Number, required: false },
  matchTitle: { type: String, required: false },
  overs: { type: Object, required: false },
  meta: { type: Object, required: false },
  over1: { type: String, required: false },
  over2: { type: String, required: false },
  rateTeam: { type: String, required: false },
  res: { type: String, required: false },
  result: { type: String, required: false },
  comment: { type: String, required: false },
  score1: { type: String, required: false },
  score2: { type: String, required: false },
  seriesFullName: { type: String, required: false },
  seriesName: { type: String, required: false },
  seriesTitle: { type: String, required: false },
  state: { type: String, required: false },
  team1Flag: { type: String, required: false },
  team2Flag: { type: String, required: false },
  team1Name: { type: String, required: false },
  team2Name: { type: String, required: false },
  team1ShortName: { type: String, required: false },
  team2ShortName: { type: String, required: false },
  RRR: { type: String, required: false },
  CRR: { type: String, required: false },
  time: { type: String, required: false },
  __v: { type: Number, required: false },
  day: { type: String, required: false },
  seriesKey: { type: String, required: false, index: true },
  venueName: { type: String, required: false },
  timestamp: { type:Number, default: new Date().getTime() / 1000},
  createdAt: { type: Number, required: false },
  updatedAt: { type: Number, required: false },
}, {strict: false});

CricketSchema.pre("save", function (next) {
  const now = new Date().getTime();
  if (!this.createdAt) {
    this.createdAt = now;
  } else {
    this.updatedAt = now;
  }
  next();
});

CricketSchema.plugin(Global.paginate);
CricketSchema.plugin(Global.aggregatePaginate);

const Crickets = mongoose.model('crickets', CricketSchema);
module.exports = Crickets;
