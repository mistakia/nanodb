import Knex from 'knex'
import config from '#config'

// const mysql = Knex(config.mysql)
const postgres = Knex(config.postgresql)
export default postgres
