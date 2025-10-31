"use strict";

const AsianOdds = require("../../../app/models/asiantableOdds");
const AsianTable = require("../../../app/models/asianTable");
const AsianMarketOdd = require("../../../app/models/asianOdds");
const axios = require("axios");
const AsianResult = require("../../../app/models/asianTablesResultsHistory");
const {ASIAN_URI} = require("../../../app/global/constants");
module.exports = apiRequests;
let io;
let apiURL = ASIAN_URI;

const tableNames = [
  {
    tableId: "teen20",
    tableName: "Teen Patti 2020(TP2020)",
    imageUrl: "Teen_Patti_2020.png",
    __v: 0,
  },
  {
    tableId: "teen9",
    tableName: "TEST TEENPATTI(TEST TEENPATTI)",
    imageUrl: "TEST_TEENPATTI.png",
    __v: 0,
  },
  {
    tableId: "lucky7eu",
    tableName: "LUCKY 7-B",
    imageUrl: "LUCKY_7-B.png",
    __v: 0,
  },
  {
    tableId: "card32eu",
    tableName: "32 CARD-B",
    imageUrl: "32_CARD-B.png",
    __v: 0,
  },
  {
    tableId: "aaa",
    tableName: "AMAR AKBAR ANTHONY(AAA)",
    imageUrl: "AMAR_AKBAR_ANTHONY(AAA).png",
    __v: 0,
  },
  {
    tableId: "abj",
    tableName: "ANDAR BAHAR 2",
    imageUrl: "ANDAR_BAHAR_2.png",
    __v: 0,
  },
  {
    tableId: "worli",
    tableName: "WORLI MATKA",
    imageUrl: "worli_matka.png",
    __v: 0,
  },
];

function generateMarketId(data) {
  let mid = "";
  data.map((e) => (mid += e.sid));
  return mid;
}

function apiRequests() {
  return { init, getOddsFromProvider };
  function init(_io, express) {
    io = _io;
    io.on("connection", onConnet);
    //console.log("Express conf loading");

    express.get("/updateField", (req, res) => {
      try {
        if (req.query.id && req.query.data) {
          var d1 = Buffer.from(req.query.data, "base64").toString("ascii");
          d1 = JSON.parse(d1);
          io.emit("updateMatch", { eventId: req.query.id, data: d1 });
        }
      } catch (error) {
        //console.log(error);
      }
      res.send("OK");
    });
  }

  function onConnet(socket) {
    //console.log("Socket connect");

    socket.on("join", async (channel) => {
      if (!channel) {
        return socket.emit("err", "Channel Required");
      }

      if (channel.length == 0) {
        return socket.emit("err", "Channel Required");
      }

      const asianOdd = await AsianOdds.findOne({
        tableId: channel,
      });

      if (asianOdd) {
        socket.emit("matchId", asianOdd._id);
      }

      socket.emit("asian_odd", asianOdd);

      socket.join(channel);
    });
  }

  async function getOddsFromProvider() {
    try {
      const asianTb = await AsianTable.find();
      let apiArray = [];
      let resultArray = [];
      let rResultArray = [];
      if (asianTb.length == 0) {
        await AsianTable.insertMany(tableNames);
      }

      for (let i = 0; i < tableNames.length; i++) {
        let url = `${apiURL}/d_rate/${tableNames[i].tableId}`;
        apiArray.push(axios.get(url));
      }

      const apiResult = await Promise.all(apiArray);

      for (let i = 0; i < tableNames.length; i++) {
        if (apiResult[i].data.data) {
          const roundId = apiResult[i].data.data.t1[0].mid;
          let resultUrl = `${apiURL}/r_result/${tableNames[i].tableId}/${roundId}`;
          let historyUrl = `${apiURL}/l_result/${tableNames[i].tableId}`;
          const rResult = await axios.get(resultUrl);
          const history = await axios.get(historyUrl);
          const asiaOdd = {
            tableId: tableNames[i].tableId,
            t1: apiResult[i].data.data.t1,
            t2: apiResult[i].data.data.t2,
            t3: apiResult[i].data.data.t3,
            gstatus: apiResult[i].data.data.t2[0].gstatus,
            result: rResult.data.data,
            roundId: roundId,
            history: history.data.data.reverse(),
          };

          for (let j = 0; j < 10; j++) {
            const existedRecord = await AsianResult.findOne({
              roundId: asiaOdd.history[j].mid,
            });
            let lastResultUrl = `${apiURL}/r_result/${tableNames[i].tableId}/${asiaOdd.history[j].mid}`;

            if (existedRecord) {
              continue;
            } else {
              const lastHistory = await axios.get(lastResultUrl);
              // const newRecord = {
              //   tableId: tableNames[i].tableId,
              //   marketData: "8",
              //   resultData: lastHistory.data.data[0].win,
              //   description: lastHistory.data.data[0].desc,
              //   eventId: asiaOdd.history[j].mid,
              // };
              // await ResultRecord.findOneAndUpdate(
              //   {
              //     marketData: newRecord.marketData,
              //     eventId: newRecord.eventId,
              //   },
              //   newRecord,
              //   { upsert: true }
              // );
              if (lastHistory.data.data) {
                let asianResult = {
                  tableId: tableNames[i].tableId,
                  roundId: asiaOdd.history[j].mid,
                  result: lastHistory.data.data,
                };

                await AsianResult.findOneAndUpdate(
                  {
                    roundId: asianResult.roundId,
                  },
                  asianResult,
                  { upsert: true }
                );
              }
            }
          }

          if (rResult.data.data) {
            io.to(asiaOdd.tableId).emit("roundStatus", { status: 1 });

            let asianResult = {
              tableId: asiaOdd.tableId,
              roundId: rResult.data.data[0].mid,
              result: rResult.data.data,
            };

            await AsianResult.findOneAndUpdate(
              {
                roundId: asianResult.roundId,
              },
              asianResult,
              { upsert: true }
            );
          }

          const last10Result = await AsianResult.find({
            tableId: asiaOdd.tableId,
          })
            .sort({ _id: -1 })
            .limit(10);

          io.to(asiaOdd.tableId).emit("latestresult", {
            result: last10Result,
          });

          io.to(asiaOdd.tableId).emit("asian_odd", asiaOdd);

          const updateOdd = AsianOdds.findOneAndUpdate(
            { tableId: asiaOdd.tableId },
            asiaOdd,
            { upsert: true }
          );
          resultArray.push(updateOdd);

          const odds = asiaOdd.t2;

          if (asiaOdd.tableId == "teen20") {
            let updateOddArray = [];
            let runnersA = [];
            let runnersPair = [];
            let runnersArray = [];
            for (let j = 0; j < odds.length; j++) {
              if (odds[j].sid == "1" || odds[j].sid == "3") {
                runnersA.push(odds[j]);
              } else {
                runnersPair.push(odds[j]);
              }
            }

            runnersArray.push(runnersA);
            runnersArray.push(runnersPair);

            for (let j = 0; j < 2; j++) {
              const newMarketId = generateMarketId(runnersArray[j]);
              const newMarket = {
                roundId: asiaOdd.roundId,
                marketId: newMarketId,
                marketName: runnersArray[j][0].nation,
                status: runnersArray[j][0].gstatus,
                numberOfRunners: runnersArray[j].length,
                tableId: asiaOdd.tableId,
                runners: runnersArray[j],
              };

              const updateOdd = AsianMarketOdd.findOneAndUpdate(
                {
                  roundId: newMarket.roundId,
                  marketId: newMarket.marketId,
                },
                newMarket,
                { upsert: true }
              );

              updateOddArray.push(updateOdd);
            }

            await Promise.all(updateOddArray);
          } else if(asiaOdd.tableId == "lucky7eu"){
            let updateOddArray = [];
            let runnerLow = [];
            let runnerOdd = [];
            let runnerColor = [];
            let runnerFigure = [];
            let runnersArray = []
            for(let j=0; j<odds.length; j++){
              if(odds[j].sid == "1" || odds[j].sid == "2" ){
                runnerLow.push(odds[j])
              } else if(odds[j].sid == "3" || odds[j].sid == "4" ){
                runnerOdd.push(odds[j])
              } else if(odds[j].sid == "5" || odds[j].sid == "6" ){
                runnerColor.push(odds[j])
              } else if(odds[j].sid == "5" || odds[j].sid == "6" ){
                runnerColor.push(odds[j])
              } else {
                runnerFigure.push(odds[j])
              }
            }

            runnersArray.push(runnerLow)
            runnersArray.push(runnerOdd)
            runnersArray.push(runnerColor)
            runnersArray.push(runnerFigure)

            for(let j=0; j<4; j++){
              const newMarketId = generateMarketId(runnersArray[j])
              const newMarket = {
                roundId: asiaOdd.roundId,
                marketId: newMarketId,
                marketName: runnersArray[j][0].nation,
                status: runnersArray[j][0].gstatus,
                numberOfRunners: runnersArray[j].length,
                tableId: asiaOdd.tableId,
                runners: runnersArray[j],
              }
              const updateOdd = AsianMarketOdd.findOneAndUpdate(
                {
                  roundId: newMarket.roundId,
                  marketId: newMarket.marketId,
                },
                newMarket,
                { upsert: true }
              );
  
              updateOddArray.push(updateOdd);
            }

            await Promise.all(updateOddArray);
          } else if(asiaOdd.tableId == "card32eu"){
            let updateOddArray = [];
            let runnerPlayers = [];
            let runnerColor = [];
            let runnerPlayer8 = [];
            let runnerPlayer9 = [];
            let runnerPlayer10 = [];
            let runnerPlayer11 = [];
            let runnerTotal = [];
            let runnerFigure = [];
            let runnerArray = []
            let playersSid = ["1","2","3","4"]
            for(let j=0;j<odds.length; j++){
              if(playersSid.includes(odds[j].sid)){
                runnerPlayers.push(odds[j])
              } else if(odds[j].sid == "5" || odds[j].sid == "6"){
                runnerPlayer8.push(odds[j])
              } else if(odds[j].sid == "7" || odds[j].sid == "8"){
                runnerPlayer9.push(odds[j])
              } else if(odds[j].sid == "9" || odds[j].sid == "10"){
                runnerPlayer10.push(odds[j])
              } else if(odds[j].sid == "11" || odds[j].sid == "12"){
                runnerPlayer11.push(odds[j])
              } else if(odds[j].sid == "13" || odds[j].sid == "14"|| odds[j].sid == "27"){
                runnerColor.push(odds[j])
              } else if(odds[j].sid == "25" || odds[j].sid == "26"){
                runnerTotal.push(odds[j])
              } else {
                runnerFigure.push(odds[j])
              }
            }
            runnerArray.push(runnerColor)
            runnerArray.push(runnerFigure)
            runnerArray.push(runnerPlayer10)
            runnerArray.push(runnerPlayer11)
            runnerArray.push(runnerPlayer8)
            runnerArray.push(runnerPlayer9)
            runnerArray.push(runnerPlayers)
            runnerArray.push(runnerTotal)

            for(let j=0; j<8; j++){
              const newMarketId = generateMarketId(runnerArray[j])
              const newMarket = {
                roundId: asiaOdd.roundId,
                marketId: newMarketId,
                marketName: runnerArray[j][0].nation,
                status: runnerArray[j][0].gstatus,
                numberOfRunners: runnerArray[j].length,
                tableId: asiaOdd.tableId,
                runners: runnerArray[j],
              }
              const updateOdd = AsianMarketOdd.findOneAndUpdate(
                {
                  roundId: newMarket.roundId,
                  marketId: newMarket.marketId,
                },
                newMarket,
                { upsert: true }
              );
  
              updateOddArray.push(updateOdd);
            }
            await Promise.all(updateOddArray);

          } else if(asiaOdd.tableId == "aaa"){
            let updateOddArray = [];
            let runnerAmar = [];
            let runnerOdd = [];
            let runnerColor = [];
            let runnerOver = [];
            let runnerFigure = [];
            let runnersArray = [];
            for(let j=0; j<odds.length; j++){
              if(odds[j].sid == "1" || odds[j].sid == "2" || odds[j].sid == "3" ){
                runnerAmar.push(odds[j])
              } else if(odds[j].sid == "4" || odds[j].sid == "5"){
                runnerOdd.push(odds[j])
              } else if(odds[j].sid == "6" || odds[j].sid == "7"){
                runnerColor.push(odds[j])
              } else if(odds[j].sid == "21" || odds[j].sid == "22"){
                runnerOver.push(odds[j])
              } else {
                runnerFigure.push(odds[j])
              }
            }

            runnersArray.push(runnerAmar);
            runnersArray.push(runnerOdd);
            runnersArray.push(runnerColor);
            runnersArray.push(runnerOver);
            runnersArray.push(runnerFigure);

            for(let j=0; j<5; j++){
              const newMarketId = generateMarketId(runnersArray[j])
              const newMarket = {
                roundId: asiaOdd.roundId,
                marketId: newMarketId,
                marketName: runnersArray[j][0].nation,
                status: runnersArray[j][0].gstatus,
                numberOfRunners: runnersArray[j].length,
                tableId: asiaOdd.tableId,
                runners: runnersArray[j],
              }

              const updateOdd = AsianMarketOdd.findOneAndUpdate(
                {
                  roundId: newMarket.roundId,
                  marketId: newMarket.marketId,
                },
                newMarket,
                { upsert: true }
              );
  
              updateOddArray.push(updateOdd);
            }
            await Promise.all(updateOddArray);            
          }
        }
      }

      await Promise.all(resultArray);
    } catch (err) {
      //console.log(err);
    }
  }
}
