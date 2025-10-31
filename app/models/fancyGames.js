const mongoose = require('mongoose');

// const t3DataSchema = new mongoose.Schema({
//   mid: { type: String, required: false },
//   sid: { type: String, required: false },
//   nat: { type: String, required: false },
//   b1: { type: String, required: false },
//   bs1: { type: String, required: false },
//   l1: { type: String, required: false },
//   ls1: { type: String, required: false },
//   b2: { type: String, required: false },
//   bs2: { type: String, required: false },
//   l2: { type: String, required: false },
//   ls2: { type: String, required: false },
//   b3: { type: String, required: false },
//   bs3: { type: String, required: false },
//   l3: { type: String, required: false },
//   ls3: { type: String, required: false },
//   gtype: { type: String, required: false },
//   utime: { type: String, required: false },
//   gvalid: { type: String, required: false },
//   gstatus: { type: String, required: false },
//   remark: { type: String, required: false },
//   min: { type: String, required: false },
//   max: { type: String, required: false },
//   srno: { type: String, required: false },
//   s1: { type: String, required: false },
//   s2: { type: String, required: false },
//   ballsess: { type: String, required: false },
// });

const fancyGames = new mongoose.Schema({
  t1: { type: Array },
  t2: { type: Array },
  t3: { type: Array },
  t4: { type: Array },
  success: { type: Boolean, required: false },
  status: { type: Number, required: false },
  updatetime: { type: String, required: false },
  eventTypeId: { type: String, required: false },
  eventTypeName: { type: String, required: false },
  eventName: { type: String, required: false },
  name: { type: String, required: false },
  eventDate: { type: String, required: false },
gameId: { type: String, required: false },
  type: { type: String },
  eventId:{ type: String },
  createdAt: { type: Number }
});

const FancyGames = mongoose.model('fancyGames', fancyGames);

module.exports = FancyGames;
