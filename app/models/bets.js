const mongoose = require("mongoose");
let Global = require("../global/settings");
let Schema = mongoose.Schema
/**
 * [betSchema description]
 *  @status [ 1 active), 0 (settled), 2 (cancelled), 3 (voided)]
 *  @type [ 0(back), 1 (lay) ]
 */
const betSchema = new mongoose.Schema({
  sportsId: { type: String, required: false },
  marketId: { type: String, required: false },
  userId: { type: Number, required: true },
  betAmount: { type: Number, required: true },
  betRate: { type: Number, required: true }, // bet rate chosen by user
  selectedBetRate: { type: Number, default: 0 },
  returnAmount: { type: Number, default: 0 },
  createdAt: { type: Number },
  updatedAt: { type: Number },
  betSession: { type: Number, default: 0 },
  resultId: { type: String, default: null },
  fancyData: { type: String, default: null },
  isfancyOrbookmaker: { type: Boolean, default: false },
  TargetScore: { type: Number },
  status: { type: Number, default: 1 },
  matchId: { type: String },
  winningAmount: { type: Number },
  loosingAmount: { type: Number },
  subMarketId: { type: String },
  event: { type: String, default: "" },
  runner: { type: String, default: "" },
  position: { type: Number, default: 0 },
  name: { type: String },
  matchStatus: { type: String, required: false },
  matchLastUpdate: { type: Number, required: false },
  type: { type: Number },
  isFake: { type: Number, default: 0 },
  sport: { type: String },
  eventId: { type: String },
  runnerName: { type: String },
  fancyRate: { type: Number, default: 0 },
  lastCheckResult: { type: Number, default: 0 },
  calculateExp: { type: Boolean, default: true },
  exposureAmount: { type: Number, default: 0 },
  randomStr:{ type: String, default: '.' },
  runnersPosition: { type: Array },
  ratesRecord: { type: Array },
  multipeResponse: { type: Array },
  betTime: { type: Number },
  isManuel: { type: Boolean, default: false },
  iscalculatedExp: { type: Number },
  roundId: { type: String },
  asianTableName: { type: String },
  asianTableId: { type: String },
  matchType:{ type: String, default: 0 },
  winnerRunnerData:{ type: String, default: 0 },
  resultData:{ type: String, default: '.' },
  SessionScore : { type: Number, default: 0 },
  backFancyRate: { type: Number, default: 0 },
  layFancyRate: { type: Number, default: 0 },
  locationData: { type: Schema.Types.Mixed },
  ipAddress: { type: String },
  device: { type: String },
  vpn: { type: Boolean, default: false }
});

betSchema.pre("save", function (next) {
  var now = new Date().getTime();
  if (!this.createdAt) {
    this.createdAt = now;
  } else {
    this.updatedAt = now;
  }
  next();
});

betSchema.plugin(Global.aggregatePaginate);
betSchema.plugin(Global.paginate);
const Bets = mongoose.model("bet", betSchema);
//   Bets.createIndexes();
module.exports = Bets;
