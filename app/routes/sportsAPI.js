const express = require('express');
let config = require('config');
const axios = require('axios');
const ListCompetitions = require('../models/listCompetitions');
const Event = require('../models/eventsBySport');
const ListMarket = require('../models/listMarkets');
const Odds = require('../models/odds');
const inPlayEvents = require('../models/events');
const rateLimit = require('express-rate-limit');
const fancyGames = require('../models/fancyGames')


const loginRouter = express.Router();

async function listCompetitions(req, res) {
  const sportId = req.params.sportId;
  const url = `${config.sportsAPIUrl}/listCompetitions/${sportId}`;

  try {
    const response = await axios.get(url);
    const competitionData = response.data;

    // Create an array to store the created Competition documents
    const competitions = [];

    // Iterate over the competitionData array and create a new Competition document for each competition
    for (const data of competitionData) {
      const existingCompetition = await ListCompetitions.findOne({
        Id: data.Id,
        sportsId: sportId,
      });

      if (existingCompetition) {
        competitions.push(existingCompetition);
      } else {
        const competition = new ListCompetitions({
          Id: data.Id,
          Name: data.Name,
          sportsId: sportId,
        });

        // Save the document to the database
        await competition.save();

        competitions.push(competition);
      }
    }

    res.status(200).json({
      success: true,
      message: 'Competitions retrieved and saved successfully',
      competitions: competitions,
    });
  } catch (error) {
    console.error(error);
    res.status(200).json({
      success: false,
      message: 'Failed to retrieve and save competitions',
      error: error.message,
    });
  }
}

async function listEventsBySport(req, res) {
  const sportId = req.params.sportId;

  try {
    const response = await axios.get(
      `${config.sportsAPIUrl}/listEventsBySport/${sportId}`
    );
    //console.log('response', response.data);
    const eventsData = response.data;
    const events = [];

    for (const eventData of eventsData) {
      const filter = { Id: eventData.Id, sportsId: sportId,  type: 2 };
      const update = {
        $setOnInsert: {
          sport: eventData.sport,
          competitionId: eventData.competitionId,
          competitionName: eventData.competitionName,
          Id: eventData.Id,
          name: eventData.name,
          countryCode: eventData.countryCode,
          timezone: eventData.timezone,
          openDate: new Date(eventData.openDate),
          inplay: eventData.inplay,
          hasFancy: eventData.hasFancy,
          status: eventData.status,
          isPremium: eventData.isPremium,
          sportsId: sportId,
          type: 2
        },
      };

      const options = { upsert: true, new: true };

      const updatedEvent = await inPlayEvents.findOneAndUpdate(
        filter,
        update,
        options
      );
      events.push(updatedEvent);
    }

    if (res) {
      res.json({
        success: true,
        message: 'Events retrieved successfully',
        events: events,
      });
    }
  } catch (error) {
    console.error(error);
    if (res) {
      res.json({
        success: false,
        message: 'Failed to get events',
        error: error.message,
      });
    }
  }
}


//Id is eventId
async function listEventsByCompetition(req, res) {
  const { sportId, competId } = req.params;
  const url = `${config.sportsAPIUrl}/listEventsByCompetition/${sportId}/${competId}`;

  try {
    const response = await axios.get(url);
    const events = response.data;
    const { errorCode, errorDescription } = response.data;

    if (errorCode === 1 && errorDescription === 'No data found') {
      throw new Error('No events found');
    }
    const savedEvents = [];

    for (const event of events) {
      const filter = { sportsId: sportId, Id: event.Id, type: "eventsByCompetitions" };
      const update = { $set: { sportsId: sportId, type: "eventsByCompetitions" }, ...event };
      const options = { upsert: true, new: true };

      const savedEvent = await Event.findOneAndUpdate(
        filter,
        update,
        options
      );
      savedEvents.push(savedEvent);
    }

    res.status(200).json({
      success: true,
      message: 'Events retrieved and saved successfully',
      events: savedEvents,
    });
  } catch (error) {
    console.error(error);
    res.status(200).json({
      success: false,
      error: error.message,
    });
  }
}

async function listInplayEvents(req, res) {
  const sportsId = req.params.sportsId;
  const url = `${config.sportsAPIUrl}/listInplayEvents/${sportsId}`;

  try {
    const response = await axios.get(url);
    const inplayEvents = response.data;
    // Save the inplayEvents data to the collection
    const savedEvents = [];

    for (const event of inplayEvents) {
      const matchType = getMatchType(event); // Get the match type based on the event
      event['matchType'] = matchType; // Add the matchType field to the event
      const filter = { sportsId: sportsId, Id: event.Id, type: 1 };
      const update = { $set: { sportsId: sportsId, type: 1 }, $setOnInsert: event };
      const options = { upsert: true, new: true };

      const savedEvent = await inPlayEvents.findOneAndUpdate(
        filter,
        update,
        options
      );
      savedEvents.push(savedEvent);
    }

    res.status(200).json({
      success: true,
      message: 'Inplay events retrieved and saved successfully',
      inplayEvents: savedEvents,
    });
  } catch (error) {
    console.error(error);
    res.status(200).json({
      success: false,
      message: 'Failed to get or save inplay events',
      error: error.message,
    });
  }
}

async function getOdds(req, res) {
  // Apply rate limiting middleware to the API
  // limiter(req, res, async () => {
    // marketIds can be more than 20, but only takes the first 20 market IDs in the request:
    const marketIds = req.query.ids
    // .split(',').slice(0, 20);

    try {
      const url = `${config.sportsAPIUrl}/odds/?ids=${marketIds}`;
      const response = await axios.get(url);

      const oddsData = response.data;

      for (const data of oddsData) {

        const market = await ListMarket.findOne({ marketId: data.MarketId });

        if (market) {
          await Odds.findOneAndUpdate(
            { eventId: data.eventId, marketId: data.MarketId },
            {
              $set: {
                updatetime: data.updatetime,
                update: data.update,
                sport: data.sport,
                eventId: data.eventId,
                marketId: data.MarketId,
                marketName: data.marketName,
                source: data.source,
                isMarketDataDelayed: data.IsMarketDataDelayed,
                status: data.Status,
                isInplay: data.IsInplay,
                inplay: data.inplay,
                numberOfRunners: data.NumberOfRunners,
                numberOfActiveRunners: data.NumberOfActiveRunners,
                totalMatched: data.TotalMatched,
                sportsId: market.sportsId,
                runners: data.Runners,
              },
            },
            { upsert: true, new: true }
          );
        }
      }

      res.status(200).json({
        success: true,
        message: 'Odds retrieved and saved successfully',
        odds: oddsData,
      });
    } catch (error) {
      console.error(error);
      res.status(200).json({
        success: false,
        message: 'Failed to get or save odds',
        error: error.message,
      });
    }
  // });
}

async function listMarkets(req, res) {
  const eventId = req.params.eventId;
  const url = `${config.sportsAPIUrl}/listMarkets/${eventId}`;

  try {
    const response = await axios.get(url);
    const marketsData = response.data;
    const markets = [];

    // Get the event details from the eventsByCompetition model
    const eventDetails = await inPlayEvents.find({ Id: eventId });
    for (const marketData of marketsData) {
      const runners = marketData.runners.map((runnerData) => ({
        selectionId: runnerData.selectionId,
        runnerName: runnerData.runnerName,
      }));

      const filter = {
        marketId: marketData.marketId,
        eventId: eventId,
        sportsId: eventDetails[0].sportsId,
      };
      const update = {
        Updatetime: marketData.Updatetime,
        marketName: marketData.marketName,
        totalMatched: marketData.totalMatched,
        status: marketData.status,
        runners: runners,
        eventId: eventId,
        sportsId: eventDetails[0].sportsId
      };
      const options = { upsert: true, new: true };

    //   // Update or create the market in the ListMarket model
      const savedMarket = await ListMarket.findOneAndUpdate(
        filter,
        update,
        options
      );
      markets.push(savedMarket);
    }

    res.status(200).json({
      success: true,
      message: 'Markets retrieved and saved successfully',
      markets: marketsData,
    });
  } catch (error) {
    console.error(error);
    res.status(200).json({
      success: false,
      message: 'Failed to get or save markets',
      error: error.message,
    });
  }
}

async function getnewOdds(ids) {
    try {
      const url = `${config.sportsAPIUrl}/odds/?ids=${ids}`;
      const response = await axios.get(url);
      
      const oddsData = response.data;
      //console.log('data',oddsData);
      let sportIds = {  "soccer" : "1", "cricket" : "4", "tennis" : "2" }
      let data = []
      if(oddsData.length > 0){
        await oddsData?.forEach((element) => {
          if(
            element.Runners[0]?.ExchangePrices.AvailableToLay.length > 0  ||
            element.Runners[0]?.ExchangePrices.AvailableToBack.length > 0  ||
            element.Runners[1]?.ExchangePrices.AvailableToLay.length >0  ||
            element.Runners[1]?.ExchangePrices.AvailableToBack.length >0 ||
            element.Runners[2]?.ExchangePrices.AvailableToLay.length >0  ||
            element.Runners[2]?.ExchangePrices.AvailableToBack.length >0
          ){
            element.sportsId        = sportIds[element.sport]
            element.runners         = element.Runners
            element.marketId        = element.MarketId
            element.isMarketDataDelayed = element.IsMarketDataDelayed
            element.status          = element.Status
            element.isInplay        = element.IsInplay
            element.numberOfRunners = element.NumberOfRunners
            element.numberOfActiveRunners = element.NumberOfActiveRunners
            element.totalMatched    = element.TotalMatched
            element.createdAt       = new Date().getTime()
            data.push(element)
          }
        })
        await Odds.insertMany(data);
      }
      return({
        success: true,
        message: 'Odds retrieved and saved successfully',
        odds: oddsData,
      });
    } catch (error) {
      console.error(error);
      return({
        success: false,
        message: 'Failed to get or save odds',
        error: error.message,
      });
    }
  // });
}

async function eventsBySupportJobs(sportsId) {
  const url = `${config.eventListAPIUrl}/listEventsBySport/${sportsId}`;
  try {
    const response = await axios.get(url);
    const events = response.data;

 
    if(events.length > 0){
      var sportsEventData = events.map((element) => ({
        updateOne: {
          filter: { Id: element.Id },
          update: {
            $set: {
              sportsId: sportsId,
              sport: element.sport,
              competitionId: element.competitionId,
              competitionName: element.competitionName,
              Id: element.Id,
              name: element.name,
              countryCode: element.countryCode,
              timezone: element.timezone,
              openDate: Date.parse(element.openDate),
              inplay: element.inplay,
              hasFancy: element.hasFancy,
              status: element.status,
              isPremium: element.isPremium,
              type: element.type,
              matchType: getMatchType(element.competitionName, element.name, sportsId)
            },
          },
          upsert: true,
        },
      }));
    }

    // 1"obet.com/*"
    const savedEvents = await inPlayEvents.bulkWrite(sportsEventData);
    // //console.log('===== Saved Events bulkWrite logs ', savedEvents?.result?.upserted)
    return({
      success: true,
      message: 'Events retrieved and saved successfully',
      events: events,
      newInsertedIds: savedEvents?.result?.upserted
    });
  } catch (error) {
    console.error(error);
    return({
      success: false,
      message: 'Failed to get or save events',
      error: error.message,
    });
  }
}

async function listMarketsByCronJob(eventId,sport) {
  const url = `${config.sportsAPIUrl}/listMarkets/${eventId}`;
  try {
    const response = await axios.get(url);
    const marketsData = response.data;
     
    if(marketsData.length > 0){
      let marketIds = []
      marketsData.forEach(element => {
          marketIds.push(element.marketId)
      });
  
      const savedMarketInEvents = await inPlayEvents.findOneAndUpdate(
        { Id : eventId },
        { marketIds: marketIds  },
        { upsert: true , new: true }
      );
  
      return({
        success: true,
        message: 'Markets retrieved and saved successfully',
        savedMarketInEvents,
      });
    }
  } catch (error) {
    console.error(error);
    return({
      success: false,
      message: 'Failed to get or save markets',
      error: error.message,
    });
  }
}

async function fancyDataByCronjob(eventId) {
  const url = `${config.fancyUrl}/bm_fancy/${eventId}`;
  //console.log('url', url);
  try {
    const response = await axios.get(url);
    const fancyData = response?.data;
   // Create a new fancyData document
  const  newData = {
    t1: fancyData?.data?.t1,
    t2: fancyData?.data?.t2,
    t3: fancyData?.data?.t3,
    t4: fancyData?.data?.t4,
    success: fancyData?.success,
    status: fancyData?.status,
    updatetime: fancyData?.updatetime,
    eventTypeId: fancyData?.eventTypeId,
    eventTypeName: fancyData?.eventTypeName,
    eventName: fancyData?.eventName,
    name: fancyData?.name,
    eventdate: fancyData?.eventdate,
    gameId: fancyData?.gameId,
    eventId: eventId,
    createdAt: new Date().getTime()
  };

      await fancyGames.create(newData)
      return({
        success: true,
        message: 'Fancy data saved successfully',
        fancyData: newData,
      });
  } catch (error) {
    console.error(error);
    return({
      success: false,
      message: 'Failed to save fancy data1',
      error: error.message,
    });
  }
}

// this method used regex to get the matchType from competitionName 
function getMatchType(competitionName, name, sportsId) {
  const keywords = /(T20|twenty20|Twenty20|twenty 20|Twenty 20|ODI|One Day|one day|T10|Ten10||ten 10|Ten 10|Test|TEST)/i;
  if (sportsId == '4') {
    const nameMatch = name.match(keywords);
    const competitionNameMatch = competitionName && competitionName.match(keywords);
    let returnMatch = ""
    if (nameMatch){
      returnMatch = nameMatch[0];
    } else if (competitionNameMatch) {
      returnMatch = competitionNameMatch[0];
    }

    if(["ODI", "One Day", "one day"].includes(returnMatch)){
      returnMatch = "ODI"
    }
    else if(["Test", "test"].includes(returnMatch)){
      returnMatch = "TEST"
    }
    else if(["twenty20", "Twenty20", "Twenty 20", "twenty 20"].includes(returnMatch)){
      returnMatch = "T20"
    }
    else if(["T10", "Ten10", "ten 10", "Ten 10"].includes(returnMatch)){
      returnMatch = "T10"
    }
    return returnMatch;
  }
}

loginRouter.get('/listCompetition/:sportId', listCompetitions);
loginRouter.get('/listEventBySport/:sportId', listEventsBySport);
loginRouter.get(
  '/listEventByCompetition/:sportId/:competId',
  listEventsByCompetition
);
loginRouter.get('/listMarket/:eventId', listMarkets);
loginRouter.get('/listInplayEvent/:sportsId', listInplayEvents);
loginRouter.get('/getOdds', getOdds);

module.exports = { loginRouter,getOdds, getnewOdds,eventsBySupportJobs,fancyDataByCronjob, listEventsBySport,listInplayEvents,listEventsByCompetition,listMarketsByCronJob };
