"use strict";
module.exports = ToolForAsian;

const apiRequests = require("./api/apiRequestsAsian")();

function ToolForAsian() {
  return { init };

  async function init(_io, express) {
    apiRequests.init(_io, express);
 
    fetchOdds();
  }
  function fetchOdds() {
    // //console.log("running fetch odds")
    apiRequests.getOddsFromProvider()
      .then(() => {
        setTimeout(fetchOdds, 1000)
      })
      .catch(err => {
        //console.log(err);
        // Schedule the next call even if there's an error
        setTimeout(fetchOdds, 1000);
      });
  }
}
