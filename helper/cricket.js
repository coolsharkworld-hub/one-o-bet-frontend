const Session = require("../app/models/Session");

const calculateSessionNo = (scores) => {
  /*from bets.js*/
  let currentSession
  let type = scores.type;
  let inning = scores.inning;
  let currentOver = (scores.activeTeam === scores.team1ShortName) ? scores.over1 : scores.over2
  let sessionAddition = 0;
  const sessionAdditionTimes = inning - 1
  if (inning !== 1) {
    if (type === "TEST") {
      sessionAddition = 9 * sessionAdditionTimes;
    } else if (type === "ODI") {
      sessionAddition = 10 * sessionAdditionTimes;
    } else if (type === "T20") {
      sessionAddition = 4 * sessionAdditionTimes;
    } else if (type === "T10") {
      sessionAddition = 2 * sessionAdditionTimes;
    }
  }

  currentSession = Math.ceil(currentOver / 5) + sessionAddition;

  switch (type) {
    case "T10":
      break;
    case "T20":
      break;
    case "ODI":
      break;
    case "TEST":
      currentSession = Math.ceil(currentOver / 10) + sessionAddition;
      break;
  }

  // if (type === "TEST" && scores?.day > 1) {
  //   currentSession = currentSession + 18
  // }
  return currentSession
}
module.exports = {calculateSessionNo}