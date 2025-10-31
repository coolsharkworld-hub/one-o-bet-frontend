const mongoose = require('mongoose');

const cricketMatchSchema = new mongoose.Schema({
  sportsId: { type: String },
  id: { type: String, required: true, index: true },
  name: { type: String, required: true },
  matchType: { type: String, required: true },
  status: { type: String, required: true },
  venue: { type: String, required: true },
  date: { type: String, required: true },
  dateTimeGMT: { type: String, required: true },
  teams: [{ type: String, required: true }],
  teamInfo: [
    {
      name: { type: String, required: true },
      shortname: { type: String, required: true },
      img: { type: String, required: true },
    },
  ],
  score: [
    {
      r: { type: Number, required: true },
      w: { type: Number, required: true },
      o: { type: Number, required: true },
      inning: { type: String, required: true },
    },
  ],
  series_id: { type: String, required: true, index: true },
  fantasyEnabled: { type: Boolean, required: true },
  bbbEnabled: { type: Boolean, required: true },
  hasSquad: { type: Boolean, required: true },
  matchStarted: { type: Boolean, required: true },
  matchEnded: { type: Boolean, required: true },
  winningTeam: { type: String },
});

const cricketMatch = mongoose.model('cricketmatches', cricketMatchSchema);

module.exports = cricketMatch;
