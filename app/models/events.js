const mongoose = require('mongoose');
let Global = require('../global/settings');
/*
 [Type]
  1. InPlayEvent
  2. Events Competations
*/
// Define the schema
const inPlayEventsSchema = new mongoose.Schema({
  sportsId:{ type: String, index: true },
  sport: { type: String },
  competitionId: { type: String },
  competitionName: { type: String },
  Id: { type: String, index: true },
  name: { type: String },
  countryCode: { type: String },
  timezone: { type: String },
  openDate: { type: Number },
  inplay: { type: Boolean, index: true },
  inplayFromServer: { type: Boolean, index: true },
  lastCheckMarket: { type: Number, default: 0 },
  isShowed:{ type: Boolean, index: true, default:false },
  hasFancy: { type: Boolean },
  status: { type: String },
  isPremium:{type: Boolean },
  marketIds:{type: Array, default: [] },
  type: { type: Number, default: 0 },
  matchType: { type: String, default: '' },
  islocked: { type: Boolean , default: false, index: true },
  iconStatus: { type: Boolean, default: false },
  matchStoppedReason: { type: String },
  matchStopStatus: { type: Boolean, default: false },
  matchCanceledStatus: { type: Boolean },
  matchResumedStatus:{ type: Boolean },
  //required fields for gray and horse raiding
  meetingId: { type: Number },
  venue: { type: String },
  countryCodes:{ type: String },
  meetingName: { type: String },
  meetingGoing: { type: String },
  meetingOpenDate: { type: String },
  betSettled : { type: Boolean, default: false },
  winner: { type: String, default: '0' },
  draw: {type: Boolean, default: false},
  isCanceled: {type: Boolean, default: false},
  matchTypeProvider: { type: String, default: '' },
  readyForScore: { type: Boolean, default: false },
  betAllowed: { type: Boolean, default: true },
  isResultSaved: { type: Boolean, default: false },
  seriesKey:  { type: String },
  CompanySetStatus: { type: String, default: "PENDING" },
});

inPlayEventsSchema.plugin(Global.paginate);
inPlayEventsSchema.plugin(Global.aggregatePaginate);

// Create the model
inPlayEventsSchema.index({ inplay: 1, sportsId: 1 })
inPlayEventsSchema.index({ sportsId: 1, openDate: 1 });
inPlayEventsSchema.index({ sportsId: 1, openDate: 1, inplay: 1, iconStatus: 1 });
const inPlayEvents = mongoose.model('inplayevents', inPlayEventsSchema);

inPlayEvents.createIndexes();
module.exports = inPlayEvents;
