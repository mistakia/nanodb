import debug from 'debug'
import got from 'got'
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

const DAY_MS = 24 * 60 * 60 * 1000

// The keyless API serves only the trailing 365 days, so each run refreshes the
// last year; older rows already in historical_price stay as they are.
const MARKET_CHART_URL =
  'https://api.coingecko.com/api/v3/coins/nano/market_chart?vs_currency=usd&days=365&interval=daily'

// Keep the vendor's number text rather than a float64 re-render, so the
// numeric columns store the digits CoinGecko sent.
const parse_json_keeping_number_text = (text) =>
  JSON.parse(text, (key, value, context) =>
    typeof value === 'number' ? context.source : value
  )

const index_utc_midnights = (series) => {
  const by_ms = new Map()
  for (const [timestamp, value] of Array.isArray(series) ? series : []) {
    const ms = Number(timestamp)
    if (ms % DAY_MS === 0 && value !== null) {
      by_ms.set(ms, value)
    }
  }
  return by_ms
}

// market_chart with interval=daily carries one snapshot per UTC midnight plus
// a trailing "now" point. Day D's row takes its price from the D+1 00:00
// snapshot (the day's close) and its volume from the D 00:00 snapshot -- the
// pairing the retired price_charts CSV export used. A day is emitted only once
// both snapshots exist, so the running day never produces a row.
export const format_market_chart_rows = (text) => {
  const body = parse_json_keeping_number_text(text)
  if (!body || !Array.isArray(body.prices)) {
    throw new Error(
      `unexpected CoinGecko market_chart response: ${String(text).slice(0, 200)}`
    )
  }
  const prices = index_utc_midnights(body.prices)
  const volumes = index_utc_midnights(body.total_volumes)

  const rows = []
  for (const ms of [...prices.keys()].sort((a, b) => a - b)) {
    if (!prices.has(ms + DAY_MS) || !volumes.has(ms)) continue
    rows.push({
      timestamp_utc: new Date(ms).toISOString().slice(0, 10) + ' 00:00:00',
      price: prices.get(ms + DAY_MS),
      volume: volumes.get(ms),
      source: 'coingecko'
    })
  }
  return rows
}

const import_coingecko_price_history = async ({ file } = {}) => {
  const raw_json = file
    ? await fs.readFile(file, 'utf8')
    : await got(MARKET_CHART_URL).text()
  const rows = format_market_chart_rows(raw_json)

  // An empty result means the response changed shape, not that Nano has no
  // price history; fail loudly instead of inserting nothing.
  if (!rows.length) {
    throw new Error(
      `no usable daily rows in CoinGecko market_chart response: ${raw_json.slice(0, 200)}`
    )
  }

  await db('historical_price')
    .insert(rows)
    .onConflict(['source', 'timestamp_utc'])
    .merge()
  log(
    `Inserted ${rows.length} rows (${rows[0].timestamp_utc} to ${rows[rows.length - 1].timestamp_utc})`
  )
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
