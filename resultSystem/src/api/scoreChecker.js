'use strict';
module.exports = scoreChecker;
require('dotenv').config();

const axios = require('axios');
const mongoose = require('mongoose');
const resultRecords = require('../../../app/models/resultRecords');
const Bets = require('../../../app/models/bets');
const inPlayEvents = require('../../../app/models/events');
const MarketIDs = require('../../../app/models/marketIds');
const FancyOdds = require('../../../app/models/fancyOdds');

const { API_DOMAIN } = require('../../../app/global/constants');
const { checkActiveBettors } = require('../../../helper/bet');
const { getSessionFancyResult, getSessionBookmakerResult } = require('../../../helper/api/sessionAPIHelper');
const { handleLosingBet, handleWinningBet, handleDrawBet } = require('../CalculateBets/calculations');

const horseRaceUrl = 'http://136.244.77.249:33333';
// const sportsAPIUrl = "http://209.250.242.175:33332";
const sportsAPIUrl = 'http://185.58.225.212:8080/api';

const header = {
  headers: {
    accept: 'application/json',
    'Content-Type': 'application/json',
    'X-App': process.env.XAPP_NAME
  }
};

const tableInfo = [
  { id: '36', tId: 'teen20' },
  // { id: "37", tId: "teen9" },
  // { id: "38", tId: "lucky7" },
  { id: '39', tId: 'lucky7eu' },
  { id: '40', tId: 'card32eu' },
  { id: '41', tId: 'aaa' }
  // { id: "42", tId: "ab20" },
  // { id: "43", tId: "abj" },
  // { id: "44", tId: "worli" },
];

function scoreChecker() {
  return {
    eventsResult,
    racingResult,
    fancyResult,
    bookMakerResult,
    asianResult,
    manuel
  };

  function getWinnerSelectionId(listMarketBookResult) {
    if (!listMarketBookResult) return null;
    let winnerSelectionId = null;
    const runners = listMarketBookResult.runners || [];
    for (const runner of runners) {
      if (runner.status === 'WINNER') {
        winnerSelectionId = runner.selectionId;
        break;
      }
    }
    return winnerSelectionId;
  }

  async function eventsResult(betData) {
    //console.log("Result checking event for ", betData.marketId);
    try {
      let results;
      const manuelRecord = await MarketIDs.findOne({
        marketId: betData.marketId,
        winnerRunnerData: { $ne: null }
      });

      if (manuelRecord) {
        //console.log("Inside manual");

        if (typeof manuelRecord.manuelClose !== undefined) {
          results = [
            {
              winnerSelectionId: manuelRecord.winnerRunnerData,
              manuelClose: manuelRecord.manuelClose
            }
          ];
        } else {
          results = [
            {
              winnerSelectionId: manuelRecord.winnerRunnerData,
              manuelClose: false
            }
          ];
        }
      } else {
        const url = `${sportsAPIUrl}/listMarketBook`;
        const requestData = {
          marketIds: [betData.marketId]
        };
        const response = await axios.post(url, requestData, header);
        const resData = response.data.result;
        results = [
          {
            winnerSelectionId: getWinnerSelectionId(resData[0]),
            manuelClose: false
          }
        ];
      }
      //console.log("results.length -> " + results.length)
      if (results.length > 0) {
        const result = results[0];
        if (!result.winnerSelectionId) return;
        let newRecord = new resultRecords({
          eventId: betData.matchId,
          marketData: betData.marketId,
          resultData: result.winnerSelectionId
        });

        const bets = await Bets.find({
          marketId: betData.marketId,
          sportsId: betData.sportsId,
          status: 1
        });

        await newRecord.save();
        await Bets.updateMany({ marketId: betData.marketId, sportsId: betData.sportsId }, { $set: { resultId: newRecord._id } });

        if (result.winnerSelectionId == -1) {
          //console.log("result.winnerSelectionId == -1 -->", betData.marketId);
          for (const bet of bets) {
            if (typeof bet.isManuel !== 'undefined' && bet.isManuel == true && result.manuelClose == false) {
              continue;
            }
            if (typeof result.manuelClose === 'undefined' && bet.isManuel == true) continue;
            await handleDrawBet(bet);
          }
        } else {
          //console.log("ELSE result.winnerSelectionId == -1 -->", betData.marketId);
          for (const bet of bets) {
            if (typeof bet.isManuel !== 'undefined' && bet.isManuel == true && result.manuelClose == false) {
              continue;
            }
            if (typeof result.manuelClose === 'undefined' && bet.isManuel == true) continue;
            if (bet.type == 0 && bet.runner == result.winnerSelectionId) {
              //console.log("0 ----- winner ");
              await handleWinningBet(bet, result.winnerSelectionId);
            } else if (bet.type == 0 && bet.runner != result.winnerSelectionId) {
              //console.log("0 ----- looser ");
              await handleLosingBet(bet);
            } else if (bet.type == 1 && bet.runner != result.winnerSelectionId) {
              //console.log("1 ----- winner ");
              await handleWinningBet(bet, result.winnerSelectionId);
            } else if (bet.type == 1 && bet.runner == result.winnerSelectionId) {
              //console.log("1 ----- looser ");
              await handleLosingBet(bet);
            } else {
              //console.log("-----  Draw ");
              await handleDrawBet(bet);
            }
          }
        }
      }
    } catch (error) {
      console.error(error);
    }
  }

  async function racingResult(betData) {
    //console.log("Result checking racing with " + betData.marketId);

    try {
      let results;
      const manuelRecord = await MarketIDs.findOne({
        marketId: betData.marketId,
        winnerRunnerData: { $ne: null }
      });

      if (manuelRecord) {
        if (typeof manuelRecord.manuelClose !== undefined)
          results = [
            {
              winnerSelectionId: manuelRecord.winnerRunnerData,
              manuelClose: manuelRecord.manuelClose
            }
          ];
        else
          results = [
            {
              winnerSelectionId: manuelRecord.winnerRunnerData,
              manuelClose: false
            }
          ];
      } else {
        const url = `${sportsAPIUrl}/listMarketBook`;
        const requestData = {
          marketIds: [betData.marketId]
        };
        const response = await axios.post(url, requestData, header);
        const resData = response.data.result;
        results = [
          {
            winnerSelectionId: getWinnerSelectionId(resData[0]),
            manuelClose: false
          }
        ];
      }
      if (results.length > 0) {
        const result = results[0];
        if (!result.winnerSelectionId) return;
        let newRecord = new resultRecords({
          eventId: betData.matchId,
          marketData: betData.marketId,
          resultData: result.winnerSelectionId
        });

        const bets = await Bets.find({
          marketId: betData.marketId,
          sportsId: betData.sportsId,
          status: 1
        });

        await newRecord.save();
        await Bets.updateMany({ marketId: betData.marketId, sportsId: betData.sportsId }, { $set: { resultId: newRecord._id } });

        if (result.winnerSelectionId == -1) {
          for (const bet of bets) {
            if (typeof bet.isManuel !== 'undefined' && bet.isManuel == true && result.manuelClose == false) {
              continue;
            }
            if (typeof result.manuelClose === 'undefined' && bet.isManuel == true) continue;
            //console.log("handle bet draw");
            await handleDrawBet(bet);
          }
        } else {
          for (const bet of bets) {
            if (typeof bet.isManuel !== 'undefined' && bet.isManuel == true && result.manuelClose == false) {
              continue;
            }
            if (typeof result.manuelClose === 'undefined' && bet.isManuel == true) continue;
            if (bet.type == 0 && bet.runner == result.winnerSelectionId) {
              //console.log("0 ----- winner ");
              await handleWinningBet(bet, result.winnerSelectionId);
            } else if (bet.type == 0 && bet.runner != result.winnerSelectionId) {
              //console.log("0 ----- looser ");
              await handleLosingBet(bet);
            } else if (bet.type == 1 && bet.runner != result.winnerSelectionId) {
              //console.log("1 ----- winner ");
              await handleWinningBet(bet, result.winnerSelectionId);
            } else if (bet.type == 1 && bet.runner == result.winnerSelectionId) {
              //console.log("1 ----- looser ");
              await handleLosingBet(bet);
            } else {
              //console.log("-----  Draw ");
              await handleDrawBet(bet);
            }
          }
        }
      }
    } catch (error) {
      console.error(error);
    }
  }

  async function bookMakerResult(betData) {
    try {
      let selectedMarketId = null;
      const event = await inPlayEvents.findOne({ _id: mongoose.Types.ObjectId(betData.matchId) }, { Id: 1 });

      if (!event) return;

      let results;
      const manuelRecord = await MarketIDs.findOne({
        marketId: betData.marketId,
        eventId: event.Id,
        winnerRunnerData: { $ne: null }
      });

      if (manuelRecord) {
        if (typeof manuelRecord.manuelClose !== undefined)
          results = [
            {
              winnerSelId: manuelRecord.winnerRunnerData,
              manuelClose: manuelRecord.manuelClose
            }
          ];
        else results = [{ winnerSelId: manuelRecord.winnerRunnerData, manuelClose: false }];
      } else {
        const DBOddDetails = await FancyOdds.findById(betData.asianTableId);
        const dbFancyOdds = DBOddDetails?.data?.data?.t2[0]?.bm1;
        selectedMarketId = dbFancyOdds[0]?.ssid;
        if (!selectedMarketId) return false;
        // const bookmakerRes = await getBookmakerOdds([selectedMarketId])
        const bookmakerRes = await getSessionBookmakerResult([selectedMarketId]);
        // let url = `https://${API_DOMAIN}:3443/api/bookmaker_result/${event.Id}`;
        // const response = await axios.get(url);
        // results = response.data;
        // { winnerSelId: '51511462' }
        if (bookmakerRes[0]?.result) {
          results = [{ winnerSelId: bookmakerRes[0]?.result, manuelClose: false }];
        } else {
          return false;
        }
      }

      if (results.length > 0) {
        const result = results[0];
        let newRecord = new resultRecords({
          eventId: betData.matchId,
          marketData: selectedMarketId || 'Bookmaker',
          resultData: result
        });

        await newRecord.save();
        await Bets.updateMany(
          {
            matchId: event._id.toString(),
            isfancyOrbookmaker: true,
            fancyData: null
          },
          { $set: { resultId: newRecord._id } }
        );

        const bets = await Bets.find({
          matchId: event._id.toString(),
          isfancyOrbookmaker: true,
          fancyData: null,
          status: 1
        });

        await MarketIDs.findOneAndUpdate(
          {
            eventId: event.Id,
            marketId: selectedMarketId || 'Bookmaker'
          },
          {
            eventId: event.Id,
            marketId: selectedMarketId || 'Bookmaker',
            marketName: result.eventName,
            sportID: -1,
            status: 'Bookmaker Result',
            winnerInfo: result.winnerSelId,
            winnerRunnerData: result.winnerSelId,
            index: 0
          },
          {
            new: true,
            upsert: true
          }
        );

        if (result.winnerSelId == -1) {
          for (const bet of bets) {
            if (typeof bet.isManuel !== 'undefined' && bet.isManuel == true && result.manuelClose == false) {
              continue;
            }
            if (typeof result.manuelClose === 'undefined' && bet.isManuel == true) continue;
            await handleDrawBet(bet);
          }
        } else {
          for (const bet of bets) {
            if (typeof bet.isManuel !== 'undefined' && bet.isManuel == true && result.manuelClose == false) {
              continue;
            }
            if (typeof result.manuelClose === 'undefined' && bet.isManuel == true) continue;
            if (bet.type == 0 && bet.runner == result.winnerSelId) {
              //console.log("0 ----- winner ");
              await handleWinningBet(bet, result.winnerSelId);
            } else if (bet.type == 0 && bet.runner != result.winnerSelId) {
              //console.log("0 ----- looser ");
              await handleLosingBet(bet);
            } else if (bet.type == 1 && bet.runner != result.winnerSelId) {
              //console.log("1 ----- winner ");
              await handleWinningBet(bet, result.winnerSelId);
            } else if (bet.type == 1 && bet.runner == result.winnerSelId) {
              //console.log("1 ----- looser ");
              await handleLosingBet(bet);
            } else {
              //console.log("-----  Draw ");
              await handleDrawBet(bet);
            }
          }
        }
      }
    } catch (error) {
      console.error(error);
    }
  }

  async function fancyResult(betData, fancyName) {
    try {
      const event = await inPlayEvents.findOne({ _id: mongoose.Types.ObjectId(betData.matchId) }, { Id: 1 });

      if (!event) return;

      let results;
      const manuelRecord = await MarketIDs.findOne({
        marketId: fancyName,
        eventId: event.Id,
        winnerRunnerData: { $ne: null }
      });

      if (manuelRecord) {
        if (typeof manuelRecord.manuelClose !== undefined)
          results = [
            {
              result: manuelRecord.winnerRunnerData,
              manuelClose: manuelRecord.manuelClose
            }
          ];
        else results = [{ result: manuelRecord.winnerRunnerData, manuelClose: false }];
      } else {
        // const fancyOdds = await getFancyOdds([betData.runner])
        // const DBOddDetails = await FancyOdds.findById(betData.asianTableId);
        // const dbFancyOdds = DBOddDetails?.data?.data?.t3.filter(item => item.sid === betData.runner);
        // const selectedMarketId = dbFancyOdds[0]?.ssid
        const selectedMarketId = `${betData.eventId}_${betData.runner}`;
        if (!selectedMarketId) return;
        let fancyOdds = await getSessionFancyResult([selectedMarketId]);
        fancyOdds = fancyOdds.filter((item) => item.id === selectedMarketId);
        // let url = `https://${API_DOMAIN}:3443/api/fancy_result_multi/${event.Id}/${fancyName}`;
        // const response = await axios.get(url);
        // results = response.data;
        let result = fancyOdds[0]?.result;
        results = [{ manuelClose: false, result: result }];
      }

      if (results.length > 0) {
        const result = results[0];

        if (result.result == null) return;

        let newRecord = new resultRecords({
          eventId: betData.matchId,
          marketData: fancyName,
          resultData: result.result
        });

        await newRecord.save();
        await Bets.updateMany(
          {
            matchId: event._id.toString(),
            isfancyOrbookmaker: true,
            fancyData: fancyName
          },
          {
            $set: {
              resultId: newRecord._id,
              resultData: result.result
            }
          }
        );

        const bets = await Bets.find({
          matchId: event._id.toString(),
          isfancyOrbookmaker: true,
          fancyData: fancyName,
          status: 1
        });

        await MarketIDs.findOneAndUpdate(
          {
            eventId: event.Id,
            marketId: fancyName
          },
          {
            eventId: event.Id,
            marketId: fancyName,
            marketName: result.fancyName,
            sportID: -1,
            status: 'Fancy Result',
            winnerInfo: result.result,
            winnerRunnerData: result.result,
            index: 0
          },
          {
            new: true,
            upsert: true
          }
        );

        if (result.result == -1) {
          for (const bet of bets) {
            if (typeof bet.isManuel !== 'undefined' && bet.isManuel === true && result.manuelClose === false) {
              continue;
            }
            if (typeof result.manuelClose === 'undefined' && bet.isManuel === true) continue;
            await handleDrawBet(bet);
          }
        } else {
          for (const bet of bets) {
            if (typeof bet.isManuel !== 'undefined' && bet.isManuel === true && result.manuelClose === false) {
              continue;
            }
            if (typeof result.manuelClose === 'undefined' && bet.isManuel === true) continue;

            //check type
            //for type 0
            if (bet.type == 0) {
              if (parseInt(bet.TargetScore) > parseInt(result.result)) await handleWinningBet(bet, parseInt(result.result));
              else await handleLosingBet(bet);
            } else if (bet.type == 1) {
              if (parseInt(bet.TargetScore) <= parseInt(result.result)) await handleWinningBet(bet, parseInt(result.result));
              else await handleLosingBet(bet);
            } else {
              await handleDrawBet(bet);
            }
          }
        }
      }
    } catch (error) {
      console.error('fancyResult:', error);
    }
  }

  async function asianResult(betData) {
    //console.log("Result checking event");

    try {
      for (let i = 0; i < betData.length; i++) {
        const tId = tableInfo.find((e) => e.id === betData[i].subMarketId);
        const apiURL = `https://${API_DOMAIN}:3445/api`;
        let resultUrl = `${apiURL}/r_result/${tId.tId}/${betData[i].roundId}`;
        const result = await axios.get(resultUrl);

        let tableId = betData[i].subMarketId; //id in SubmarketType collection
        if (result.data.data) {
          //Lucky7eu
          if (tableId === '39') {
            if (result.data.data[0].win == '0') {
              if (betData[i].runner == '1' || betData[i].runner == '2') {
                await handleDrawBet(betData[i]);
              } else {
                const description = result.data.data[0].desc;
                const generalResult = description.split(' || ');
                let wid = '0';
                let widColor = '0';
                let widOdd = '0';
                if (generalResult[1] === 'Red') {
                  widColor = '5';
                } else if (generalResult[1] === 'Black') {
                  widColor = '6';
                }

                if (generalResult[2] === 'Even') {
                  widOdd = '3';
                } else if (generalResult[2] === 'Odd') {
                  widOdd = '4';
                }

                if (generalResult[3] === 'Card A') {
                  wid = '7';
                } else if (generalResult[3] === 'Card 2') {
                  wid = '8';
                } else if (generalResult[3] === 'Card 3') {
                  wid = '9';
                } else if (generalResult[3] === 'Card 4') {
                  wid = '10';
                } else if (generalResult[3] === 'Card 5') {
                  wid = '11';
                } else if (generalResult[3] === 'Card 6') {
                  wid = '12';
                } else if (generalResult[3] === 'Card 7') {
                  wid = '13';
                } else if (generalResult[3] === 'Card 8') {
                  wid = '14';
                } else if (generalResult[3] === 'Card 9') {
                  wid = '15';
                } else if (generalResult[3] === 'Card 10') {
                  wid = '16';
                } else if (generalResult[3] === 'Card J') {
                  wid = '17';
                } else if (generalResult[3] === 'Card Q') {
                  wid = '18';
                } else if (generalResult[3] === 'Card K') {
                  wid = '19';
                }

                if (betData[i].runner == wid || betData[i].runner == widColor || betData[i].runner == widOdd) {
                  await handleWinningBet(betData[i]);
                } else {
                  await handleLosingBet(betData[i]);
                }
              }
            } else {
              if (betData[i].runner == result.data.data[0].win) {
                await handleWinningBet(betData[i]);
              } else {
                const description = result.data.data[0].desc;
                const generalResult = description.split(' || ');
                let wid = '0';
                let widColor = '0';
                let widOdd = '0';
                if (generalResult[1] === 'Red') {
                  widColor = '5';
                } else if (generalResult[1] === 'Black') {
                  widColor = '6';
                }

                if (generalResult[2] === 'Even') {
                  widOdd = '3';
                } else if (generalResult[2] === 'Odd') {
                  widOdd = '4';
                }

                if (generalResult[3] === 'Card A') {
                  wid = '7';
                } else if (generalResult[3] === 'Card 2') {
                  wid = '8';
                } else if (generalResult[3] === 'Card 3') {
                  wid = '9';
                } else if (generalResult[3] === 'Card 4') {
                  wid = '10';
                } else if (generalResult[3] === 'Card 5') {
                  wid = '11';
                } else if (generalResult[3] === 'Card 6') {
                  wid = '12';
                } else if (generalResult[3] === 'Card 7') {
                  wid = '13';
                } else if (generalResult[3] === 'Card 8') {
                  wid = '14';
                } else if (generalResult[3] === 'Card 9') {
                  wid = '15';
                } else if (generalResult[3] === 'Card 10') {
                  wid = '16';
                } else if (generalResult[3] === 'Card J') {
                  wid = '17';
                } else if (generalResult[3] === 'Card Q') {
                  wid = '18';
                } else if (generalResult[3] === 'Card K') {
                  wid = '19';
                }

                if (betData[i].runner == wid || betData[i].runner == widColor || betData[i].runner == widOdd) {
                  await handleWinningBet(betData[i]);
                } else {
                  await handleLosingBet(betData[i]);
                }
              }
            }
          }
          // Teen20
          else if (tableId == '36') {
            //console.log(" ===================== result", result.data.data[0]);
            //console.log(" ===================== winner", result.data.data[0].win);
            if (result.data.data[0].win == '0') {
              await handleDrawBet(betData[i]);
              //console.log(" ===================== commining from Line 620");
            } else {
              if ((betData[i].runner == '1' && result.data.data[0].win == '1') || (betData[i].runner == '3' && result.data.data[0].win == '3')) {
                await handleWinningBet(betData[i]);
              } else {
                let sid = result.data.data[0].sid.split(',');

                //Teen2020 Result Cases
                //"sid": "3,12,22"
                //"sid": "3,12"
                //"sid": "3,22"
                // runner: 1, 2, 3, 4
                const rateArray = [1, 4, 6, 35, 45];
                const res = sid.find((a) => a.length === 2 && parseInt(betData[i].runner) % 2 == 0 && a[0] == parseInt(betData[i].runner) / 2);

                if (res) {
                  const rate = rateArray[parseInt(res[1]) - 2];
                  betData[i].winningAmount = betData[i].betAmount * rate;
                  await handleWinningBet(betData[i]);
                } else {
                  await handleLosingBet(betData[i]);
                }
              }
            }
          }

          // Card32eu
          else if (tableId === '40') {
            if (result.data.data[0].win === '0') {
              await handleDrawBet(betData[i]);
            } else {
              if (betData[i].runner == result.data.data[0].win) {
                if (betData[i].type == 1) {
                  await handleLosingBet(betData[i]);
                } else if (betData[i].type == 0) {
                  await handleWinningBet(betData[i]);
                }
              } else {
                let wid = '0';
                let widOddFirst = '0';
                let widOddSecond = '0';
                let widOddThird = '0';
                let widOddFourth = '0';
                const description = result.data.data[0].desc;
                const generalResult = description.split('|');
                const oddResult = generalResult[1].split(',');
                const colorResult = generalResult[2].split(',');
                if (oddResult[0].split(':')[1] === 'Odd') {
                  widOddFirst = '5';
                } else if (oddResult[0].split(':')[1] === 'Even') {
                  widOddFirst = '6';
                }

                if (oddResult[1].split(':')[1] === 'Odd') {
                  widOddSecond = '7';
                } else if (oddResult[1].split(':')[1] === 'Even') {
                  widOddSecond = '8';
                }

                if (oddResult[2].split(':')[1] === 'Odd') {
                  widOddThird = '9';
                } else if (oddResult[2].split(':')[1] === 'Even') {
                  widOddThird = '10';
                }

                if (oddResult[3].split(':')[1] === 'Odd') {
                  widOddFourth = '11';
                } else if (oddResult[3].split(':')[1] === 'Even') {
                  widOddFourth = '12';
                }

                let widColor1 = '0';
                let widColor2 = '0';
                let widColor3 = '0';

                if (colorResult[0].split(':')[1] === 'Yes') {
                  widColor1 = '13';
                }

                if (colorResult[1].split(':')[1] === 'Yes') {
                  widColor2 = '14';
                }

                if (colorResult[2].split(':')[1] === 'Yes') {
                  widColor3 = '27';
                }

                if (generalResult[3] === '1') {
                  wid = '15';
                } else if (generalResult[3] === '2') {
                  wid = '16';
                } else if (generalResult[3] === '3') {
                  wid = '17';
                } else if (generalResult[3] === '4') {
                  wid = '18';
                } else if (generalResult[3] === '5') {
                  wid = '19';
                } else if (generalResult[3] === '6') {
                  wid = '20';
                } else if (generalResult[3] === '7') {
                  wid = '21';
                } else if (generalResult[3] === '8') {
                  wid = '22';
                } else if (generalResult[3] === '9') {
                  wid = '23';
                } else if (generalResult[3] === '0') {
                  wid = '24';
                }

                let widPair = '0';
                if (generalResult[4] === '8-9') {
                  widPair = '25';
                } else if (generalResult[4] === '10-11') {
                  widPair = '26';
                }

                if (
                  betData[i].runner == wid ||
                  betData[i].runner == widOddFirst ||
                  betData[i].runner == widOddSecond ||
                  betData[i].runner == widOddThird ||
                  betData[i].runner == widOddFourth ||
                  betData[i].runner == widColor1 ||
                  betData[i].runner == widColor2 ||
                  betData[i].runner == widColor3 ||
                  betData[i].runner == widPair
                ) {
                  if (betData[i].type == 1) {
                    await handleLosingBet(betData[i]);
                  } else if (betData[i].type == 0) {
                    await handleWinningBet(betData[i]);
                  } else {
                    await handleDrawBet(betData[i], 0);
                  }
                } else {
                  if (betData[i].type == 0) {
                    await handleLosingBet(betData[i]);
                  } else if (betData[i].type == 1) {
                    await handleWinningBet(betData[i]);
                  } else {
                    await handleDrawBet(betData[i], 0);
                  }
                }
              }
            }
          }
          // AAA
          else if (tableId === '41') {
            if (result.data.data[0].win === '0') {
              await handleDrawBet(betData[i]);
            } else {
              if (betData[i].runner == result.data.data[0].win) {
                if (betData[i].type == 1) {
                  await handleLosingBet(betData[i]);
                } else if (betData[i].type == 0) {
                  await handleWinningBet(betData[i]);
                } else {
                  await handleDrawBet(betData[i], 0);
                }
              } else {
                let wid = '';
                let widColor = '0';
                let widOdd = '0';
                let widSeven = '0';
                const description = result.data.data[0].desc.split(' | ');

                if (description[1] === 'Red') {
                  widColor = '6';
                } else if (description[1] === 'Black') {
                  widColor = '7';
                }

                if (description[2] === 'Even') {
                  widOdd = '4';
                } else if (description[2] === 'Odd') {
                  widOdd = '5';
                }

                if (description[3] === 'Under 7') {
                  widSeven = '21';
                } else if (description[3] === 'Over 7') {
                  widSeven = '22';
                }

                if (description[4] === 'Card A') {
                  wid = '8';
                } else if (description[4] === 'Card 2') {
                  wid = '9';
                } else if (description[4] === 'Card 3') {
                  wid = '10';
                } else if (description[4] === 'Card 4') {
                  wid = '11';
                } else if (description[4] === 'Card 5') {
                  wid = '12';
                } else if (description[4] === 'Card 6') {
                  wid = '13';
                } else if (description[4] === 'Card 7') {
                  wid = '14';
                } else if (description[4] === 'Card 8') {
                  wid = '15';
                } else if (description[4] === 'Card 9') {
                  wid = '16';
                } else if (description[4] === 'Card 10') {
                  wid = '17';
                } else if (description[4] === 'Card J') {
                  wid = '18';
                } else if (description[4] === 'Card Q') {
                  wid = '19';
                } else if (description[4] === 'Card K') {
                  wid = '20';
                }

                if (betData[i].runner == wid || betData[i].runner == widColor || betData[i].runner == widOdd || betData[i].runner == widSeven) {
                  if (betData[i].type == 1) {
                    await handleLosingBet(betData[i]);
                  } else if (betData[i].type == 0) {
                    await handleWinningBet(betData[i]);
                  } else {
                    await handleDrawBet(betData[i], 0);
                  }
                } else {
                  if (betData[i].type == 0) {
                    await handleLosingBet(betData[i]);
                  } else if (betData[i].type == 1) {
                    await handleWinningBet(betData[i]);
                  } else {
                    await handleDrawBet(betData[i], 0);
                  }
                }
              }
            }
          }

          // ABJ
          else if (tableId === '43') {
            if (result.data.data[0].win === '0') {
              handleDrawBet(betData[i]);
            } else {
              if (betData[i].runner == '1' && result.data.data[0].win == '1') {
                handleWinningBet(betData[i]);
              } else if (betData[i].runner == '4' && result.data.data[0].win == '2') {
                handleWinningBet(betData[i]);
              } else {
                let wid = '';
                let widColor = '0';
                let widOdd = '0';
                const resultCards = result.data.data[0].cards;
                const splitedCards = resultCards.split(',');
                const finalCards = splitedCards.filter(function (n) {
                  return n !== '1';
                });

                const jokerCardNumber = finalCards[0][0];
                const jokerCardColor = finalCards[0].slice(1);
                const oddOrEvenNumber = parseInt(jokerCardNumber) % 2;
                if (jokerCardNumber == 'A') {
                  wid = '7';
                } else if (jokerCardNumber == '2') {
                  wid = '8';
                } else if (jokerCardNumber == '3') {
                  wid = '9';
                } else if (jokerCardNumber == '4') {
                  wid = '10';
                } else if (jokerCardNumber == '5') {
                  wid = '11';
                } else if (jokerCardNumber == '6') {
                  wid = '12';
                } else if (jokerCardNumber == '7') {
                  wid = '13';
                } else if (jokerCardNumber == '8') {
                  wid = '14';
                } else if (jokerCardNumber == '9') {
                  wid = '15';
                } else if (jokerCardNumber == '10') {
                  wid = '16';
                } else if (jokerCardNumber == 'J') {
                  wid = '17';
                } else if (jokerCardNumber == 'Q') {
                  wid = '18';
                } else if (jokerCardNumber == 'K') {
                  wid = '19';
                }

                if (jokerCardColor == 'SS') {
                  widColor = '20';
                } else if (jokerCardColor == 'CC') {
                  widColor = '21';
                } else if (jokerCardColor == 'HH') {
                  widColor = '22';
                } else if (jokerCardColor == 'DD') {
                  widColor = '23';
                }

                if (oddOrEvenNumber == 0) {
                  widOdd = '24';
                } else if (oddOrEvenNumber == 1) {
                  widOdd = '25';
                }

                if (betData[i].runner == '2' && finalCards.length == 2) {
                  handleWinningBet(betData[i]);
                }
                if (betData[i].runner == '3' && finalCards.length == 4) {
                  handleWinningBet(betData[i]);
                }
                if (betData[i].runner == '5' && finalCards.length == 3) {
                  handleWinningBet(betData[i]);
                }
                if (betData[i].runner == '6' && finalCards.length == 5) {
                  handleWinningBet(betData[i]);
                }

                if (betData[i].runner == wid || betData[i].runner == widColor || betData[i].runner == widOdd) {
                  handleWinningBet(betData[i]);
                } else {
                  handleLosingBet(betData[i]);
                }
              }
            }
          }

          // Worli
          else if (tableId === '44') {
            if (result.data.data[0].win === '0') {
              handleDrawBet(betData[i]);
            } else {
              if (betData[i].runner == result.data.data[0].win) {
                handleWinningBet(betData[i]);
              } else {
                handleLosingBet(betData[i]);
              }
            }
          }

          await Bets.updateMany({ eventId: betData[i].eventId }, { $set: { resultId: result.data.data[0].mid } });

          let newRecord = {
            tableId: tId.tId,
            marketData: '8',
            resultData: result.data.data[0].win,
            description: result.data.data[0].desc,
            eventId: result.data.data[0].mid
          };

          await resultRecords.findOneAndUpdate(
            {
              marketData: newRecord.marketData,
              eventId: newRecord.eventId
            },
            newRecord,
            { upsert: true }
          );
        }
      }
    } catch (error) {
      console.error(error);
    }
  }

  async function manuel(bets) {
    for (let bet of bets) {
      const checkActive = await checkActiveBettors(bet.betData);
      if (checkActive) continue;
      //figure bets
      const event = await inPlayEvents.findOne({ _id: mongoose.Types.ObjectId(bet.betData.matchId) }, { Id: 1 });

      if (bet.betData.type == 2) {
        var correctScore;
        if (bet.score == -1) {
          await handleDrawBet(bet.betData);
          correctScore = -1;
        } else {
          correctScore = bet.score % 10;
          if (bet.betData.runner == correctScore) {
            //console.log("0 ----- winner ");
            await handleWinningBet(bet.betData);
          } else {
            //console.log("0 ----- looser ");
            await handleLosingBet(bet.betData);
          }
        }

        if (event) {
          await MarketIDs.findOneAndUpdate(
            {
              eventId: event.Id,
              marketId: 'Session ' + bet.betData.betSession + ' Betting Figures'
            },
            {
              eventId: event.Id,
              marketId: 'Session ' + bet.betData.betSession + ' Betting Figures',
              marketName: 'Session ' + bet.betData.betSession + ' Betting Figures',
              sportID: -1,
              status: 'Session Result',
              winnerInfo: correctScore,
              index: 0
            },
            {
              new: true,
              upsert: true
            }
          );
        }
      }

      //jotta kali
      if (bet.betData.type === 3) {
        var correctScore;
        if (bet.score == -1) {
          await handleDrawBet(bet.betData);
          correctScore = -1;
        } else {
          correctScore = bet.score % 2;
          if (bet.betData.runnerName == 'JOTTA' && correctScore == 0) {
            //console.log("0 ----- winner ");
            await handleWinningBet(bet.betData);
          } else if (bet.betData.runnerName == 'KALI' && correctScore == 1) {
            //console.log("0 ----- winner ");
            await handleWinningBet(bet.betData);
          } else {
            //console.log("0 ----- looser ");
            await handleLosingBet(bet.betData);
          }
        }

        if (event) {
          await MarketIDs.findOneAndUpdate(
            {
              eventId: event.Id,
              marketId: 'Session ' + bet.betData.betSession + ' JOTTA KALI'
            },
            {
              eventId: event.Id,
              marketId: 'Session ' + bet.betData.betSession + ' JOTTA KALI',
              marketName: 'Session ' + bet.betData.betSession + ' JOTTA KALI',
              sportID: -1,
              status: 'Session Result',
              winnerInfo: correctScore,
              index: 0
            },
            {
              new: true,
              upsert: true
            }
          );
        }
      }
      /// Chota bara
      if (bet.betData.type === 4) {
        var correctScore;
        if (bet.score == -1) {
          await handleDrawBet(bet.betData);
          correctScore = -1;
        } else {
          correctScore = bet.score % 10;
          if (bet.betData.runnerName == 'BARA' && correctScore == 0) {
            //console.log("0 ----- winner ");
            await handleWinningBet(bet.betData);
          } else if (bet.betData.runnerName == 'CHOTA' && correctScore < 6 && correctScore > 0) {
            //console.log("0 ----- winner ");
            await handleWinningBet(bet.betData);
          } else if (bet.betData.runnerName == 'BARA' && correctScore > 5) {
            //console.log("0 ----- winner ");
            await handleWinningBet(bet.betData);
          } else {
            //console.log("0 ----- looser ");
            await handleLosingBet(bet.betData);
          }
        }

        await MarketIDs.findOneAndUpdate(
          {
            eventId: event.Id,
            marketId: 'Session ' + bet.betData.betSession + ' CHOTA BARA'
          },
          {
            eventId: event.Id,
            marketId: 'Session ' + bet.betData.betSession + ' CHOTA BARA',
            marketName: 'Session ' + bet.betData.betSession + ' CHOTA BARA',
            sportID: -1,
            status: 'Session Result',
            winnerInfo: correctScore,
            index: 0
          },
          {
            new: true,
            upsert: true
          }
        );
      }
    }
  }
}
