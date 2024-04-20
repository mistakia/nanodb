/* global before */
import knex from '#db'
import path, { dirname } from 'path'
import fs from 'fs/promises'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const sqlFile = path.resolve(__dirname, '../db/schema.postgre.sql')

export async function mocha_global_setup() {
  const sql = await fs.readFile(sqlFile, 'utf8')
  await knex.raw(sql)
}

before(mocha_global_setup)
