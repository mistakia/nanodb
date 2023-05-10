const Knex = require('knex')
const config = require('../config')
// const mysql = Knex(config.mysql)
const postgres = Knex(config.postgresql)

module.exports = postgres
