/**
 * This file is very critical,
 * Please don't change this file, without consulting any one.
 * This file works with configurations,
 * rather use the config files instead to change settings.
 * One wrong thing in this file will mess up the whole server concurrency.
 * Before changing file, even if you are 0.0001% not sure, consult the author
 * @author umar
 */
const mongoosePaginate = require('mongoose-paginate')
const aggregatePaginate = require('mongoose-aggregate-paginate-v2')
let config = require('config') // we load the db location from the JSON files

mongoosePaginate.paginate.options = {
  lean: config.lean,
  limit: config.pageSize
}

const Globals = {
  'paginate': mongoosePaginate,
  'aggregatePaginate': aggregatePaginate
}
module.exports = Globals
