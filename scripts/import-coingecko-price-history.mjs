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
  // The current day's row arrives with an empty close price; skip it until the
  // day closes rather than storing a zero.
  const formatted_csv = historical_csv
    .filter((row) => row.event_date && row.close_price_usd)
    .map((row) => ({
      timestamp_utc: row.event_date,
      price: Number(row.close_price_usd),
      volume: Number(row.volume_usd),
      source: 'coingecko'
    }))

  // CoinGecko renamed every column once (snapped_at/price/total_volume ->
  // event_date/close_price_usd/volume_usd), which left this job failing on null
  // timestamps. Fail loudly on the next rename instead of inserting nothing.
  if (!formatted_csv.length) {
    throw new Error(
      `no usable rows in CoinGecko CSV; header: ${raw_csv.split('\n')[0]}`
    )
  }

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

  process.exit(error ? 1 : 0)
}

if (isMain(import.meta.url)) {
  main()
}

export default import_coingecko_price_history
