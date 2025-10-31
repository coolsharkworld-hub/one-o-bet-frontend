const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const tableSchema = new Schema({
  eventId: {
    type: String,
    required: true,
    index: true, 
  },
  marketId: {
    type: String,
    required: true,
    index: true, 
  },
  created: {
    type: Date,
    default: Date.now
  },
  data: {
    type: Schema.Types.Mixed, 
    required: true,
  },
});

const fancyOdds = mongoose.model('fancyOdds', tableSchema);

module.exports = fancyOdds;