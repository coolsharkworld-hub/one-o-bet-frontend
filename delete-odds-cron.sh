#!/bin/bash

mongosh "mongodb://localhost:27017/Bet99" --eval 'db.raceodds.deleteMany({ createdAt: { $lt: new Date().getTime() - 20 * 60 * 1000 } })'

mongosh "mongodb://localhost:27017/Bet99" --eval 'db.odds.deleteMany({ createdAt: { $lt: new Date().getTime() - 20 * 60 * 1000 } })'

mongosh "mongodb://localhost:27017/Bet99" --eval 'db.fancyodds.deleteMany({ created: { $lt: new ISODate(new Date(new Date().getTime() - 20 * 60 * 1000).toISOString()) }  })'