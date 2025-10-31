const axios = require("axios");

const getNLiveTV = async () => {
  const eventId = `32955492`
  const url  = `https://nlivetv.lagaikhaipro.com/ntv.php?eventId=${eventId}`
  const res = await axios.get(url)
  console.log('lagai tv', JSON.stringify(res.data))
}

module.exports = {getNLiveTV}
