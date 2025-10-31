const  express              = require('express');
const  {validationResult }   = require('express-validator');
const  BettingFigure         = require('../models/BettingFigure');
const  Event                 = require('../models/events');
const  {default: axios }     = require('axios');
const  loginRouter           = express.Router();

async function getBettingFigures(req, res) {
    try {
        BettingFigure.find({}, (error, figures)=>{
            res.status(200).json({
                success: true,
                message: 'All Figures Data List',
                data: figures,
            });
        })

    } catch (error) {
        console.error(error);
        res.status(200).json({
            success: false,
            message: 'Failed to get data',
            error: error.message,
        });
    }
}

async function UpdateBettingFigures(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).send({ errors: errors.errors });
    }
    try {
        req.body.figures.forEach((figure) => {
            //console.log("figure: ", figure);
            BettingFigure.findByIdAndUpdate(
                figure._id,
                { $set: { amount: figure.amount } },
                (err, updatedFigure) => {
                    if (err) {
                        //console.log("Error updating figure:", err);
                    } else {
                        //console.log("Updated figure:", updatedFigure);
                    }
                }
            );
        });
        res.status(200).json({
            success: true,
            message: 'Saved Successfully'
        });


    }catch (error) {
        console.error(error);
        res.status(200).json({
            success: false,
            message: 'Failed to save fancy data3',
            error: error.message,
        });
    }
}

async function cricketLiveScore(id) {
    try {
      const apiResponse =  await   axios.get(`https://livesportscore.xyz:3440/api/bf_scores/${id}`);
      const data = apiResponse.data;
      const response = {};
      if(typeof(data[0]) == "string"){
        const event = await Event.findOne({ Id: id }, { _id: 0, matchType: 1, sportsId: 1 });
        const type = event ? event.matchType : null;
        const scoreInfo     = JSON.parse(data).score
        let score           = scoreInfo.score1;
        let played          = scoreInfo.score2;
        response.spnnation1 = scoreInfo.spnnation1;
        response.spnnation2 = scoreInfo.spnnation2;

        if(scoreInfo.activenation1 == 1){
            response.team   =  scoreInfo.spnnation1
            response.crr    = scoreInfo.spnrunrate1.substring(scoreInfo.spnrunrate1.indexOf(' ') + 1).trim()

        }
        else if(scoreInfo.activenation2 == 1){
            response.team    = scoreInfo.spnnation2;
            response.crr     = scoreInfo.spnrunrate2.substring(scoreInfo.spnrunrate2.indexOf(' ') + 1).trim()
            score            = scoreInfo.score2;
            played           = scoreInfo.score1;
        }
          
        response.type   = type
        response.balls  = scoreInfo.balls
  
        if(type == "TEST"){
            score = score.split('&');
            score = score[score.length - 1].trim()
            played = played.split('&');
            played = played[played.length - 1].trim();
        }
        played = played.replaceAll(/[\s-]/g, ',').replaceAll(/[())]/g, '').split(',');
        played = played.filter(element => element != 0).length;
        if(played > 0){
            response.secondInnings  = 1;
            response.spnmessage =  scoreInfo.spnmessage
             
            if(scoreInfo.activenation2 == 1){
                target = scoreInfo.score1 ? scoreInfo.score1 : ""
            }else if(scoreInfo.activenation1 == 1){
                target = scoreInfo.score2 ? scoreInfo.score2 : ""
            }

            response.target  = (parseInt(target.replaceAll(/[\s-]/g, ',').replaceAll(/[())]/g, '').split(',')[0]) + 1).toString();
            if(scoreInfo.spnreqrate1 != null && scoreInfo.spnreqrate1 != "" ){
                response.rrr = scoreInfo.spnreqrate;
            }
            else if(scoreInfo.spnreqrate2 != null && scoreInfo.spnreqrate2 != ""){
                response.rrr = scoreInfo.spnreqrate2;
            }
        }

        [response.score, response.wickets, response.overs] = score.replaceAll(/[\s-]/g, ',').replaceAll(/[())]/g, '').split(',');
        return response
      }else{
        return data[0]
      }
    } catch (error) {
        console.error(error);
        return {
            success: false,
            message: 'Failed to get data',
            error: error.message,
        };
    }
}

async function otherLiveScore(id) {
  try {
    const apiResponse =  await   axios.get(`https://livesportscore.xyz:3440/api/bf_scores/${id}`);
    const data        = apiResponse.data;
    if(typeof(data[0]) == "string"){
      const event = await Event.findOne({ Id: id }, { _id: 0, matchType: 1, sportsId: 1 });
      return JSON.parse(data)
    }else{
      return data[0]
    }
  } catch (error) {
      console.error(error);
      return {
          success: false,
          message: 'Failed to get data',
          error: error.message,
      };
  }
}

async function livesportscore(req, res) {
    try {

      const event = await Event.findOne({ Id: req.params.id }, { _id: 0, matchType: 1, sportsId: 1 });
      const type = event ? event.sportsId : null;
      //console.log("event", event);
      let score = {};

      if(type == "4"){
        score = await cricketLiveScore(req.params.id)
      }else{
        score = await otherLiveScore(req.params.id)
      }
      res.status(200).json({
          success: true,
          message: 'Live Score',
          score:  score
      });
    }
    catch (error) {
        console.error(error);
        res.status(200).json({
            success: false,
            message: 'Failed to get data',
            error: error.message,
        });
    }
}

const placeFigureBets = async (req, res) => {
    try {
        const score             = await liveScore(req.body.Id)


        switch (score.type) {
            case 'T10':
                totalSessions       = 2;
                break;
            case 'T20':
                totalSessions       = 4;
                break;
            case 'ODI':
                totalSessions       = 10;
                break;
            case 'TEST':
                totalSessions       = 9;
                currentSessionOver  = Math.ceil(currentOver%10);
                currentSession      = Math.ceil(currentOver/10);
                break;
            default:
                break;
        }

        if(secondInnings && currentSession == totalSessions){
            res.status(200).json({
                success: false,
                message: 'betting not Allowed in last Session',
                currentSession : currentSession,
                totalSessions  : totalSessions,
                over           : currentSessionOver,
            });
        }
        else if(currentSessionOver > 3){
            res.status(200).json({
                success : false,
                message : `betting not Allowed in ${currentSessionOver} over`,
                currentSession : currentSession,
                totalSessions  : totalSessions,
                over           : currentSessionOver,
            });
        }else {
            res.status(200).json({
                success: false,
                message: 'Batting Allowd',
            });
        }
    } catch (error) {
        console.error(error);
        res.status(200).json({
            success: false,
            message: 'Failed to get data',
            error: error.message,
        });
    }
}


async function placeBet(req, res) {
    const errors = validationResult(req);
    if (errors.errors.length !== 0) {
      return res.status(400).send({ errors: errors.errors });
    }
   
    const { selectedTeam, betAmount, betRate, matchId, subMarketId } = req.body;
    const marketplace = await SubMarketType.findOne({ subMarketId }).exec();
      if (!marketplace) {
        return res.status(404).send({ message: 'marketplaces not found' });
      }
    const marketId = marketplace.marketId
    const userId = req.decoded.userId;
    if (req.decoded.login.role !== '5') {
      return res.status(404).send({ message: 'You are not allowed to bet' });
    }
  
    try {
      const user = await User.findOne({ userId }).exec();
      if (!user) {
        return res.status(404).send({ message: 'User not found' });
      }
      if (user.availableBalance < betAmount) {
        return res.status(404).send({ message: 'Insufficient balance' });
      }
      if (user.bettingAllowed == false) {
        return res.status(404).send({ message: 'Betting is not allowed for your account' });
      }
      
      // default maxbetsize should be of that set by company but if the user set his own betsize then his
      // and we cannot place a bet of the amount that is greater than this maxbetsize
  
      // need review check 
      // const UserMaxBetSize = await userBetSizes.findOne({ marketId: marketId }).exec();
      // //console.log('UserMaxBetSize',UserMaxBetSize)
      // const MaxBetSize = await maxAllowedBetSizes.findOne({ marketId: marketId }).exec();
      // //console.log('MaxBetSize',MaxBetSize)
  
      // let errorMessage;
      // if (UserMaxBetSize && UserMaxBetSize.amount < MaxBetSize.maxAmount) {
      //   errorMessage = `Max Size is: ${UserMaxBetSize.amount}`;
      // } else {
      //   errorMessage = `Max Size is: ${MaxBetSize.maxAmount}`;
      // }
  
  
      // if (betAmount > (UserMaxBetSize?.amount || MaxBetSize?.maxAmount)) {
      //   return res.status(404).send({ message: errorMessage });
      // }
      // need review check  end
  
      const parentUserIds = await getParents(user.userId);
      //console.log('parentUserIds', parentUserIds);
  
      const parentUser = await User.find({
        userId: { $in: [...parentUserIds] },
        isDeleted: false
      }).sort({role: -1});
  
      const blockedMarketPlaces = [];
      const blockedSubMarkets = [];
      const blockedSubMarketsByParent = [];
  
      parentUser.forEach(obj => {
        blockedMarketPlaces.push(...obj.blockedMarketPlaces);
        blockedSubMarkets.push(...obj.blockedSubMarkets);
        blockedSubMarketsByParent.push(...obj.blockedSubMarketsByParent);      
      });
  
      const uniqueBlockedMarketPlaces       = [...new Set(blockedMarketPlaces)];
      const uniqueBlockedSubMarkets         = [...new Set(blockedSubMarkets)];
      const uniqueBlockedSubMarketsByParent = [...new Set(blockedSubMarketsByParent)];
  
      //console.log('uniqueBlockedMarketPlaces', uniqueBlockedMarketPlaces);
      //console.log('uniqueBlockedSubMarkets', uniqueBlockedSubMarkets);
  
      if (uniqueBlockedMarketPlaces.includes(marketId) || uniqueBlockedSubMarkets.includes(subMarketId) 
            || uniqueBlockedSubMarketsByParent.includes(subMarketId) ){
        return res.status(404).send({ message: 'Betting disabled by your dealer' });
      }
      // Check if the user is allowed to place a bet in the specified market and submarket
      if (user.betLockStatus == true || user.blockedSubMarketsByParent.includes(subMarketId)) {
        return res.status(400).send({ message: 'Bet not allowed for your account' });
      }
  
      const match = await CricketMatch.findOne({
        sportsId: marketId,
        id: matchId,
      });
      
  
      if (!match) {
        //console.log(`Match not found for sports ID ${marketId}`);
        return res.status(404).send({ message: `Match not found for sports ID ${marketId}` });
      }
  
      // Check if the match has ended
  
      // need review 
      if (true == false &&  match.matchEnded) {
        //console.log(`Match has already ended for sports ID ${marketId}`);
        return res.status(404).send({ message: `Match has already ended for sports ID ${marketId}` });
      }
  
      let  returnAmount = 0;
      let  winningAmount = 0;
      let  loosingAmount = 0;
      let  remainingAmount = 0;
      if (req.body.type == 0){
        // for Back Will change these Ammounts
        returnAmount = betAmount * betRate - betAmount;
        winningAmount = betAmount * betRate - betAmount;
        //console.log('returnAmount',returnAmount);
        loosingAmount = req.body.betAmount;
        remainingAmount = (req.body.betAmount * req.body.betRate) - req.body.betAmount;
        //console.log('remainingAmount',remainingAmount);
  
      } else {
        // for lay Will change these Ammounts
        returnAmount  = betAmount;
        winningAmount = betAmount;
        loosingAmount = (req.body.betAmount * betRate) - req.body.betAmount;
        remainingAmount = betAmount;
      }
  
      // Create the bet object
      const bet = new Bets({
        marketId,
        userId,
        team: selectedTeam,
        betAmount,
        betRate,
        returnAmount,
        matchId: matchId,
        matchStatus: match.status,
        loosingAmount: loosingAmount,
        winningAmount: winningAmount,
        subMarketId: subMarketId,
        runner: selectedTeam,
        event: match.name,
        type:  req.body.type
      });
  
      // Save the bet object to the database
      //console.log( `Bet placed for user ID ${userId}, sports ID ${marketId}, and team ${selectedTeam}`);
      bet.save(async (err, result) => {
        if (err) {
          //console.log('err', err);
          return res.status(404).send({ message: 'Error placing bet' });
        }
        try {
          const updatedUser = await User.findOneAndUpdate(
            { userId: userId },
            {
              $inc: {
                availableBalance: -loosingAmount,
                exposure: -loosingAmount
              },
            },
            { new: true }
          );
          await updateParentUserBalance(parentUser, remainingAmount);
      
          return res.send({
            success: true,
            message: 'Bet placed successfully',
            results: result,
          });
        }
        catch (error) {
          console.error('error', error);
          return res.status(404).send({ message: 'Error updating user balance' });
        }
      });
    } catch (error) {
      console.error('error', error);
      return res.status(404).send({ message: 'Error placing bet' });
    }
}

loginRouter.get('/getBettingFigures', getBettingFigures);
loginRouter.post('/UpdateBettingFigures', UpdateBettingFigures);
loginRouter.get('/livesportscore/:id', livesportscore);
loginRouter.post('/placeFigureBets', placeFigureBets);

module.exports = { loginRouter };


  