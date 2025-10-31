const express = require('express');
const mongoose = require('mongoose')
const axios = require('axios');
const config = require('config');
const loginRouter = express.Router();
const Racing = require('../models/racing');
const Event = require('../models/events');
const raceMarkets = require('../models/raceMarkets');
const RaceOdds = require('../models/raceOdds')

async function racesTodayMeetings(req, res) {
  const SportsId = req.params.SportsId;
  try {
    const url = `${config.horseRaceUrl}/meetings/today/${SportsId}`;
    const response = await axios.get(url);

    const horseRacesData = response.data;
    //console.log('horseRacesData', horseRacesData);
    
    const bulkOperations = [];
    for (const data of horseRacesData.meetings) {
      data.countryCodes = horseRacesData.countryCodes;
      data.sportsId = SportsId;
      bulkOperations.push({
        updateOne: {
          filter: { meetingId: data.meetingId },
          update: { $setOnInsert: data },
          upsert: true,
        },
      });
    }

    // Perform bulk write operation
    await Racing.bulkWrite(bulkOperations, { ordered: false });

    return res.json({
      success: true,
      message: 'Horse Race Records',
      results: horseRacesData,
    });
  } catch (error) {
    console.error(error);
    return res.status(200).json({
      success: false,
      message: 'Error retrieving Records',
    });
  }
}

async function racesTomorrowMeetings(req, res) {
  const SportsId = req.params.SportsId;
  try {
    const url = `${config.horseRaceUrl}/meetings/tomorrow/${SportsId}`;
    const response = await axios.get(url);

    const horseRacesData = response.data;
    //console.log('horseRacesData', horseRacesData);
    //console.log('meetings', horseRacesData.meetings);
    //console.log('countryCodes', horseRacesData.countryCodes);

    const bulkOperations = [];
    for (const data of horseRacesData.meetings) {
      data.countryCodes = horseRacesData.countryCodes;
      data.sportsId = SportsId;

      bulkOperations.push({
        updateOne: {
          filter: { meetingId: data.meetingId },
          update: { $setOnInsert: data },
          upsert: true,
        },
      });
    }

    // Perform bulk write operation
    await Racing.bulkWrite(bulkOperations, { ordered: false });

    return res.json({
      success: true,
      message: 'Horse Race Records',
      results: horseRacesData,
    });
  } catch (error) {
    console.error(error);
    return res.status(200).json({
      success: false,
      message: 'Error retrieving Records',
    });
  }
}

async function marketDescription(req, res) {
  const marketId = req.params.marketId;
  try {
    const url = `${config.horseRaceUrl}/marketDescription/${marketId}`;
    const response = await axios.get(url);
    const marketListsData = response.data;

    // Extract relevant data from raceMarkets
    const eventTypeData = marketListsData.eventTypes;
    const eventNodeData = eventTypeData.eventNodes;
    const eventData = eventNodeData.event;
    const marketNodeData = eventNodeData.marketNodes;

    // Create an instance of the raceMarkets model
    const eventType = new raceMarkets({
      eventTypeId: eventTypeData.eventTypeId,
      eventNodes: {
        eventId: eventNodeData.eventId,
        event: {
          eventName: eventData.eventName,
          countryCode: eventData.countryCode,
          timezone: eventData.timezone,
          venue: eventData.venue,
          openDate: new Date(eventData.openDate),
        },
        marketNodes: {
          marketId: marketNodeData.marketId,
          isMarketDataDelayed: marketNodeData.isMarketDataDelayed,
          state: {
            betDelay: marketNodeData.state.betDelay,
            startTime: new Date(marketNodeData.state.startTime),
            remainingTime: marketNodeData.state.remainingTime,
            bspReconciled: marketNodeData.state.bspReconciled,
            complete: marketNodeData.state.complete,
            inplay: marketNodeData.state.inplay,
            numberOfWinners: marketNodeData.state.numberOfWinners,
            numberOfRunners: marketNodeData.state.numberOfRunners,
            numberOfActiveRunners: marketNodeData.state.numberOfActiveRunners,
            lastMatchTime: new Date(marketNodeData.state.lastMatchTime),
            totalMatched: marketNodeData.state.totalMatched,
            totalAvailable: marketNodeData.state.totalAvailable,
            crossMatching: marketNodeData.state.crossMatching,
            runnersVoidable: marketNodeData.state.runnersVoidable,
            status: marketNodeData.state.status,
          },
          description: {
            persistenceEnabled: marketNodeData.description.persistenceEnabled,
            bspMarket: marketNodeData.description.bspMarket,
            marketName: marketNodeData.description.marketName,
            marketTime: new Date(marketNodeData.description.marketTime),
            suspendTime: new Date(marketNodeData.description.suspendTime),
            turnInPlayEnabled: marketNodeData.description.turnInPlayEnabled,
            marketType: marketNodeData.description.marketType,
            raceNumber: marketNodeData.description.raceNumber,
            raceType: marketNodeData.description.raceType,
            bettingType: marketNodeData.description.bettingType,
          },
          rates: {
            marketBaseRate: marketNodeData.rates.marketBaseRate,
            discountAllowed: marketNodeData.rates.discountAllowed,
          },
          runners: marketNodeData.runners.map(runner => ({
            selectionId: runner.selectionId,
            handicap: runner.handicap,
            description: {
              runnerName: runner.description.runnerName,
              metadata: {
                SIRE_NAME: runner.description.metadata.SIRE_NAME,
                CLOTH_NUMBER_ALPHA: runner.description.metadata.CLOTH_NUMBER_ALPHA,
                OFFICIAL_RATING: runner.description.metadata.OFFICIAL_RATING,
                COLOURS_DESCRIPTION: runner.description.metadata.COLOURS_DESCRIPTION,
                COLOURS_FILENAME: runner.description.metadata.COLOURS_FILENAME,
                FORECASTPRICE_DENOMINATOR: runner.description.metadata.FORECASTPRICE_DENOMINATOR,
                DAMSIRE_NAME: runner.description.metadata.DAMSIRE_NAME,
                WEIGHT_VALUE: runner.description.metadata.WEIGHT_VALUE,
                SEX_TYPE: runner.description.metadata.SEX_TYPE,
                DAYS_SINCE_LAST_RUN: runner.description.metadata.DAYS_SINCE_LAST_RUN,
                WEARING: runner.description.metadata.WEARING,
                OWNER_NAME: runner.description.metadata.OWNER_NAME,
                DAM_YEAR_BORN: runner.description.metadata.DAM_YEAR_BORN,
                SIRE_BRED: runner.description.metadata.SIRE_BRED,
                JOCKEY_NAME: runner.description.metadata.JOCKEY_NAME,
                DAM_BRED: runner.description.metadata.DAM_BRED,
                ADJUSTED_RATING: runner.description.metadata.ADJUSTED_RATING,
                runnerId: runner.description.metadata.runnerId,
                CLOTH_NUMBER: runner.description.metadata.CLOTH_NUMBER,
                SIRE_YEAR_BORN: runner.description.metadata.SIRE_YEAR_BORN,
                TRAINER_NAME: runner.description.metadata.TRAINER_NAME,
                COLOUR_TYPE: runner.description.metadata.COLOUR_TYPE,
                AGE: runner.description.metadata.AGE,
                DAMSIRE_BRED: runner.description.metadata.DAMSIRE_BRED,
                JOCKEY_CLAIM: runner.description.metadata.JOCKEY_CLAIM,
                FORM: runner.description.metadata.FORM,
                FORECASTPRICE_NUMERATOR: runner.description.metadata.FORECASTPRICE_NUMERATOR,
                BRED: runner.description.metadata.BRED,
                DAM_NAME: runner.description.metadata.DAM_NAME,
                DAMSIRE_YEAR_BORN: runner.description.metadata.DAMSIRE_YEAR_BORN,
                STALL_DRAW: runner.description.metadata.STALL_DRAW,
                WEIGHT_UNITS: runner.description.metadata.WEIGHT_UNITS,
              },
            },
            state: {
              adjustmentFactor: runner.state.adjustmentFactor,
              sortPriority: runner.state.sortPriority,
              lastPriceTraded: runner.state.lastPriceTraded,
              totalMatched: runner.state.totalMatched,
              status: runner.state.status,
            },
          })),
        },
      },
      isMarketDataVirtual: marketListsData.isMarketDataVirtual,
    });

    // Save the EventType instance to the database
    await eventType.save();

    return res.json({
      success: true,
      message: 'Market data saved successfully',
      results: marketListsData,
    });
  } catch (error) {
    console.error(error);
    return res.status(200).json({
      success: false,
      message: 'Error saving market data',
    });
  }
}

async function raceOdds(req, res) {
  const ids = req.query.ids;
  try {

    const url = `${config.horseRaceUrl}/odds/?ids=${ids}`;
    const response = await axios.get(url);

    const oddsData = response.data;
    //console.log('oddsData', oddsData);

    // Insert the oddsData into the RaceOdds model
    const raceOdds = await RaceOdds.insertMany(oddsData);

    return res.json({
      success: true,
      message: 'Odds Records',
      results: raceOdds,
    });
  } catch (error) {
    console.error(error);
    return res.status(200).json({
      success: false,
      message: 'Error retrieving Records',
    });
  }
}

async function todayRaceJob(sportsId) {
  try {
    const url = `${config.horseRaceUrl}/meetings/today/${sportsId}`;
    const response = await axios.get(url);
    const meetings = response.data.meetings;
    let racesBulkOperation = [];
    let races  = [];
    meetings.map((meeting)=>{
      meeting.races.map((race)=>{
        race.name             = race.marketName;
        race.Id               = race.raceId;
        race.marketIds        = [race.marketId];
        race.openDate         = Date.parse(race.startTime);
        race.meetingId        = meeting.meetingId;
        race.meetingName      = meeting.name;
        race.countryCode      = meeting.countryCode;
        race.meetingOpenDate  = meeting.openDate;
        race.venue            = meeting.venue;
        race.meetingGoing     = meeting.meetingGoing;
        race.sportsId         = sportsId;
        races.push(race);
        racesBulkOperation.push({
          updateOne: {
            filter: { Id: race.Id },
            update: { $set: race },
            upsert: true,
          },
        });
      });
    });   
    //console.log(races);
    const res = await Event.bulkWrite(racesBulkOperation);
    return ({
      success: true,
      message: 'Race Records list',
      results: races,
      eventIds:res?.result?.upserted
    });
  } catch (error) {
    console.error(error);
    return {
      success: false,
      message: 'Failed to get or save inplay events',
      error: error.message,
    };
  }
}

async function marketDescriptionCronjob(marketId) {
  try {
    const url = `${config.horseRaceUrl}/marketDescription/${marketId}`;
    const response = await axios.get(url);
    const marketListsData = response.data;
  
     //console.log("marketListsData", marketListsData)
    // Extract relevant data from raceMarkets
    const eventTypeData = marketListsData?.eventTypes;
    const eventNodeData = eventTypeData?.eventNodes;
    const eventData = eventNodeData?.event;
    const marketNodeData = eventNodeData?.marketNodes;

    const bulkOperations = [];

    // Create bulk update or insert operations for market data
    const updateOperation = {
      updateOne: {
        filter: { 'eventNodes.marketNodes.marketId': marketNodeData?.marketId },
        update: {
          $setOnInsert: {
            eventTypeId: eventTypeData?.eventTypeId,
            eventId: eventNodeData?.eventId,
            marketId: marketNodeData?.marketId,
            status: marketNodeData?.state.status,
            eventNodes: {
              eventId: eventNodeData?.eventId,
              event: eventData,
              marketNodes: {
                marketId: marketNodeData?.marketId,
                isMarketDataDelayed: marketNodeData?.isMarketDataDelayed,
                state: marketNodeData?.state,
                description: marketNodeData?.description,
                rates: marketNodeData?.rates,
                runners: marketNodeData?.runners,
              },
            },
            isMarketDataVirtual: marketListsData?.isMarketDataVirtual,
          },
        },
        upsert: true,
      },
    };

    bulkOperations.push(updateOperation);

    // Perform bulk write operation
    await raceMarkets.bulkWrite(bulkOperations, { ordered: false });

    return {
      success: true,
      message: 'Market data saved successfully',
      results: marketListsData,
    };
  } catch (error) {
    console.error(error);
    return {
      success: false,
      message: 'Error saving market data',
    };
  }
}

async function raceOddsJob(ids) {
  try {
   //console.log('race Odds Job --->>>', ids)
    const url = `${config.horseRaceUrl}/odds/?ids=${ids}`;
    const response = await axios.get(url);
    const oddsData = response.data;
    //console.log('oddsData', oddsData);
    let raceOdds
    if(oddsData.length > 0){
      raceOdds = await RaceOdds.insertMany(oddsData);
    }
    return({
      success: true,
      message: 'Odds Records',
      results: raceOdds,
    });
  } catch (error) {
    console.error(error);
    return({
      success: false,
      message: 'Error retrieving Records',
    });
  }
}

loginRouter.get('/racesTodayMeetings/:SportsId', racesTodayMeetings);
loginRouter.get('/racesTomorrowMeetings/:SportsId', racesTomorrowMeetings);
loginRouter.get('/marketDescription/:marketId', marketDescription);
loginRouter.get('/raceOdds', raceOdds);
module.exports = { loginRouter,todayRaceJob,marketDescriptionCronjob,raceOddsJob };
