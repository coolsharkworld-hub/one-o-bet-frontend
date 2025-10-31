const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const scoreSchema = new Schema({
  eventId: {
    type: String,
    required: false,
    index: true,
  },
  scoreKey: {
    type: String,
    required: false,
    index: true,
  },
  sportsId: {
    type: String,
    required: false,
    index: true,
  },
  data: {
    type: Schema.Types.Mixed,
    required: false,
  },
  createdAt: { type: Number },
  updatedAt:  { type: Number },
});

scoreSchema.pre('save', function (next) {
  let now = new Date().getTime();
  if (!this.createdAt) {
    this.createdAt = now;
  } else {
    this.updatedAt = now;
  }
  next();
});

const Score = mongoose.model('Score', scoreSchema);
module.exports = Score;
