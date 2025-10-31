let config = require('config');
require('dotenv').config();
const DBNAME = process.env.DB_NAME;
const DBHost = process.env.DBHost;
const mongoose = require('mongoose');

let options = {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    connectTimeoutMS: 30000, // 30 seconds
  };

mongoose.set('strictQuery', false);
mongoose.set({ debug: false });
mongoose
  .connect(`${DBHost}?directConnection=true`, options)
  .then(() => {
    console.log('Database connected');
  })
  .catch((err) => {
    console.log(` Database did not connect because ${err}`);
  });


  // check for chanfes 