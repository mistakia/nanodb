const debug = require('debug')
const dayjs = require('dayjs')
const BigNumber = require('bignumber.js')
const utc = require('dayjs/plugin/utc')

const db = require('../db')

dayjs.extend(utc)

const logger = debug('script')
debug.enable('script')

const time = dayjs().utc().startOf('day')

const timestamps = new Map(
  Object.entries({
    _24h: time.subtract('1', 'day'),
    _1d_1w: time.subtract('1', 'week'),
    _1w_1m: time.subtract('1', 'month'),
    _1m_3m: time.subtract('3', 'month'),
    _3m_6m: time.subtract('6', 'month'),
    _6m_1y: time.subtract('1', 'year'),
    _1y_2y: time.subtract('2', 'year'),
    _2y_3y: time.subtract('3', 'year')
  })
)

const balances = new Map(
  Object.entries({
    _1000000: 1000000000000000000000000000000000000, // 1,000,000
    _100000: 100000000000000000000000000000000000, // 100,000
    _10000: 10000000000000000000000000000000000, // 10,000
    _1000: 1000000000000000000000000000000000, // 1,000
    _100: 100000000000000000000000000000000, // 100
    _10: 10000000000000000000000000000000, // 10
    _1: 1000000000000000000000000000000, // 1
    _01: 100000000000000000000000000000, // 0.1
    _001: 10000000000000000000000000000, // 0.01
    _0001: 1000000000000000000000000000, // 0.001
    _00001: 100000000000000000000000000, // 0.0001
    _000001: 10000000000000000000000000 // 0.00001
  })
)

for (const [key, value] of balances) {
  balances.set(key, BigNumber(value))
}

const main = async () => {
  const balanceRangeCounters = new Array(balances.size).fill(0)
  const balanceRangeTotals = new Array(balances.size).fill(BigNumber(0))
  let balanceBottomRangeCounter = 0
  let balanceBottomRangeTotal = BigNumber(0)

  const lastActiveRangeCounters = new Array(timestamps.size).fill(0)
  const lastActiveRangeTotals = new Array(timestamps.size).fill(BigNumber(0))
  let lastActiveBottomRangeCounter = 0
  let lastActiveBottomRangeTotal = BigNumber(0)

  const limit = 200000
  let offset = 0
  const time = dayjs().utc().startOf('day')
  let frontiers = []

  do {
    const subQuery = db('blocks')
      .select(db.raw('max(height) AS hid, account AS aid'))
      .where('local_timestamp', '<=', time.unix())
      .where('balance', '>', 1000000000000000000000000000000)
      .groupBy('account')
      .limit(limit)
      .offset(offset)

    frontiers = await db
      .select('blocks.*')
      .from(db.raw('(' + subQuery.toString() + ') AS X'))
      .innerJoin('blocks', function () {
        this.on(function () {
          this.on('account', '=', 'aid')
          this.andOn('height', '=', 'hid')
        })
      })

    for (const frontier of frontiers) {
      const frontierBalance = BigNumber(frontier.balance)
      const frontierTimestamp = dayjs.unix(frontier.local_timestamp)
      let i = 0
      const balancesIterator = balances.values()
      for (; i < balances.size; i++) {
        const balance = balancesIterator.next().value
        if (frontierBalance.isGreaterThanOrEqualTo(balance)) {
          balanceRangeCounters[i] += 1
          balanceRangeTotals[i] = balanceRangeTotals[i].plus(frontierBalance)
          break
        }
      }

      if (i === balances.size) {
        balanceBottomRangeCounter += 1
        balanceBottomRangeTotal = balanceBottomRangeTotal.plus(frontierBalance)
      }

      let t = 0
      const timestampsIterator = timestamps.values()
      for (; t < timestamps.size; t++) {
        const timestamp = timestampsIterator.next().value
        if (frontierTimestamp.isAfter(timestamp)) {
          lastActiveRangeCounters[t] += 1
          lastActiveRangeTotals[t] =
            lastActiveRangeTotals[t].plus(frontierBalance)
          break
        }
      }

      if (t === timestamps.size) {
        lastActiveBottomRangeCounter += 1
        lastActiveBottomRangeTotal =
          lastActiveBottomRangeTotal.plus(frontierBalance)
      }
    }

    logger(`returned ${frontiers.length} frontiers`)

    offset += limit
  } while (frontiers.length === limit)

  const insert = {
    _000001_below_count: balanceBottomRangeCounter,
    _000001_below_total: balanceBottomRangeTotal.toFixed(),
    _3y_plus_count: lastActiveBottomRangeCounter,
    _3y_plus_total: lastActiveBottomRangeTotal.toFixed()
  }
  const timestampsIterator = timestamps.keys()
  for (let i = 0; i < timestamps.size; i++) {
    const key = timestampsIterator.next().value
    insert[`${key}_count`] = lastActiveRangeCounters[i]
    insert[`${key}_total`] = lastActiveRangeTotals[i].toFixed()
  }

  const balancesIterator = balances.keys()
  for (let i = 0; i < balances.size; i++) {
    const key = balancesIterator.next().value
    insert[`${key}_count`] = balanceRangeCounters[i]
    insert[`${key}_total`] = balanceRangeTotals[i].toFixed()
  }
  logger(`${time.format('DD/MM/YYYY')}`, insert)
}

module.exprots = main

if (!module.parent) {
  const init = async () => {
    try {
      await main()
    } catch (err) {
      console.log(err)
    }
    process.exit()
  }

  try {
    init()
  } catch (err) {
    console.log(err)
    process.exit()
  }
}
