const express = require("express");
const CasinoGames = require("../models/casinoGames");
const SelectedCasino = require("../models/selectedCasino");
const AsianGames = require("../models/AsianGames");
const AsianProviders = require("../models/AsianProviders");
const selectedCasinoValidator = require("../validators/casinoGames");
const { validationResult } = require("express-validator");
const Markets = require("../models/marketTypes");
const SubMarketType = require("../models/subMarketTypes");
const loginRouter = express.Router();
const axios = require("axios");
let config = require("config");
const User = require("../models/user");         

require('dotenv').config();
const api_username = process.env.api_username;
const api_password = process.env.api_password;

const getParents = async (userId) => {
  const parentUserIds = [];
  let currentUserId = userId;
  //console.log("currentUserId", currentUserId);

  while (currentUserId) {
    const parentUser = await User.findOne({ userId: currentUserId });

    if (
      !parentUser ||
      !parentUser.createdBy ||
      parentUser.createdBy == currentUserId
    ) {
      break;
    }
    parentUserIds.push(parentUser.createdBy);
    currentUserId = parentUser.createdBy;
  }
  //console.log(" parentUserIds ========== ", parentUserIds);
  return parentUserIds;
};

async function getCasinoGames(req, res) {
  let data = JSON.stringify({
    partnerKey: config.worldCasinoOnlinePartnerKey,
    providerCode: null,
  });
  let aconf = {
    method: "post",
    maxBodyLength: Infinity,
    url: `${config.worldCasinoOnlineApiUrl}/games`,
    headers: {
      "Content-Type": "application/json",
    },
    data,
  };
  axios
    .request(aconf)
    .then((response) => {
      res.send({
        success: true,
        message: "Casino games get successfully",
        response,
        //games,
      });
    })
    .catch((error) => {
      console.error(error);
      res.status(500).send({
        success: false,
        message: "Failed to get casino games",
        error,
        q,
      });
    });
}

async function addCasinoGameDetails(req, res) {
  try {
    const user = await  User.find({ userId: req.body.userId })
    const response = await axios.post(`${config.worldCasinoOnlineAuthUrl}`, {
      partnerKey: config.worldCasinoOnlinePartnerKey,
      game: {
        gameCode: req.body.gameCode,
        providerCode:  req.body.providerCode
      },
      timestamp: `${new Date().getTime() / 1000}`,
      user: {
        id: "" + req.body.userId,
        currency: req.body.currency,
        displayName: user.userName,
        backUrl: config.worldCasinoOnlineRedirectionUrl
      },
    });

    const resp = response.data;
    if (resp.sessionId == null || resp.sessionId == undefined) {
      res.status(400).send({ success: false, message: "Bad request", resp });
    } else {
      // const gameList = response.data.response;
      // const bulkOps = gameList.map((game) => ({
      //   updateOne: {
      //     filter: { category: game.category },
      //     update: {
      //       $push: { games: { ...game, details: JSON.parse(game.details) } },
      //     },
      //     upsert: true,
      //   },
      // }));

      // await CasinoGames.bulkWrite(bulkOps);

      // const games = await axios.get(
      //   resp.launchURL
      // );

      // const games = await axios.post(`${config.worldCasinoOnlineUrl}/games`, {
      //   partnerKey: config.worldCasinoOnlinePartnerKey,
      // });

      res.send({
        success: true,
        message: "Casino games added successfully",
        data: resp,
        //games,
      });
    }
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .send({ success: false, message: "Failed to add casino games", error });
  }
}

async function addEuCasinoGameDetails(req, res) {
  if( req.decoded.role != '0' ){
    return res.status(200).send({ message: 'you are not allowed to add games',success:false})
  }
  try {
    const response = await axios.post(config.apiUrl, {
      api_password: api_password,
      api_login: api_username,
      method: 'getGameList',
      show_additional: true,
      show_systems: 1,
      currency: 'PKR',
    });

    //console.log('Response:', response.data);
    const gameList = response.data.response;
    const bulkOps = gameList.map((game) => ({
      updateOne: {
        filter: { category: game.category },
        update: {
          $push: { games: { ...game, details: JSON.parse(game.details) } },
        },
        upsert: true,
      },
    }));

    await CasinoGames.bulkWrite(bulkOps);
    res.send({ success: true, message: 'Casino games added successfully' });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .send({ success: false, message: 'Failed to add casino games' });
  }
}

async function getAsianCasinoGames(req, res) {
  try {
    const providers = await AsianProviders.find();

    providers &&
      ( providers.forEach(async (provider) => {
        const response = await axios.post(
          `${config.worldCasinoOnlineApiUrl}/games`,
          {
            partnerKey: config.worldCasinoOnlinePartnerKey,
            providerCode: provider.providerCode,
          }
        );

        const bulkData = [];

        if (response) {
          await response.data.games.forEach((game) => {
            bulkData.push({
              name: game.name,
              code: game.code,
              providerCode: game.providerCode,
              providerName: provider.providerName,
              thumb: game.thumb,
              category: game.category,
            });
          });

          await AsianGames.insertMany(bulkData);
        }
      }));

    res.send({
      success: true,
      message: "Casino games added successfully",
    });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .send({ success: false, message: "Failed to add casino games", error });
  }
}

function getAllCasinoCategories(req, res) {
  CasinoGames.find({}, { _id: 1, category: 1 }, (err, casinoCategories) => {
    if (err || !casinoCategories || casinoCategories.length == 0) {
      return res.status(404).send({ message: "Casino Categories Not Found" });
    }

    SelectedCasino.find({}, { _id: 1, status: 1 }, (err, selectedCasino) => {
      if (err || !selectedCasino) {
        return res
          .status(404)
          .send({ message: "Failed to retrieve casino categories" });
      }

      const results = casinoCategories.map((category) => {
        const matchingCategory = selectedCasino.find((selected) =>
          selected._id.equals(category._id)
        );
        const status = matchingCategory ? parseInt(matchingCategory.status) : 0;
        return {
          _id: category._id,
          category: category.category,
          status: status.toString(),
        };
      });

      return res.send({
        message: "Casino Categories Found",
        success: true,
        results: results,
      });
    });
  });
}

async function addSelectedCasinoCategories(req, res) {
  const errors = validationResult(req);
  if (errors.errors.length !== 0) {
    return res.status(400).send({ errors: errors.errors });
  }
  if (req.decoded.role == 5) {
    return res
      .status(404)
      .send({ message: "only company can add selected casino categories" });
  }
  const { casinoCategories } = req.body;

  try {
    for (const category of casinoCategories) {
      const { _id, status, games } = category;

      const allCasino = await CasinoGames.findOne({ _id }).exec();
      let selectedCasino = await SelectedCasino.findOne({ _id }).exec();

      if (!selectedCasino) {
        selectedCasino = new SelectedCasino({
          _id: _id,
          category: allCasino.category,
          status: status,
          games: [],
        });
      }

      if (status == 2) {
        //console.log("in here");
        // Add all games for _id in selectedCasino
        selectedCasino._id = _id; // Assign _id
        selectedCasino.category = allCasino.category; // Assign _id
        selectedCasino.status = status; // Assign status
        selectedCasino.games = allCasino.games;
        await selectedCasino.save();
      } else if (status == 1) {
        if (games.length == 0) {
          //console.log("Deleting selected casino ->>> :", _id);
          await SelectedCasino.deleteOne({ _id: _id });
        } else {
          for (const gameID of games) {
            let matchingGame = allCasino.games.find(
              (game) => game.id == gameID
            );

            if (matchingGame) {
              //console.log("Matching game found:", matchingGame);
              // Check if the game is already present in selectedCasino
              const isGameAlreadyAdded = selectedCasino.games.some(
                (game) => game.id == gameID
              );

              if (!isGameAlreadyAdded) {
                selectedCasino.games.push(matchingGame); // Add the matching game to selectedCasino
              }
              // else {
              //   return res.status(404).send({ message: 'Game already present:' });
              // }
            } else {
              //console.log("No matching game found for ID:", gameID);
            }
          }
          await selectedCasino.save();
        }
      }
    }

    for (const category of casinoCategories) {
      const { _id, status } = category;
      if (status == 0) {
        //console.log("Deleting selected casino:", _id);
        await SelectedCasino.deleteOne({ _id: _id });
      }
    }

    res.send({
      message: "Selected casino categories saved successfully",
      success: true,
    });
  } catch (err) {
    console.error("Error saving selected casino categories:", err);
    res
      .status(500)
      .send({ message: "Failed to save selected casino categories" });
  }
}

function getCategoryCasinoGames(req, res) {
  let _id = req.query._id;
  CasinoGames.findOne({ _id: _id }, (err, casinoCategories) => {
    if (err || !casinoCategories || casinoCategories.length == 0) {
      return res.status(404).send({ message: "Casino Categories Not Found" });
    }
    SelectedCasino.findOne({ _id: _id }, (err, selectedCategory) => {
      if (err || !selectedCategory || selectedCategory.length == 0) {
        const results = casinoCategories.games.map((game) => {
          return {
            _id: game._id,
            game: game,
            status: 0,
          };
        });
        return res.send({
          message: "Selected Casino Games Found",
          success: true,
          results: results,
        });
      } else {
        const results = casinoCategories.games.map((game) => {
          const matchingGame = selectedCategory.games.some(
            (selected) => selected.id == game.id
          );
          const status = matchingGame ? 1 : 0;
          return {
            _id: game._id,
            game: game,
            status: status,
          };
        });
        return res.send({
          message: "Selected Casino Games Found",
          success: true,
          results: results,
        });
      }
    });

    // return res.send({
    //   message: 'Selected Casino Games Found',
    //   success: true,
    //   results: casinoCategories,
    // });
  });
}

async function getAllSelectedCasinos(req, res) {
  const user = await User.findOne({ userId: req.decoded.userId });
  let parentUserIds = await getParents(req.decoded.userId);
  const marketIds = await User.distinct("blockedMarketPlaces", {
    userId: { $in: parentUserIds },
    isDeleted: false,
  });
  const subMarketId1 = await User.distinct("blockedSubMarkets", {
    userId: { $in: parentUserIds },
    isDeleted: false,
  });
  const subMarketId2 = await User.distinct("blockedSubMarketsByParent", {
    userId: { $in: parentUserIds },
    isDeleted: false,
  });
  const subMarketId = subMarketId1.concat(subMarketId2);
  const subMarketDetail = await SubMarketType.findOne({
    countryCode: req.body.gameCategory,
    marketId: config.casinoMarketId,
  });
  const marketId = config.casinoMarketId;

  //console.log(" ================== parentUserIds =========================",parentUserIds);
  //console.log(" ================== marketIds =========================",marketIds);
  //console.log(" ================== subMarketId =========================",subMarketId);
  //console.log(" ================== marketId =========================",marketId);
  //console.log(" ================== marketId =========================",marketId);
  //console.log(" ================== user =========================", user);

  try {
  } catch (error) {
    //console.log(error);
  }

  let query = {};

  let page = 1;
  let limit = 20;
  if (req.body.numRecords) {
    if (isNaN(req.body.numRecords))
      return res.status(400).send({ message: "NUMBER_RECORDS_IS_NOT_PROPER" });
    if (req.body.numRecords < 0)
      return res.status(400).send({ message: "NUMBER_RECORDS_IS_NOT_PROPER" });
    limit = Number(req.body.numRecords);
  }
  if (req.body.page) {
    page = Number(req.body.page);
  }

  // Check for isMobile parameter in the request body
  if (req.body.isMobile == true) {
    // //console.log('in here isMobile true');
    query["games.mobile"] = true;
  } else if (req.body.isMobile == false) {
    // //console.log('in here isMobile false');
    query["games.mobile"] = false;
  }

  // Check for gameCategory parameter in the request body
  if (req.body.gameCategory != "") {
    // //console.log('in gameCategoryCheck');
    query["games.category"] = req.body.gameCategory;
  }

  // return res.send(query);

  const casino = await SelectedCasino.find(query, {
    _id: 0,
    "games.id": 1,
    "games.name": 1,
    "games.image_filled": 1,
    "games.isDashboard": 1,
    "games.mobile": 1,
    "games.id_hash": 1,
  });
  // //console.log('casino',casino);
  const games = casino
    .flatMap((casino) => casino.games)
    .filter((game) => game.mobile === req.body.isMobile);
  // //console.log('games',games);
  // Apply pagination based on the requested number of records
  const totalRecords = games.length;
  const totalPages = Math.ceil(totalRecords / limit);
  const startIndex = (page - 1) * limit;
  const endIndex = Math.min(startIndex + limit, totalRecords);
  const paginatedGames = games.slice(startIndex, endIndex);

  const casinoCategories = await SelectedCasino.find(
    {},
    {
      _id: 0,
      category: 1,
    }
  );

  
  if ( marketIds.includes(marketId) 
  // || subMarketId.includes(subMarketDetail.Id) 
  || user.betLockStatus == true ) {
    // return res.status(404).send({ message:  });
    return res.send({
      message: "Betting is disabled",
      success: true,
      battingDisabled: true,
      results: paginatedGames,
      categories: casinoCategories,
      pagination: {
        total: totalRecords,
        totalPages: totalPages,
        currentPage: page,
        recordsPerPage: limit,
      },
    });
  }
  return res.send({
    message: "Selected Casino Games List",
    success: true,
    battingDisabled: false,
    results: paginatedGames,
    categories: casinoCategories,
    pagination: {
      total: totalRecords,
      totalPages: totalPages,
      currentPage: page,
      recordsPerPage: limit,
    },
  });
}

async function getListAsianGames(req, res) {
  const user = await User.findOne({ userId: req.decoded.userId });
  let parentUserIds = await getParents(req.decoded.userId);
  const marketIds = await User.distinct("blockedMarketPlaces", {
    userId: { $in: parentUserIds },
    isDeleted: false,
  });
  const subMarketId1 = await User.distinct("blockedSubMarkets", {
    userId: { $in: parentUserIds },
    isDeleted: false,
  });
  const subMarketId2 = await User.distinct("blockedSubMarketsByParent", {
    userId: { $in: parentUserIds },
    isDeleted: false,
  });
  const subMarketId = subMarketId1.concat(subMarketId2);
  const subMarketDetail = await SubMarketType.findOne({
    countryCode: req.body.gameCategory,
    marketId: config.casinoMarketId,
  });
  const marketId = config.casinoMarketId;

  //console.log(" ================== parentUserIds =========================",parentUserIds);
  //console.log(" ================== marketIds =========================",marketIds);
  //console.log(" ================== subMarketId =========================",subMarketId);
  //console.log(" ================== marketId =========================",marketId);
  //console.log(" ================== marketId =========================",marketId);
  //console.log(" ================== user =========================", user);

  try {
  } catch (error) {
    //console.log(error);
  }

  let query = {};

  let page = 1;
  let limit = 20;
  if (req.body.numRecords) {
    if (isNaN(req.body.numRecords))
      return res.status(400).send({ message: "NUMBER_RECORDS_IS_NOT_PROPER" });
    if (req.body.numRecords < 0)
      return res.status(400).send({ message: "NUMBER_RECORDS_IS_NOT_PROPER" });
    limit = Number(req.body.numRecords);
  }
  if (req.body.page) {
    page = Number(req.body.page);
  }

  //console.log(req.body.gameCategory);

  // Check for gameCategory parameter in the request body
  if (req.body.gameCategory != "") {
    // //console.log('in gameCategoryCheck');
    query["providerName"] = req.body.gameCategory;
  }

  // return res.send(query);

  const casino = await AsianGames.find(query, {
    _id: 0,
    name: 1,
    code: 1,
    providerCode: 1,
    providerName: 1,
    thumb: 1,
    category: 1,
  });
  // //console.log('games',games);
  // Apply pagination based on the requested number of records
  const totalRecords = casino.length;
  const totalPages = Math.ceil(totalRecords / limit);
  const startIndex = (page - 1) * limit;
  const endIndex = Math.min(startIndex + limit, totalRecords);
  const paginatedGames = casino.slice(startIndex, endIndex);

  if (
    marketIds.includes(marketId) ||
    subMarketId.includes(subMarketDetail?.Id) ||
    user.betLockStatus == true
  ) {
    // return res.status(404).send({ message:  });
    return res.send({
      message: "Betting is disabled",
      success: true,
      battingDisabled: true,
      results: paginatedGames,
      pagination: {
        total: totalRecords,
        totalPages: totalPages,
        currentPage: page,
        recordsPerPage: limit,
      },
    });
  }
  return res.send({
    message: "Asian Games List",
    success: true,
    battingDisabled: false,
    results: paginatedGames,
    pagination: {
      total: totalRecords,
      totalPages: totalPages,
      currentPage: page,
      recordsPerPage: limit,
    },
  });
}

async function getGame(req, res) {
  try {
    const errors = validationResult(req);
    if (errors.errors.length !== 0) {
      return res.status(400).send({ errors: errors.errors });
    }

    if (req.decoded.role !== "5") {
      return res.status(200).send({
        message: "you are not allowed to play casino games",
        success: false,
      });
    }
    const { homeurl, cashierurl, gameid } = req.body;
    const user = await User.findOne({ userId: req.decoded.userId });

    // //console.log(" Get Game user ======= ", user);

    const payload = {
      api_password: api_password,
      api_login: api_username,
      method: "getGame",
      lang: config.language,
      user_username: "user_" + user.userId,
      user_password: "user_" + user.userId,
      homeurl,
      cashierurl,
      gameid,
      play_for_fun: config.play_for_fun,
      currency: user.baseCurrency.toUpperCase(),
    };

    const response = await axios.post(config.apiUrl, payload);
    res.status(200).send({
      success: true,
      message: "game data found successfully",
      results: response.data,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send({ success: false, message: "Failed to get game" });
  }
}

async function getDashboardGames(req, res) {
  const data = await SelectedCasino.find({});
  return res.send({
    message: "Selected Casino Games List",
    success: true,
    results: data,
  });
}

function getGamesByName(req, res) {
  let category = req.query.category;
  CasinoGames.findOne({ category: category }, (err, casinoCategories) => {
    if (err || !casinoCategories || casinoCategories.length == 0) {
      return res.status(404).send({ message: "Casino Categories Not Found" });
    }
    return res.send({
      message: "Category Casino Games Found",
      success: true,
      results: casinoCategories.games,
    });
  });
}

const addSelectedDashboardGames = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).send({ errors: errors.array() });
  }

  if (req.decoded.role != "0") {
    return res.status(200).send({
      message: "you are not allowed to add dashboard games",
      success: false,
    });
  }
  const { gameId, status } = req.body;

  SelectedCasino.updateOne(
    { "games.id": gameId },
    { $set: { "games.$.isDashboard": status } }
  )
    .then((result) => {
      return res.send({
        success: true,
        message: "Selected Dashboard games updated successfully",
      });
    })
    .catch((err) => {
      return res.status(500).send({
        success: false,
        message: "Error updating selected games",
        err,
      });
    });
};

async function getSelectedGamesBySearch(req, res) {
  let query = {};

  let page = 1;
  let limit = 20;
  if (req.body.numRecords) {
    if (isNaN(req.body.numRecords))
      return res.status(400).send({ message: "NUMBER_RECORDS_IS_NOT_PROPER" });
    if (req.body.numRecords < 0)
      return res.status(400).send({ message: "NUMBER_RECORDS_IS_NOT_PROPER" });
    limit = Number(req.body.numRecords);
  }
  if (req.body.page) {
    page = Number(req.body.page);
  }

  // Check for isDashboard parameter in the request body
  if (req.body.isDashboard == true) {
    query["games.isDashboard"] = true;
  } else if (req.body.isDashboard == false) {
    query["games.isDashboard"] = false;
  }

  // Check for isMobile parameter in the request body
  if (req.body.isMobile == true) {
    // //console.log('in here isMobile true');
    query["games.mobile"] = true;
  } else if (req.body.isMobile == false) {
    // //console.log('in here isMobile false');
    query["games.mobile"] = false;
  }

  // Check for gameCategory parameter in the request body
  if (req.body.gameCategory != "") {
    query["games.category"] = req.body.gameCategory;
  }

  // if (req.body.name != '') {
  //   query['games.name'] = req.body.name;
  // }

  const casino = await SelectedCasino.find(query, {
    _id: 0,
    "games.id": 1,
    "games.name": 1,
    "games.image_filled": 1,
    "games.isDashboard": 1,
    "games.mobile": 1,
    "games.category": 1,
    "games.id_hash": 1,
  });

  let games = [];
  if (req.body.name) {
    games = casino
      .flatMap((game) => game.games)
      .filter(
        (game) =>
          game.mobile == req.body.isMobile &&
          game.isDashboard == req.body.isDashboard &&
          // || (game.isDashboard == req.body.isDashboard)
          // || (game.mobile == req.body.isMobile)
          game.name.toLowerCase().includes(req.body.name.toLowerCase())
      );
  } else {
    games = casino
      .flatMap((game) => game.games)

      .filter(
        (game) =>
          game.mobile == req.body.isMobile &&
          game.isDashboard == req.body.isDashboard
      );
  }
  // Apply pagination based on the requested number of records
  const totalRecords = games.length;
  const totalPages = Math.ceil(totalRecords / limit);
  const startIndex = (page - 1) * limit;
  const endIndex = Math.min(startIndex + limit, totalRecords);
  const paginatedGames = games.slice(startIndex, endIndex);

  return res.send({
    message: "Selected Casino Games List",
    success: true,
    results: paginatedGames,
    // categories:casinoCategories,
    pagination: {
      total: totalRecords,
      totalPages: totalPages,
      currentPage: page,
      recordsPerPage: limit,
    },
  });
}

function getSelectedGamesCategories(req, res) {
  SelectedCasino.find({}, { category: 1, _id: 0 }, (err, categories) => {
    if (err || !categories)
      return res.status(500).send({ message: "categories not found" });

    return res.send({
      message: "Selected Casino Games Category List",
      success: true,
      categories: categories,
    });
  });
}

//for sport book
async function getGameDirect(req, res) {
  try {
    const errors = validationResult(req);
    if (errors.errors.length !== 0) {
      return res.status(400).send({ errors: errors.errors });
    }

    if (req.decoded.role !== "5") {
      return res.status(200).send({
        message: "you are not allowed to play casino games",
        success: false,
      });
    }
    const { homeurl, cashierurl, gameid } = req.body;
    const user = await User.findOne({ userId: req.decoded.userId });

    const payload = {
      api_password: api_password,
      api_login: api_username,
      method: "getGameDirect",
      lang: config.language,
      user_username: "user_" + user.userId,
      user_password: "user_" + user.userId,
      homeurl,
      cashierurl,
      gameid,
      play_for_fun: config.play_for_fun,
      currency: config.currency,
    };

    const response = await axios.post(config.apiUrl, payload);
    res.status(200).send({
      success: true,
      message: "Direct game data found successfully",
      results: response.data,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send({ success: false, message: "Failed to get game" });
  }
}

loginRouter.post("/getSelectedGamesBySearch", getSelectedGamesBySearch);
loginRouter.post("/addCasinoGameDetails", addCasinoGameDetails);
loginRouter.post("/getCasinoGames", getCasinoGames);
loginRouter.get("/getAsianCasinoGames", getAsianCasinoGames);

loginRouter.get("/getAllCasinoCategories", getAllCasinoCategories);

loginRouter.get("/getCategoryCasinoGames", getCategoryCasinoGames);

loginRouter.post("/getAllSelectedCasinos", getAllSelectedCasinos);
loginRouter.post("/getListAsianGames", getListAsianGames);

loginRouter.get("/addEuCasinoGameDetails", addEuCasinoGameDetails);



loginRouter.post(
  "/addSelectedCasinoCategories",
  selectedCasinoValidator.validate("addSelectedCasinoCategories"),
  addSelectedCasinoCategories
);

loginRouter.post("/getGame", getGame);
loginRouter.get("/getDashboardGames", getDashboardGames);
loginRouter.get("/getGamesByName", getGamesByName);
loginRouter.post("/addSelectedDashboardGames", addSelectedDashboardGames);

loginRouter.get("/getSelectedGamesCategories", getSelectedGamesCategories);
loginRouter.post("/getGameDirect", getGameDirect);

module.exports = { loginRouter };
