/* global before */
import knex from '#db'
import path, { dirname } from 'path'
import fs from 'fs/promises'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const sqlFile = path.resolve(__dirname, '../db/schema.postgres.sql')

export async function mocha_global_setup() {
  const raw = await fs.readFile(sqlFile, 'utf8')
  const sql = raw.replace(/^GRANT\b.*$/gm, '')
  await knex.raw(sql)
}

before(mocha_global_setup)
