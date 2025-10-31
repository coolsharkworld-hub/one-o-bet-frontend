const mongoose = require('mongoose');

const meetingSchema = new mongoose.Schema({
  meetingId: { type: Number, required: false },
  name: { type: String },
  openDate: { type: Date },
  venue: { type: String },
  eventTypeId: { type: Number },
  countryCode: { type: String },
  meetingGoing: { type: String },
  races: [
    {
      update: { type: String },
      marketId: { type: String },
      raceId: { type: String },
      marketName: { type: String },
      marketType: { type: String },
      numberOfWinners: { type: Number },
      numberOfRunners: { type: Number },
      numberOfActiveRunners: { type: Number },
      startTime: { type: Date },
      result: { type: Boolean },
      raceNumber: { type: String },
      inplay: { type: Boolean },
      status: { type: String }
    }
  ]
});

const eventSchema = new mongoose.Schema({
  sport: { type: String, required: false },
  sportsId: { type: String },
  competitionId: { type: String, required: false },
  competitionName: { type: String, required: false },
  Id: { type: String, required: false },
  name: { type: String, required: false },
  countryCode: { type: String, required: false },
  timezone: { type: String, required: false },
  openDate: { type: Date, required: false },
  inplay: { type: Boolean, required: false },
  hasFancy: { type: Boolean, required: false },
  status: { type: String, required: false },
  isPremium: { type: Boolean, required: false },
  //horse schema
  countryCodes: [String],
  meetings: [meetingSchema],
  type: { type: String },
 });

const Event = mongoose.model('eventsBySport', eventSchema);

module.exports = Event;
