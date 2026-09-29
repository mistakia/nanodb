import debug from 'debug'
import dayjs from 'dayjs'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import utc from 'dayjs/plugin/utc.js'

import db from '#db'
import { isMain } from '#common'

dayjs.extend(utc)

const argv = yargs(hideBin(process.argv)).argv
const log = debug('rollup-daily-balance-distribution')
debug.enable('rollup-daily-balance-distribution')

const first_timestamp = '1550832660' // earliest local_timestamp in blocks table

// Lower bound (raw units) of each balance bracket, largest first. A non-zero
// balance below the last bound falls in _000001_below; zero balances are
// counted separately as _zero.
const balance_brackets = [
  { key: '_1000000', min: '1000000000000000000000000000000000000' }, // 1M
  { key: '_100000', min: '100000000000000000000000000000000000' }, // 100K
  { key: '_10000', min: '10000000000000000000000000000000000' }, // 10K
  { key: '_1000', min: '1000000000000000000000000000000000' }, // 1K
  { key: '_100', min: '100000000000000000000000000000000' }, // 100
  { key: '_10', min: '10000000000000000000000000000000' }, // 10
  { key: '_1', min: '1000000000000000000000000000000' }, // 1
  { key: '_01', min: '100000000000000000000000000000' }, // 0.1
  { key: '_001', min: '10000000000000000000000000000' }, // 0.01
  { key: '_0001', min: '1000000000000000000000000000' }, // 0.001
  { key: '_00001', min: '100000000000000000000000000' }, // 0.0001
  { key: '_000001', min: '10000000000000000000000000' } // 0.00001
]

const bracket_conditions = [
  ...balance_brackets.map(({ key, min }, index) => ({
    key,
    condition:
      index === 0
        ? `balance >= ${min}`
        : `balance >= ${min} AND balance < ${balance_brackets[index - 1].min}`
  })),
  {
    key: '_000001_below',
    condition: `balance > 0 AND balance < ${balance_brackets[balance_brackets.length - 1].min}`
  }
]

const distribution_query = `
  SELECT
    count(*) FILTER (WHERE balance = 0) AS _zero_account_count,
    ${bracket_conditions
      .map(
        ({ key, condition }) => `
    count(*) FILTER (WHERE ${condition}) AS ${key}_account_count,
    COALESCE(sum(balance) FILTER (WHERE ${condition}), 0) AS ${key}_total_balance`
      )
      .join(',')}
  FROM account_balances
`

// The balance of every account as of a moment is its highest-height block at
// or before it. Both the whole ledger (tens of millions of accounts) and the
// per-bracket aggregation stay inside PostgreSQL: the previous implementation
// pulled every account into a Node Map and exhausted its 14 GB heap, and the
// job last produced data on 2026-01-02.
const rollup_daily_balance_distribution = async ({
  start_date = null, // first day to process. defaults to `days` before the last completed UTC day.
  days = 1, // number of days to process when start_date is not given.
  full = false, // process from the first block onward.
  end_date = null // exclusive end day. defaults to today, so the last completed UTC day is included.
}) => {
  let time = start_date
    ? dayjs.utc(start_date).startOf('day')
    : full
      ? dayjs.unix(first_timestamp).utc().startOf('day')
      : dayjs.utc().startOf('day').subtract(days, 'day')
  const end = end_date
    ? dayjs.utc(end_date).startOf('day')
    : dayjs.utc().startOf('day')

  log(
    `processing ${time.format('YYYY-MM-DD')} up to (excluding) ${end.format('YYYY-MM-DD')}`
  )

  // A session-scoped temp table needs one connection for the whole run.
  // Statements autocommit, so no long transaction holds back vacuum.
  const connection = await db.client.acquireConnection()
  const run = (sql, bindings = []) =>
    db.raw(sql, bindings).connection(connection)

  try {
    await run("SET work_mem = '256MB'")
    await run('DROP TABLE IF EXISTS account_balances')
    await run(
      `CREATE TEMP TABLE account_balances AS
        SELECT DISTINCT ON (account) account, balance, height
        FROM blocks
        WHERE local_timestamp < ?
        ORDER BY account, height DESC`,
      [time.unix()]
    )
    await run('ALTER TABLE account_balances ADD PRIMARY KEY (account)')
    const {
      rows: [{ count: account_count }]
    } = await run('SELECT count(*) FROM account_balances')
    log(`account balances as of ${time.format('YYYY-MM-DD')}: ${account_count}`)

    while (time.isBefore(end)) {
      const next = time.add(1, 'day')

      // Apply the day's blocks. The height guard keeps a block that arrives
      // out of order from rolling an account back to an older balance.
      const { rowCount: changed } = await run(
        `INSERT INTO account_balances (account, balance, height)
          SELECT DISTINCT ON (account) account, balance, height
          FROM blocks
          WHERE local_timestamp >= ? AND local_timestamp < ?
          ORDER BY account, height DESC
        ON CONFLICT (account) DO UPDATE
          SET balance = EXCLUDED.balance, height = EXCLUDED.height
          WHERE EXCLUDED.height > account_balances.height`,
        [time.unix(), next.unix()]
      )

      const {
        rows: [distribution]
      } = await run(distribution_query)

      const row = {
        timestamp: time.unix(),
        timestamp_utc: time.format('YYYY-MM-DD HH:mm:ss')
      }
      for (const [column, value] of Object.entries(distribution)) {
        row[column] = column.endsWith('_account_count') ? Number(value) : value
      }
      delete row._zero_total_balance

      await db('rollup_daily').insert(row).onConflict('timestamp').merge()

      log(
        `processed ${time.format('YYYY-MM-DD')} (${changed} accounts changed)`
      )
      time = next
    }
  } finally {
    await run('DROP TABLE IF EXISTS account_balances').catch(() => {})
    await db.client.releaseConnection(connection)
  }
}

const main = async () => {
  let error
  try {
    await rollup_daily_balance_distribution({
      start_date: argv.start_date,
      days: argv.days,
      full: argv.full,
      end_date: argv.end_date
    })
  } catch (err) {
    error = err
    log(error)
  }

  process.exit(error ? 1 : 0)
}

if (isMain(import.meta.url)) {
  main()
}

export default rollup_daily_balance_distribution
