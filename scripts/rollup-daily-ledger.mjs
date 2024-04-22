import debug from 'debug'
import dayjs from 'dayjs'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import utc from 'dayjs/plugin/utc.js'
import BigNumber from 'bignumber.js'

import db from '#db'
import { isMain } from '#common'

dayjs.extend(utc)

const argv = yargs(hideBin(process.argv)).argv
const log = debug('rollup-daily-balance-distribution')
debug.enable('rollup-daily-balance-distribution')

const first_timestamp = '1550832660' // earliest local_timestamp in blocks table

const get_daily_stats = ({ account_frontiers, time }) => {
  const balance_ranges = new Map(
    Object.entries({
      _1000000: new BigNumber(1e39),
      _100000: new BigNumber(1e38),
      _10000: new BigNumber(1e37),
      _1000: new BigNumber(1e36),
      _100: new BigNumber(1e35),
      _10: new BigNumber(1e34),
      _1: new BigNumber(1e33),
      _01: new BigNumber(1e32),
      _001: new BigNumber(1e31),
      _0001: new BigNumber(1e30),
      _00001: new BigNumber(1e29),
      _000001: new BigNumber(1e28),
      _000001_below: new BigNumber(0)
    })
  )

  const account_counts = {}
  const total_balances = {}

  balance_ranges.forEach((value, range_base_key) => {
    account_counts[`${range_base_key}_account_count`] = 0
    total_balances[`${range_base_key}_total_balance`] = new BigNumber(0)
  })

  account_counts._zero_account_count = 0
  total_balances._zero_total_balance = new BigNumber(0)

  for (const account_frontier of account_frontiers) {
    const { balance } = account_frontier
    let balance_range_key = new BigNumber(balance).isZero()
      ? '_zero'
      : '_000001_below' // Handle zero balance

    if (balance_range_key !== '_zero') {
      for (const [range_base_key, value] of balance_ranges) {
        if (new BigNumber(balance).gte(value)) {
          balance_range_key = range_base_key
          break
        }
      }
    }

    account_counts[`${balance_range_key}_account_count`]++
    total_balances[`${balance_range_key}_total_balance`] =
      total_balances[`${balance_range_key}_total_balance`].plus(balance)
  }

  const result = {
    timestamp: time.unix(),
    timestamp_utc: time.format('YYYY-MM-DD HH:mm:ss'),
    ...account_counts
  }

  Object.keys(total_balances).forEach(key => {
    result[key] = total_balances[key].toNumber()
  })
  delete result._zero_total_balance

  return result
}

const rollup_daily_balance_distribution = async ({
  start_date = null,
  days = null,
  full = false,
  end_date = null
}) => {
  let time = start_date
    ? dayjs(start_date).utc().startOf('day')
    : dayjs.unix(first_timestamp).utc().startOf('day')

  let end
  if (end_date) {
    end = dayjs(end_date).utc().startOf('day')
  } else if (days) {
    end = time.add(days, 'day')
  } else {
    end = dayjs().utc().startOf('day')
  }

  log(
    `start_date: ${time.format('MM/DD/YYYY')}, end_date: ${end.format(
      'MM/DD/YYYY'
    )}, full: ${full}, days: ${days}`
  )

  // calculate frontiers at start
  const account_frontiers = await db
    .with(
      'ranked_blocks',
      db.raw(`
    SELECT
      account,
      balance,
      rank() OVER (PARTITION BY account ORDER BY height DESC) AS rank
    FROM blocks
    WHERE local_timestamp <= ${time.unix()}
  `)
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
      'account_tags',
      db.raw(`
    SELECT 
      accounts_tags.account, 
      array_agg(tag) as tags
    FROM accounts_tags
    JOIN latest_balances ON accounts_tags.account = latest_balances.account
    GROUP BY accounts_tags.account
  `)
    )
    .select(
      'latest_balances.account',
      'latest_balances.balance',
      'account_tags.tags'
    )
    .from('latest_balances')
    .leftJoin('account_tags', 'account_tags.account', 'latest_balances.account')

  const account_frontiers_cache = {}
  account_frontiers.forEach((frontier) => {
    account_frontiers_cache[frontier.account] = frontier
  })

  log(`account_frontiers: ${account_frontiers.length}`)

  do {
    // go through blocks produced that day, update frontiers
    const daily_account_state_changes = await db
      .with(
        'daily_blocks',
        db.raw(`
      SELECT
        account,
        balance,
        rank() OVER (PARTITION BY account ORDER BY height DESC) AS rank
      FROM blocks
      WHERE local_timestamp >= ${time.unix()}
        AND local_timestamp < ${time.add(1, 'day').unix()}
    `)
      )
      .with(
        'latest_daily_balances',
        db.raw(`
      SELECT account, balance
      FROM daily_blocks
      WHERE rank = 1
    `)
      )
      .with(
        'daily_account_tags',
        db.raw(`
      SELECT 
        accounts_tags.account, 
        array_agg(tag) as tags
      FROM accounts_tags
      JOIN latest_daily_balances ON accounts_tags.account = latest_daily_balances.account
      GROUP BY accounts_tags.account
    `)
      )
      .select(
        'latest_daily_balances.account',
        'latest_daily_balances.balance',
        'daily_account_tags.tags'
      )
      .from('latest_daily_balances')
      .leftJoin(
        'daily_account_tags',
        'daily_account_tags.account',
        'latest_daily_balances.account'
      )

    // update account_frontiers
    daily_account_state_changes.forEach((change) => {
      account_frontiers_cache[change.account] = change
    })

    // generate daily stats
    const daily_stats = get_daily_stats({
      account_frontiers: Object.values(account_frontiers_cache),
      time
    })

    // save daily stats
    await db('rollup_daily').insert(daily_stats).onConflict('timestamp').merge()

    log(`processed ${time.format('MM/DD/YYYY')}`)

    time = time.add(1, 'day')
  } while (time.isBefore(end))
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
