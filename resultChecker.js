const mongoose = require('mongoose');
require('dotenv').config();
const DBNAME = process.env.DB_NAME;
const DBHost = process.env.DBHost;
const ToolForResults = require('./resultSystem/src/tools_for_results.js')();

const mongooseOptions = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  connectTimeoutMS: 30000
};

mongoose.set('strictQuery', false);
mongoose.set({ debug: false });
mongoose
  .connect(`${DBHost}?directConnection=true`, mongooseOptions)
  .then(() => {
    console.log('Database connected');
  })
  .catch((err) => {
    console.error(`Failed to connect to the database: ${err}`);
  });

async function main() {
  ToolForResults.init();
}

main();
