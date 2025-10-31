const express       = require('express');
const loginRouter   = express.Router();
const axios         = require('axios');
const User          = require('../models/user');
const SportsBooks   = require('../models/sportsBook');

async function getAllSportsBookGamesFromThirdParty(req, res) {
  try {
    const response = await axios.post("https://em-api.thegameprovider.com/api/seamless/provider",{
        "api_login": "1obet_mc_s",
        "api_password": "b16gWs7e0QAASLTne0",
        "method": "getGameList",
        "show_systems": 1,
        "show_additional": true,
        "currency": "PKR"
    });

    const games = response.data.response.map((element) => ({
      updateOne: {
        filter: { id: element.id },
        update: {
          $set: {
            id_hash: element.id_hash,
            name: element.name,
            type: element.type,
            subcategory: element.subcategory,
            category: element.category,
            gameName: element.gamename,
            image_preview: element.image_preview,
            provider_name: element.provider_name
          },
        },
        upsert: true,
      },
    }));

    const SportsBookRes = await SportsBooks.bulkWrite(games);
    return res.send({
      success: true,
      message: 'updated successfully',
    });
  } catch (err) {
      console.error(err);
      res.status(404).send({ message: 'Something went wrong ' });
  }
}

async function sportGamesList(req, res) {
  try {
    const games  = await SportsBooks.find({}).limit(10);
    return res.send({
      success: true,
      message: 'Sports Book Games List',
      results: games
    });
  } catch (err) {
      console.error(err);
      res.status(404).send({ message: 'Something went wrong ' });
  }
}

async function sportsBook(req, res) {
  try {
    const user_username = `user_${req.decoded.userId}`
    const response = await axios.post("https://em-api.thegameprovider.com/api/seamless/provider",{
        "api_password": "b16gWs7e0QAASLTne0",
        "api_login": "1obet_mc_s",
        "method": "getGame",
        "lang": "en",
        "user_username": user_username,
        "user_password": user_username,
        "homeurl": "https://1obet.com",
        "gameid": "di#di-sportsbook",
        "play_for_fun": false,
        "currency": "PKR"
    });

    return res.send({
    success: true,
    message: 'sport book detail',
    data: response.data
    });

  } catch (err) {
    console.error(err);
    res.status(404).send({ message: 'Something went wrong' });
  }
}
async function sportsBookDirect(req, res) {
  try {
    const user_username = `user_${req.decoded.userId}`
    const response = await axios.post("https://em-api.thegameprovider.com/api/seamless/provider",{
        "api_password": "b16gWs7e0QAASLTne0",
        "api_login": "1obet_mc_s",
        "method": "getGameDirect",
        "lang": "en",
        "user_username": user_username,
        "user_password": user_username,
        "homeurl": "https://1obet.com",
        "gameid": "di#di-sportsbook",
        "play_for_fun": false,
        "currency": "PKR"
    });

    return res.send({
    success: true,
    message: 'sport book detail',
    data: response.data
    });

  } catch (err) {
    console.error(err);
    res.status(404).send({ message: 'Something went wrong' });
  }
}

loginRouter.get( '/getAllSportsBookGamesFromThirdParty', getAllSportsBookGamesFromThirdParty );
loginRouter.get( '/sportGamesList', sportGamesList );
loginRouter.get( '/sportsBook', sportsBook );
loginRouter.get( '/sportsBookDirect', sportsBookDirect );
module.exports = { loginRouter };
