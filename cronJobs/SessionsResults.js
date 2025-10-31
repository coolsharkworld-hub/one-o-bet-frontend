const cron = require("node-cron");
const { 
  sessionCalc
 } = require("../app/routes/bets");
require('../db');

const SessionsResultsCalc = () => {
  cron.schedule('*/15 * * * * *', async () => {
    try {
      await sessionCalc();
      console.log(" Call Completed");
    } catch (error){
      console.error('Error running listMarket cron job:', error);
    }
   });
}
SessionsResultsCalc()