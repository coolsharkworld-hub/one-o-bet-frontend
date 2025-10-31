const mongoose = require('mongoose');

const betFairGamesSchema = new mongoose.Schema({
  type: { type: Number, required: true },
  title: { type: String, required: true },
  imgUrl: { type: String, required: true },
  createdAt: { type: Number },
  updatedAt: { type: Number },
});

betFairGamesSchema.pre('save', function (next) {
  var now = new Date().getTime() / 1000;
  if (!this.createdAt) {
    this.createdAt = now;
  } else {
    this.updatedAt = now;
  }
  next();
});

const betFairGames = mongoose.model('betFairGames', betFairGamesSchema);
module.exports = betFairGames;
