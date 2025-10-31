const mongoose = require('mongoose');

const raceSchema = new mongoose.Schema({
  marketName: { type: String },
  marketId: { type: String },
  marketType: { type: String },
  startTime: { type: Date },
  inplay: { type: Number },
});

const meetingSchema = new mongoose.Schema({
  meetingId: { type: Number },
  venue: { type: String },
  eventTypeId: { type: Number },
  countryCode: { type: String },
  countryCodes: [String],
  races: [raceSchema],
  sportsId: { type: String }
});

const Racing = mongoose.model('Racing', meetingSchema);

module.exports = Racing;
