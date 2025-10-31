const RaceMarkets = require('../models/raceMarkets.js');
const Events = require('../models/events.js');
const MarketIDS = require('../models/marketIds.js');

const fetchMarketAndStream = async (sportId, res) => {
   
     
        try {
          let events
          let start
          let end
          const now = new Date();
      
           if (sportId == "7" || sportId == "4339") {
            let startOfDay = new Date(now);
            start = startOfDay.getTime() - 30 * 60 * 1000;
      
            let endOfDay = new Date(now);
            end = endOfDay.getTime() + 23.5 * 60 * 60 * 1000
          }
      
          if (sportId == "7" || sportId == "4339") {
              events = await MarketIDS.aggregate([
                {
                  $match: {
                    sportID: Number(sportId),
                    // CompanySetStatus: "OPEN",
                    $and: [
                      { openDate: { $gte: start } },
                      { openDate: { $lte: end } }
                    ]
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
                          $eq: [{ $type: "$event" }, "array"]
                        },
                        then: { $arrayElemAt: ["$event", 0] },
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
                    Id: { $first: "$eventId" },
                    marketIds: { $push: "$marketId" },
                    sportsId: { $first: "$sportID" },
                    openDate: { $first: "$openDate" },
                    openDate2: { $first: "$event.openDate" },
                    status: { $first: "$status" },
                    inPlay: { $first: "$inPlay" },
                    countryCode: { $first: "$event.countryCode" },
                    venue: { $first: "$event.venue" },
                    inplay2: { $first: "$event.inplay" },
                    matchId: { $first: "$event._id" },
                  }
                },
                {
                  $sort: {
                    openDate: 1
                  }
                }
              ])
      
              // events = await Events.find({
              //   sportsId: sportId,
              //   status: "OPEN",
              //   openDate: { $gte: startOfDay, $lt: endOfDay }
              // }).sort({ openDate: 1 });
            } 
          
          res.status(200).json({
            success: true,
            message: "Event By Sports Records",
            results: events,
          });
        } catch (error) {
          console.error(error);
          res.status(200).json({
            success: false,
            message: "Failed to get events",
            error: error.message,
          });
        }
      
};

const horseRaceStreaming = async (req, res) => {
    await fetchMarketAndStream("7", res); // Assuming sportId 7 for horse racing
};

const greyhoundRaceStreaming = async (req, res) => {
    await fetchMarketAndStream("4339", res); // Assuming sportId 4339 for greyhound racing
};

module.exports =    { horseRaceStreaming, greyhoundRaceStreaming }