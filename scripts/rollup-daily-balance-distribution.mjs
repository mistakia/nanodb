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

class BigMap {
  constructor(iterable) {
    if (iterable)
      throw new Error("haven't implemented construction with iterable yet")
    this._maps = [new Map()]
    this._perMapSizeLimit = 10000000
    this.size = 0
  }

  has(key) {
    for (const map of this._maps) {
      if (map.has(key)) return true
    }
    return false
  }

  get(key) {
    for (const map of this._maps) {
      if (map.has(key)) return map.get(key)
    }
    return undefined
  }

  set(key, value) {
    for (const map of this._maps) {
      if (map.has(key)) {
        map.set(key, value)
        return this
      }
    }
    let map = this._maps[this._maps.length - 1]
    if (map.size > this._perMapSizeLimit) {
      map = new Map()
      this._maps.push(map)
    }
    map.set(key, value)
    this.size++
    return this
  }

  entries() {
    let mapIndex = 0
    let entries = this._maps[mapIndex].entries()
    return {
      next: () => {
        const n = entries.next()
        if (n.done) {
          if (this._maps[++mapIndex]) {
            entries = this._maps[mapIndex].entries()
            return entries.next()
          } else {
            return { done: true }
          }
        } else {
          return n
        }
      }
    }
  }

  [Symbol.iterator]() {
    return this.entries()
  }

  delete(key) {
    throw new Error("haven't implemented this yet")
  }

  keys() {
    throw new Error("haven't implemented this yet")
  }

  values() {
    throw new Error("haven't implemented this yet")
  }

  forEach(fn) {
    for (const map of this._maps) {
      map.forEach(fn)
    }
  }

  clear() {
    throw new Error("haven't implemented this yet")
  }
}

const get_daily_stats = ({ account_frontiers_cache, time }) => {
  const balance_ranges = [
    { key: '_1000000', value: 1000000000000000000000000000000000000n }, // 1M
    { key: '_100000', value: 100000000000000000000000000000000000n }, // 100K
    { key: '_10000', value: 10000000000000000000000000000000000n }, // 10K
    { key: '_1000', value: 1000000000000000000000000000000000n }, // 1K
    { key: '_100', value: 100000000000000000000000000000000n }, // 100
    { key: '_10', value: 10000000000000000000000000000000n }, // 10
    { key: '_1', value: 1000000000000000000000000000000n }, // 1
    { key: '_01', value: 100000000000000000000000000000n }, // 0.1
    { key: '_001', value: 10000000000000000000000000000n }, // 0.01
    { key: '_0001', value: 1000000000000000000000000000n }, // 0.001
    { key: '_00001', value: 100000000000000000000000000n }, // 0.0001
    { key: '_000001', value: 10000000000000000000000000n }, // 0.00001
    { key: '_000001_below', value: 0 }
  ].map((range) => ({ ...range, value: new BigNumber(range.value) }))

  const account_counts = {}
  const total_balances = {}

  balance_ranges.forEach(({ key }) => {
    account_counts[`${key}_account_count`] = 0
    total_balances[`${key}_total_balance`] = new BigNumber(0)
  })

  account_counts._zero_account_count = 0
  total_balances._zero_total_balance = new BigNumber(0)

  account_frontiers_cache.forEach(({ balance }) => {
    let balance_range_key = balance.isZero() ? '_zero' : '_000001_below'

    if (balance_range_key !== '_zero') {
      for (const { key, value } of balance_ranges) {
        if (balance.gte(value)) {
          balance_range_key = key
          break
        }
      }
    }

    account_counts[`${balance_range_key}_account_count`]++
    total_balances[`${balance_range_key}_total_balance`] =
      total_balances[`${balance_range_key}_total_balance`].plus(balance)
  })

  const result = {
    timestamp: time.unix(),
    timestamp_utc: time.format('YYYY-MM-DD HH:mm:ss'),
    ...account_counts
  }

  Object.keys(total_balances).forEach((key) => {
    result[key] = total_balances[key].toNumber()
  })
  delete result._zero_total_balance

  return result
}

// Rollup daily balance distribution going forward in time
const rollup_daily_balance_distribution = async ({
  start_date = null, // the start date for processing. defaults to one day prior to the last completed UTC day.
  days = 1, // the number of days to process.
  full = false, // whether to process the full range.
  end_date = null // the end date for processing. defaults to the last completed UTC day.
}) => {
  // Determine the start time based on the provided start_date or days
  let time = start_date
    ? dayjs(start_date).utc().startOf('day')
    : full
    ? dayjs.unix(first_timestamp).utc().startOf('day')
    : dayjs.utc().subtract(1, 'day').subtract(days, 'day').startOf('day')

  // Determine the end time based on the provided end_date
  let end
  if (end_date) {
    end = dayjs(end_date).utc().startOf('day')
  } else {
    end = dayjs().utc().subtract(1, 'day').startOf('day')
  }

  log(
    `start_date: ${time.format('MM/DD/YYYY')}, end_date: ${end.format(
      'MM/DD/YYYY'
    )}, full: ${full}, days: ${days}`
  )

  // Calculate frontiers at the start
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

  // Cache the account frontiers
  const account_frontiers_cache = new BigMap()
  account_frontiers.forEach((frontier) => {
    const { account, balance } = frontier
    account_frontiers_cache.set(account, {
      account,
      balance: new BigNumber(balance)
    })
  })

  log(`account_frontiers: ${account_frontiers.length}`)

  do {
    // Go through blocks produced that day and update frontiers
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

    log(`daily_account_state_changes: ${daily_account_state_changes.length}`)

    // Update account frontiers
    daily_account_state_changes.forEach((change) => {
      if (change && change.account) {
        const { account, balance } = change
        account_frontiers_cache.set(account, {
          account,
          balance: new BigNumber(balance)
        })
      } else {
        log('Invalid account state change:', change)
        throw new Error('Invalid account state change')
      }
    })

    log(`calculating daily stats for ${account_frontiers_cache.size} accounts`)

    // Generate daily stats
    const daily_stats = get_daily_stats({
      account_frontiers_cache,
      time
    })

    // Save daily stats
    await db('rollup_daily').insert(daily_stats).onConflict('timestamp').merge()

    log(`processed ${time.format('MM/DD/YYYY')}`)

    // Move to the next day
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
