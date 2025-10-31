const mongoose = require('mongoose');

const competitionSchema = new mongoose.Schema({
  Id: { type: String, required: false },
  Name: { type: String, required: false },
  sportsId: { type: String },
});

const Competition = mongoose.model('Competition', competitionSchema);

module.exports = Competition;
