import debug from 'debug'
import got from 'got'
import neat_csv from 'neat-csv'
import fs from 'fs-extra'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

/* eslint-disable no-unused-vars */
import db from '#db'
import { isMain } from '#common'
/* eslint-enable no-unused-vars */

const argv = yargs(hideBin(process.argv)).argv
const log = debug('import-coingecko-price-history')
debug.enable('import-coingecko-price-history')

const import_coingecko_price_history = async ({ file } = {}) => {
  const raw_csv = file
    ? await fs.readFile(file, 'utf8')
    : await got(
        'https://www.coingecko.com/price_charts/export/756/usd.csv'
      ).text()
  const historical_csv = await neat_csv(raw_csv)
  const formatted_csv = historical_csv.map((row) => ({
    timestamp_utc: row.snapped_at,
    price: Number(row.price),
    volume: Number(row.total_volume),
    source: 'coingecko'
  }))

  await db('historical_price')
    .insert(formatted_csv)
    .onConflict(['source', 'timestamp_utc'])
    .merge()
  log(`Inserted ${formatted_csv.length} rows`)
}

const main = async () => {
  let error
  try {
    await import_coingecko_price_history({ file: argv.file })
  } catch (err) {
    error = err
    log(error)
  }

  // await db('jobs').insert({
  //   type: constants.jobs.EXAMPLE,
  //   succ: error ? 0 : 1,
  //   reason: error ? error.message : null,
  //   timestamp: Math.round(Date.now() / 1000)
  // })

  process.exit()
}

if (isMain(import.meta.url)) {
  main()
}

export default import_coingecko_price_history
