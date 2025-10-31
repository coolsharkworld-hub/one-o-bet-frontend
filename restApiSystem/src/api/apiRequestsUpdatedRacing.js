'use strict';
module.exports = apiRequests;

const axios = require('axios')
const moment = require('moment')
const config = require("../../../config/default.json")

const Racing = require('../../../app/models/racing')
const raceMarkets = require('../../../app/models/raceMarkets')
const RaceOdds = require('../../../app/models/raceOdds')
const MarketIDS = require('../../../app/models/marketIds')
const InPlayEvents = require("../../../app/models/events")

const _ = require('lodash');
const { isObjectEqual } = require("../../../helper/common");

const RacingStatusMap = new Map()
const RacingOddsMap = new Map()

const header = {
  headers: {
    'accept': 'application/json',
    'Content-Type': 'application/json',
    'X-App': process.env.XAPP_NAME
  },
}

const eventListByMarketIds = async (sportId) => {
  try {
    const events = await MarketIDS.aggregate([
      {
        $match: {
          sportID: Number(sportId),
          inplay: true
        },
      },
      {
        $lookup: {
          from: "inplayevents",
          localField: "eventId",
          foreignField: "Id",
          as: "event",
        },
      },
      {
        $addFields: {
          event: {
            $cond: {
              if: {
                $eq: [{$type: "$event"}, "array"]
              },
              then: {$arrayElemAt: ["$event", 0]},
              else: "$event"
            }
          }
        }
      },
      {
        $match: {
          "event.CompanySetStatus": "OPEN",
          "event.status": "OPEN",
        }
      },
      {
        $group: {
          _id: "$_id",
          Id: {$first: "$eventId"},
          marketIds: {$push: "$marketId"},
          sportsId: {$first: "$sportID"},
          openDate: {$first: "$openDate"},
          openDate2: {$first: "$event.openDate"},
          status: {$first: "$status"},
          inPlay: {$first: "$inPlay"},
          countryCode: {$first: "$event.countryCode"},
          venue: {$first: "$event.venue"},
          inplay2: {$first: "$event.inplay"},
          matchId: {$first: "$event._id"},
        }
      },
      {
        $sort: {
          openDate: 1
        }
      },
      {
        $project: {
          marketId: {$first: "$marketIds"}
        }
      }
    ])

    let marketIdsResult = [];

    for (let i = 0; i < events?.length; i++) {
      marketIdsResult.push(events[i].marketId)
    }

    return marketIdsResult
    // const documents = await MarketIDS.aggregate([
    //   {
    //     $match: {
    //       inPlay: inPlay,
    //       $or: [
    //         { sportsId: 7 },
    //         { sportsId: 4339 },
    //       ],
    //     },
    //   },
    //   {
    //     $sort: { lastCheck: 1 },
    //   },
    //   {
    //     $limit: 30,
    //   },
    // ]).exec();

    // let marketIds = [];

    // if (documents.length > 0) {
    //   documents.forEach(element => {
    //     marketIds.push(element.marketId);
    //   });
    // }

    // return marketIds
  } catch (error) {
    //console.log(`Error ${error}`);
    return {error: `Something went wrong ${error}`};
  }
}

let io;

const getRaceMarketIds = async (sportsId) => {
  const now = moment().utc(); // Get the current time in UTC
  const startTime = moment(now).subtract(30, 'minutes').valueOf(); // Get the timestamp in milliseconds
  const endTime = moment(now).add(50, 'minutes').valueOf(); // Add 5 hours and get the timestamp in milliseconds

  const documents = await MarketIDS.aggregate([
    {
      $match: {
        sportID: Number(sportsId),
        status: {$in: ['INACTIVE', 'OPEN', 'SUSPENDED']},
        openDate: {
          $gte: startTime,
          $lte: endTime
        }
      },
    },
    {
      $lookup: {
        from: "inplayevents",
        localField: "eventId",
        foreignField: "Id",
        as: "event",
      },
    },
    {
      $addFields: {
        event: {
          $cond: {
            if: {
              $eq: [{$type: "$event"}, "array"]
            },
            then: {$arrayElemAt: ["$event", 0]},
            else: "$event"
          }
        }
      }
    },
    {
      $match: {
        "event.CompanySetStatus": "OPEN",
        "event.status": "OPEN",
      }
    },
    {
      $sort: {lastCheck: 1},
    },
    {
      $limit: 30,
    }
  ]).exec();

  let marketIds = [];

  if (documents.length > 0) {
    documents.forEach(element => {
      marketIds.push(element.marketId);
    });
  }

  return marketIds;
}

function apiRequests() {

  return {init, checkOdds, listMarketsByCronJob, eventsBySupportJobs, raceOddsJob};

  function init(_io, express) {
    io = _io
    io.on('connection', onConnect);
  }

  function onConnect(socket) {
    socket.on("get_id", async (id) => {
      const eventInfo = await InPlayEvents.findOne({Id: id + ''}, {_id: 1});

      if (eventInfo) {
        socket.emit('event_id_db', eventInfo);
      } else {
        // //console.log(eventInfo, id);
      }
    });

    socket.on("join", async (channel) => {

      if (!channel) {
        return socket.emit('err', 'Channel Required');
      }

      if (channel.length == 0) {
        return socket.emit('err', 'Channel Required');
      }
      if (channel.charAt(0) == '$') {
        let event_information = await raceMarkets.findOne({marketId: channel.substring(1)});

        if (event_information) {
          const LastRaceOdds = await RaceOdds.findOne({marketId: channel.substring(1)});

          let responseData = {
            eventTypeId: event_information?.eventTypeId,
            marketId: event_information?.marketId,
            eventNodes: [
              {
                eventId: event_information?.eventNodes[0]?.eventId,
                event: event_information?.eventNodes[0]?.event,
                marketNodes: {
                  marketId: event_information?.eventNodes[0]?.marketNodes?.marketId,
                  state: event_information?.eventNodes[0]?.marketNodes?.state,
                  description: event_information?.eventNodes[0]?.marketNodes?.description,
                  runners: event_information?.eventNodes[0]?.marketNodes?.runners,
                  odds: LastRaceOdds?.runners
                }
              }
            ]
          }
          if (LastRaceOdds) {
            socket.emit('race_last_odds', LastRaceOdds);
          } else {
            socket.emit('race_last_odds', {status: false, msg: 'LastRaceOdds record is not exist for this event.'});
          }

          socket.emit('race_event_info', responseData);
        } else {
          socket.emit('race_err', 'InPlayEvents Not Exist');
        }
      }
    });
  }

  /**++++++++++++++++++ new added code ( Inplayevents ) +++++++++++++++++++++++++**/
  async function eventsBySupportJobs(sportsId) {
    function isValidDate(d) {
      return new Date(d).toString() !== "Invalid Date";
    }

    const now = moment();
    const startTime = now.format('YYYY-MM-DDTHH:mm:ss[Z]');
    const endTime = moment(now).add(24, 'hours').format('YYYY-MM-DDTHH:mm:ss[Z]');
    const requestData = {
      "filter": {
        "eventTypeIds": [sportsId],
        "marketStartTime": {
          "from": startTime,
          "to": endTime
        }
      },
    }

    let url = `${config.newThirdURL}/listEvents`;

    try {
      const response = await axios.post(
        url,
        requestData,
        header
      );

      let events = response.data.result;
      if (events.length > 0) {
        events = events.filter(function (item) {
          return isValidDate(item.event.openDate);
        });

        for (let k = 0; k < (events?.length > config.raceEventsAllowedCount ? config.raceEventsAllowedCount : events?.length); k++) {
          const existingDoc = await InPlayEvents.findOne({Id: events[k].event.id});

          if (existingDoc && existingDoc.isCanceled === true) {
            continue;
          }

          // if (existingDoc && existingDoc.inplayFromServer != events[k].event.inplay) {
          //   // //console.log(existingDoc);
          //   // //console.log(event.inplay);
          // }

          await InPlayEvents.findOneAndUpdate(
            {Id: events[k].event.id},
            {
              $set: {
                sportsId: sportsId,
                Id: events[k].event.id,
                name: events[k].event.name,
                countryCode: events[k].event.countryCode,
                timezone: events[k].event.timezone,
                openDate: Date.parse((events[k].event.openDate)),
                inplayFromServer: false,
                hasFancy: true,
                // isShowed: true,
                status: 'OPEN',
                isPremium: false,
                type: events[k].event.type,
                matchTypeProvider: getMatchType(
                  // event.event.competitionName,
                  events[k].event.name,
                  sportsId
                ),
              },
            },
            {
              upsert: true,
            }
          );
        }

        let eventIDs = [];

        for (let index = 0; index < events.length; index++) {
          eventIDs.push(events[index].event.id);
        }

        let allIDS = [];
        const currentEvents = await InPlayEvents.find(
          {status: 'OPEN', sportsId: sportsId + ""},
          {Id: 1}
        );

        for (let i = 0; i < currentEvents.length; i++) {
          allIDS.push(currentEvents[i].Id);
        }

        let diff = allIDS.filter((item) => !eventIDs.includes(item));

        for (let i = 0; i < diff.length; i++) {
          //console.log(`Event is closed because it not exists on listEventsBySport: ${diff[i]}`);
          await MarketIDS.updateMany(
            {eventId: diff[i]},
            {$set: {inPlay: false, status: 'CLOSED', readyForScore: true}}
          );
          await InPlayEvents.updateOne(
            {Id: diff[i]},
            {
              $set: {
                status: 'CLOSED-EVENTLIST',
                inplay: false,
                inplayFromServer: false,
                readyForScore: true,
              },
            }
          );
          io.emit("inplay", {eventID: diff[i], inplay: false});
          io.to("eventStatusChange").emit("event_status", {
            eventId: diff[i],
            status: 'CLOSED-EVENTLIST',
          });
        }

        return {
          success: true,
          message: "Events retrieved and saved successfully",
          events: events,
        };
      } else {
        return {
          success: false,
          message: "Events empty",
        };
      }
    } catch (error) {
      //console.log("Problem on taking event list");
      // console.error(error);
      return {
        success: false,
        message: "Failed to get or save events",
        error: error.message,
      };
    }
  }

  /**++++++++++++++++++ new added code ( racemarkets collection ) +++++++++++++++++++++++++**/
  async function listMarketsByCronJob(eventId, sportsId, competitionId) {

    try {
      // const now = moment();
      // const startTime = now.format('YYYY-MM-DDTHH:mm:ss[Z]');
      // const endTime = now.add(5, 'hours').format('YYYY-MM-DDTHH:mm:ss[Z]');
      const requestData = {
        "filter": {
          "eventIds": [eventId],
          "eventTypeIds": [sportsId],
          "marketTypes": ['WIN'],
          // "marketStartTime": {
          //   "from": startTime,
          //   "to": endTime
          // }
        },
        "maxResults": 100,
        "marketProjection": ["EVENT", "EVENT_TYPE", "MARKET_START_TIME", "MARKET_DESCRIPTION", "RUNNER_DESCRIPTION", "RUNNER_METADATA"]
      }
      //console.log("eventId to fetch markets for: ", eventId);
      const url = `${config.newThirdURL}/listMarketCatalogue`;
      let response = await axios.post(
        url,
        requestData,
        header
      );

      const eventsData = response.data.result;
      let marketIds = [];
      // Create an instance of the raceMarkets model
      for (let j = 0; j < eventsData.length; j++) {
        if (eventsData[j]?.description?.marketType === "WIN") {
        // if (eventsData[j]?.description?.marketType) {
          marketIds.push(eventsData[j].marketId);
          await raceMarkets.findOneAndUpdate(
            {
              marketId: eventsData[j].marketId,
              eventTypeId: eventsData[j].eventType.id,
              "eventNodes.eventId": eventsData[j].event.id,
              "eventNodes.event.eventName": eventsData[j].event.name,
              "eventNodes.event.countryCode": eventsData[j].event.countryCode,
            },
            {
              $set: {
                marketId: eventsData[j].marketId,
                eventTypeId: eventsData[j].eventType.id,
                eventNodes: {
                  eventId: eventsData[j].event.id,
                  event: {
                    eventName: eventsData[j].event.name,
                    countryCode: eventsData[j].event.countryCode,
                    timezone: eventsData[j].event.timezone,
                    venue: eventsData[j].event.venue,
                    openDate: new Date(eventsData[j].event.openDate)
                  },
                  marketNodes: {
                    marketId: eventsData[j].marketId,
                    state: {
                      startTime: new Date(eventsData[j].marketStartTime),
                      numberOfRunners: eventsData[j].runners?.length,
                      totalMatched: eventsData[j].totalMatched,
                      status: "PENDING"
                    },
                    description: {
                      marketName: eventsData[j].marketName,
                      marketTime: new Date(eventsData[j].marketStartTime),
                    },
                    runners: eventsData[j].runners.map(runner => ({
                      selectionId: runner.selectionId,
                      handicap: runner.handicap,
                      description: {
                        runnerName: runner.runnerName,
                        metadata: {
                          SIRE_NAME: runner.metadata.SIRE_NAME,
                          CLOTH_NUMBER_ALPHA: runner.metadata.CLOTH_NUMBER_ALPHA,
                          OFFICIAL_RATING: runner.metadata.OFFICIAL_RATING,
                          COLOURS_DESCRIPTION: runner.metadata.COLOURS_DESCRIPTION,
                          COLOURS_FILENAME: runner.metadata.COLOURS_FILENAME,
                          FORECASTPRICE_DENOMINATOR: runner.metadata.FORECASTPRICE_DENOMINATOR,
                          DAMSIRE_NAME: runner.metadata.DAMSIRE_NAME,
                          WEIGHT_VALUE: runner.metadata.WEIGHT_VALUE,
                          SEX_TYPE: runner.metadata.SEX_TYPE,
                          DAYS_SINCE_LAST_RUN: runner.metadata.DAYS_SINCE_LAST_RUN,
                          WEARING: runner.metadata.WEARING,
                          OWNER_NAME: runner.metadata.OWNER_NAME,
                          DAM_YEAR_BORN: runner.metadata.DAM_YEAR_BORN,
                          SIRE_BRED: runner.metadata.SIRE_BRED,
                          JOCKEY_NAME: runner.metadata.JOCKEY_NAME,
                          DAM_BRED: runner.metadata.DAM_BRED,
                          ADJUSTED_RATING: runner.metadata.ADJUSTED_RATING,
                          runnerId: runner.metadata.runnerId,
                          CLOTH_NUMBER: runner.metadata.CLOTH_NUMBER,
                          SIRE_YEAR_BORN: runner.metadata.SIRE_YEAR_BORN,
                          TRAINER_NAME: runner.metadata.TRAINER_NAME,
                          COLOUR_TYPE: runner.metadata.COLOUR_TYPE,
                          AGE: runner.metadata.AGE,
                          DAMSIRE_BRED: runner.metadata.DAMSIRE_BRED,
                          JOCKEY_CLAIM: runner.metadata.JOCKEY_CLAIM,
                          FORM: runner.metadata.FORM,
                          FORECASTPRICE_NUMERATOR: runner.metadata.FORECASTPRICE_NUMERATOR,
                          BRED: runner.metadata.BRED,
                          DAM_NAME: runner.metadata.DAM_NAME,
                          DAMSIRE_YEAR_BORN: runner.metadata.DAMSIRE_YEAR_BORN,
                          STALL_DRAW: runner.metadata.STALL_DRAW,
                          WEIGHT_UNITS: runner.metadata.WEIGHT_UNITS,
                        },
                      },
                      state: {
                        sortPriority: runner.sortPriority,
                      },
                    })),
                  },
                },
              }
            }, {upsert: true, new: true}
          );
          let runners = [];
          for (let ix1 = 0; ix1 < eventsData[j].runners.length; ix1++) {
            const runner = eventsData[j].runners[ix1];
            runners.push({SelectionId: runner.selectionId, runnerName: runner.runnerName});
          }
          await MarketIDS.findOneAndUpdate(
            {
              marketId: eventsData[j].marketId,
              sportID: eventsData[j].eventType.id,
              eventId: eventId,
            },
            {
              $set: {
                runners: runners,
                marketName: eventsData[j].marketName,
                marketType: eventsData[j]?.description?.marketType,
                status: 'OPEN',
                openDate: Date.parse(eventsData[j].marketStartTime)
              }
            }, {upsert: true, new: true});
        }
      }

      await InPlayEvents.findOneAndUpdate(
        {Id: eventId},
        {$set: {marketIds: marketIds}},
        {upsert: true, new: true});
    } catch (error) {
      console.error('Market data Problem', error);
    }
  }

  /**++++++++++++++++++ new added code ( racemarkets collection ) +++++++++++++++++++++++++**/
  async function raceOddsJob(marketIds) {
    try {
      const requestData = {
        "marketIds": marketIds
      }

      const url = `${config.newThirdURL}/listMarketBook`;
      const response = await axios.post(url, requestData, header);
      const oddsData = response.data.result;
      //console.log("Odds Data ----------->", oddsData?.length)

      let responsedMarketIDs = [];
      let marketIds_index = 0;
      let numberOfVisits = 0;
      if (oddsData.length > 0) {
        for (const odds of oddsData) {
          numberOfVisits++;

          if (odds) {
            odds.createdAt = new Date().getTime()

            let tempRunners = [];
            for (let n = 0; n < odds.runners?.length; n++) {
              let tempElement = {
                selectionId: odds?.runners[n]?.selectionId,
                handicap: odds?.runners[n]?.handicap,
                state: {
                  status: odds.runners[n]?.status,
                  lastPriceTraded: odds.runners[n]?.lastPriceTraded,
                  totalMatched: odds.runners[n]?.totalMatched,
                },
                exchange: {
                  availableToBack: [
                    {
                      price: odds.runners[n]?.ex.availableToBack[0]?.price,
                      size: odds.runners[n]?.ex.availableToBack[0]?.size
                    },
                    {
                      price: odds.runners[n]?.ex.availableToBack[1]?.price,
                      size: odds.runners[n]?.ex.availableToBack[1]?.size
                    },
                    {
                      price: odds.runners[n]?.ex.availableToBack[2]?.price,
                      size: odds.runners[n]?.ex.availableToBack[2]?.size
                    },
                  ],
                  availableToLay: [
                    {
                      price: odds.runners[n]?.ex.availableToLay[0]?.price,
                      size: odds.runners[n]?.ex.availableToLay[0]?.size
                    },
                    {
                      price: odds.runners[n]?.ex.availableToLay[1]?.price,
                      size: odds.runners[n]?.ex.availableToLay[1]?.size
                    },
                    {
                      price: odds.runners[n]?.ex.availableToLay[2]?.price,
                      size: odds.runners[n]?.ex.availableToLay[2]?.size
                    },
                  ]
                }
              }

              tempRunners.push(tempElement)
            }
            let isMarketDataDelayed = false;

            let json = {
              marketId: odds.marketId,
              isMarketDataDelayed: isMarketDataDelayed,
              state: {
                numberOfRunners: tempRunners?.length,
                totalMatched: odds?.totalMatched,
                inplay: odds?.inplay,
                status: odds?.status
              },
              runners: tempRunners,
              createdAt: new Date().getTime(),
            }
            let frontOdds = {
              marketId: odds.marketId,
              isMarketDataDelayed: isMarketDataDelayed,
              state: {
                numberOfRunners: tempRunners?.length,
                totalMatched: odds?.totalMatched,
                inplay: odds?.inplay,
                status: odds?.status
              },
              runners: tempRunners,
            }
            const marketId = odds.marketId
            if (!RacingOddsMap.has(marketId) || !isObjectEqual(RacingOddsMap.get(marketId), frontOdds)) {
              RacingOddsMap.set(marketId, frontOdds)
              if (typeof odds.status === 'undefined' || odds.status !== 'OPEN') {
                //console.log(odds.marketId, " this market has no odds.....");
                if (odds.status === 'CLOSED') {
                  await MarketIDS.updateOne({marketId: odds.marketId}, {$set: {status: odds.status, readyForScore: true}});
                }
                if (odds.marketId) {
                  io.emit('racing_status', {status: odds.status, marketId: odds.marketId});
                  io.to('$' + odds.marketId).emit('odds', json);
                }
              } else {
                //console.log(odds.marketId, " This market has odds found");

                const result = await RaceOdds.collection.insertOne(json);
                odds._id = result.insertedId;

                io.to('$' + odds.marketId).emit('odds', json);
              }
            }

            responsedMarketIDs.push(odds.marketId);
          } else {
            //console.log(marketIds[marketIds_index], " HAS no odds.");
          }
          marketIds_index++;
          //console.log("VISIT NO: ", numberOfVisits);
        }
      } else {
        //console.log("I am closing marketId: ", marketIds);
        //let difference = marketIds.filter(x => !responsedMarketIDs.includes(x));
        // for (let i = 0; i < events.length; i++) {
        // //console.log(events[i].eventId, 'CLOSED 2');
        //await InPlayEvents.findOneAndUpdate({Id: event.eventId}, {$set: {status: 'CLOSED..', readyForScore: true}});
        //await MarketIDS.updateOne({marketId: marketIds}, {$set: {status: 'CLOSED',readyForScore: true}});
        //await MarketIDS.updateMany({marketId:{$in:madifferencerketIds}},{$set:{status:'PENDING'}})
        // }
      }

      let difference = marketIds.filter(x => !responsedMarketIDs.includes(x));
      for (let j = 0; j < difference?.length; j++) {
        await MarketIDS.updateOne({marketId: difference[j]}, {$set: {status: 'CLOSED'}})
        io.emit('racing_status', {status: "CLOSED", marketId: difference[j]});
        // const existedMarket = await MarketIDS.findOne({marketId: difference[j], status: "CLOSED"})
        // if (!existedMarket?._id) {
        //   await MarketIDS.updateOne({marketId: difference[j]}, {$set: {status: 'PENDING'}})
        // }
      }

      return ({
        success: true,
        message: 'Odds Records',
      });
    } catch (error) {
      console.error(error);
      return ({
        success: false,
        message: 'Error retrieving Records',
      });
    }
  }

  async function checkOddsOld() {
    const sportsIds = [4339, 7];

    for (let index = 0; index < sportsIds.length; index++) {
      ////console.log("sportsIds[index]-------",sportsIds[index]);
      let events = await InPlayEvents.find({
        sportsId: sportsIds[index] + '',
        status: 'OPEN',
        CompanySetStatus: 'OPEN'
      }).sort({openDate: 1}).limit(20).exec();

      if (events.length) {
        const checkOther = await InPlayEvents.findOne({
          status: 'WAITING',
          sportsId: `${sportsIds[index]}`
        }).sort({openDate: 1});
        if (checkOther && checkOther.openDate < events[0].openDate) {
          await InPlayEvents.updateMany({status: 'OPEN', sportsId: `${sportsIds[index]}`}, {status: 'WAITING'});
          //console.log('Old event found. All OPEN events status changed with WAITING');
          return checkOdds();
        }
      }

      if (events.length !== 20) {
        //console.log("!=20 length.....");
        const documents = await InPlayEvents.find({status: 'WAITING', sportsId: sportsIds[index] + ''})
          .sort({openDate: 1})
          .limit(20 - events.length)
          .select('_id');

        const documentIds = documents.map(doc => doc._id);
        await InPlayEvents.updateMany({_id: {$in: documentIds}}, {status: 'OPEN'});
        events = await InPlayEvents.find({
          sportsId: sportsIds[index] + '',
          status: 'OPEN',
          CompanySetStatus: 'OPEN'
        }).sort({openDate: 1}).limit(20).exec();
      }
      //console.log('Beore Zero length...: ', events.length);
      if (events.length === 0) {
        continue;
      }

      const marketIds = await getRaceMarketIds(sportsIds[index]);
      if (marketIds) {
        raceOddsJob(marketIds)
      }
    }
  }

  async function checkOdds() {
    const sportsIds = [4339, 7];

    for (const sportsId of sportsIds) {
      const openEvents = await getSortedEvents(sportsId, 'OPEN', 40);
      const firstEventDate = openEvents.length > 0 ? openEvents[0].openDate : null;

      if (openEvents.length > 0) {
        const waitingEvent = await getFirstEvent(sportsId, 'WAITING');
        if (waitingEvent && waitingEvent.openDate < firstEventDate) {
          await updateEventStatus(sportsId, 'OPEN', 'WAITING');
          //console.log('Old event found. All OPEN events status changed to WAITING');
          return checkOdds();
        }
      }

      // if (openEvents.length !== 20) {
      //   await fillEventsToLimit(sportsId, openEvents.length);
      // }

      if (openEvents.length === 0) continue;

      const marketIds = await getRaceMarketIds(sportsId);
      if (marketIds) {
        raceOddsJob(marketIds);
      }
    }
  }

  async function getSortedEvents(sportsId, status, limit) {
    return InPlayEvents.find({sportsId: `${sportsId}`, status, CompanySetStatus: 'OPEN'})
      .sort({openDate: 1})
      .limit(limit)
      .exec();
  }

  async function getFirstEvent(sportsId, status) {
    return InPlayEvents.findOne({sportsId: `${sportsId}`, status})
      .sort({openDate: 1});
  }

  async function updateEventStatus(sportsId, currentStatus, newStatus) {
    return InPlayEvents.updateMany({status: currentStatus, sportsId: `${sportsId}`}, {status: newStatus});
  }

  async function fillEventsToLimit(sportsId, currentLength) {
    //console.log("!=20 length.....");
    const documents = await InPlayEvents.find({status: 'WAITING', sportsId: `${sportsId}`})
      .sort({openDate: 1})
      .limit(20 - currentLength)
      .select('_id');

    const documentIds = documents.map(doc => doc._id);
    await InPlayEvents.updateMany({_id: {$in: documentIds}}, {status: 'OPEN'});
  }

}

function getMatchType(
  // competitionName,
  name,
  sportsId
) {
  const keywords =
    /(T20|twenty20|Twenty20|twenty 20|Twenty 20|ODI|One Day|one day|T10|Ten10||ten 10|Ten 10|Test|TEST)/i;
  if (sportsId == "4") {
    const nameMatch = name.match(keywords);
    // const competitionNameMatch =
    //   competitionName && competitionName.match(keywords);
    let returnMatch = "";
    if (nameMatch) {
      returnMatch = nameMatch[0];
    }
    // else if (competitionNameMatch) {
    //   returnMatch = competitionNameMatch[0];
    // }

    if (["ODI", "One Day", "one day"].includes(returnMatch)) {
      returnMatch = "ODI";
    } else if (["Test", "test"].includes(returnMatch)) {
      returnMatch = "TEST";
    } else if (
      ["twenty20", "Twenty20", "Twenty 20", "twenty 20"].includes(returnMatch)
    ) {
      returnMatch = "T20";
    } else if (["T10", "Ten10", "ten 10", "Ten 10"].includes(returnMatch)) {
      returnMatch = "T10";
    }
    return returnMatch;
  }
}