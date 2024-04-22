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

const rollup_daily_balance_distribution = async ({
  start_date = null,
  days = 1,
  full = false,
  end_date = null
}) => {
  let time = start_date
    ? dayjs(start_date).utc().startOf('day')
    : dayjs().utc().startOf('day')
  const end = end_date
    ? dayjs(end_date).utc().startOf('day')
    : full
    ? dayjs.unix(first_timestamp)
    : time.subtract(days, 'day')

  log(`start_date: ${start_date}, end_date: ${end_date}, full: ${full}`)

  do {
    const given_timestamp = time.unix()
    const balance_ranges_query = db
      .with(
        'ranked_blocks',
        db.raw(
          `
      SELECT
        account,
        balance,
        rank() OVER (PARTITION BY account ORDER BY height DESC) AS rank
      FROM blocks
      WHERE local_timestamp < ${given_timestamp}
    `
        )
      )
      .with(
        'latest_balances',
        db.raw(`
      SELECT account, balance
      FROM ranked_blocks
      WHERE rank = 1
    `)
      )
      .with(
        'balance_ranges',
        db.raw(`
      SELECT
        CASE
          WHEN balance = 0 THEN '_zero'
          WHEN balance >= 1000000000000000000000000000000000000 THEN '_1000000'
          WHEN balance >= 100000000000000000000000000000000000 AND balance < 1000000000000000000000000000000000000 THEN '_100000'
          WHEN balance >= 10000000000000000000000000000000000 AND balance < 100000000000000000000000000000000000 THEN '_10000'
          WHEN balance >= 10000000000000000000000000000000 AND balance < 1000000000000000000000000000000000 THEN '_1000'
          WHEN balance >= 1000000000000000000000000000000 AND balance < 10000000000000000000000000000000 THEN '_100'
          WHEN balance >= 100000000000000000000000000000 AND balance < 100000000000000000000000000000 THEN '_10'
          WHEN balance >= 10000000000000000000000000000 AND balance < 100000000000000000000000000000 THEN '_1'
          WHEN balance >= 10000000000000000000000000000 AND balance < 100000000000000000000000000000 THEN '_01'
          WHEN balance >= 1000000000000000000000000000 AND balance < 1000000000000000000000000000 THEN '_001'
          WHEN balance >= 10000000000000000000000000 AND balance < 100000000000000000000000000 THEN '_0001'
          WHEN balance >= 1000000000000000000000000 AND balance < 10000000000000000000000000 THEN '_00001'
          WHEN balance >= 100000000000000000000000 AND balance < 100000000000000000000000 THEN '_000001'
          ELSE '_000001_below'
        END AS balance_range,
        SUM(balance) AS total_balance_raw,
        COUNT(account) AS account_count
      FROM latest_balances
      GROUP BY balance_range
    `)
      )
      .select('balance_range', 'total_balance_raw', 'account_count')
      .from('balance_ranges')

    const result = await balance_ranges_query

    const insert_object = {
      timestamp: time.unix(),
      timestamp_utc: time.format('YYYY-MM-DD HH:mm:ss')
    }

    if (result && result.length > 0) {
      result.forEach((row) => {
        insert_object[`${row.balance_range}_account_count`] = row.account_count
        insert_object[`${row.balance_range}_total_balance`] =
          row.total_balance_raw
      })

      delete insert_object._zero_total_balance

      await db('rollup_daily')
        .insert(insert_object)
        .onConflict('timestamp')
        .merge()
    }

    log(`processed ${time.format('MM/DD/YYYY')}`)

    time = time.subtract(1, 'day')
  } while (time.isAfter(end))
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

export default rollup_daily_balance_distribution
