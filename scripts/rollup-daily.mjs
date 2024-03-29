import debug from 'debug'
import dayjs from 'dayjs'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import BigNumber from 'bignumber.js'
import utc from 'dayjs/plugin/utc.js'

import constants from '#constants'
import db from '#db'
import { isMain } from '#common'

dayjs.extend(utc)

const argv = yargs(hideBin(process.argv)).argv
const first_timestamp = '1550832660' // earliest local_timestamp in blocks table
const logger = debug('calculate:blocks-per-day')
debug.enable('calculate:blocks-per-day')

const amounts = new Map(
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

for (const [key, value] of amounts) {
  amounts.set(key, BigNumber(value))
}

const main = async ({
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

  do {
    const blocks = await db('blocks')
      .where('local_timestamp', '>=', time.unix())
      .where('local_timestamp', '<', time.add(1, 'day').unix())
      .whereNot('local_timestamp', 0)

    let send_volume = BigNumber(0)
    let change_volume = BigNumber(0)
    let open_volume = BigNumber(0)
    let receive_volume = BigNumber(0)
    const counters = {
      send_count: 0,
      receive_count: 0,
      change_count: 0,
      open_count: 0
    }

    const amount_range_counters = new Array(amounts.size).fill(0)
    const amount_range_totals = new Array(amounts.size).fill(BigNumber(0))
    let amount_bottom_range_counter = 0
    let amount_bottom_range_total = BigNumber(0)

    const addresses = {}

    const process_send_amount = (block_amount) => {
      let i = 0
      const amounts_iterator = amounts.values()
      for (; i < amounts.size; i++) {
        const amount = amounts_iterator.next().value
        if (block_amount.isGreaterThanOrEqualTo(amount)) {
          amount_range_counters[i] += 1
          amount_range_totals[i] = amount_range_totals[i].plus(block_amount)
          break
        }
      }

      if (i === amounts.size) {
        amount_bottom_range_counter += 1
        amount_bottom_range_total = amount_bottom_range_total.plus(block_amount)
      }
    }

    for (const block of blocks) {
      addresses[block.account] = true
      const block_balance = BigNumber(block.balance)
      const block_amount = BigNumber(block.amount)

      switch (block.type) {
        case constants.blockType.state:
          switch (block.subtype) {
            case constants.blockSubType.send:
              send_volume = send_volume.plus(block_amount)
              process_send_amount(block_amount)
              counters.send_count += 1
              break

            case constants.blockSubType.receive:
              counters.receive_count += 1
              receive_volume = receive_volume.plus(block_amount)
              if (block.height === 1) {
                open_volume = open_volume.plus(block_amount)
                counters.open_count += 1
              }
              break

            case constants.blockSubType.change:
              counters.change_count += 1
              change_volume = change_volume.plus(block_balance)
              break
          }
          break

        case constants.blockType.send:
          send_volume = send_volume.plus(block_amount)
          process_send_amount(block_amount)
          counters.send_count += 1
          break

        case constants.blockType.receive:
          receive_volume = receive_volume.plus(block_amount)
          if (block.height === 1) {
            open_volume = open_volume.plus(block_amount)
            counters.open_count += 1
          }
          counters.receive_count += 1
          break

        case constants.blockType.change:
          change_volume = change_volume.plus(block_balance)
          counters.change_count += 1
          break
      }
    }

    const insert = {
      timestamp: time.unix(),
      timestamp_utc: time.format('YYYY-MM-DD HH:mm:ss'),
      active_addresses: Object.keys(addresses).length,
      blocks: blocks.length,
      send_volume: send_volume.toFixed(),
      change_volume: change_volume.toFixed(),
      open_volume: open_volume.toFixed(),
      receive_volume: receive_volume.toFixed(),

      _000001_below_count: amount_bottom_range_counter,
      _000001_below_total: amount_bottom_range_total.toFixed(),

      ...counters
    }

    const amounts_iterator = amounts.keys()
    for (let i = 0; i < amounts.size; i++) {
      const key = amounts_iterator.next().value
      insert[`${key}_count`] = amount_range_counters[i]
      insert[`${key}_total`] = amount_range_totals[i].toFixed()
    }

    await db('rollup_daily').insert(insert).onConflict('timestamp').merge()

    logger(`processed ${time.format('MM/DD/YYYY')}`)

    time = time.subtract(1, 'day')
  } while (time.isAfter(end))
}

if (isMain(import.meta.url)) {
  const init = async () => {
    try {
      await main({
        start_date: argv.start_date,
        days: argv.days,
        full: argv.full,
        end_date: argv.end_date
      })
    } catch (err) {
      console.error(err)
    }
    process.exit()
  }

  try {
    init()
  } catch (err) {
    console.error(err)
    process.exit()
  }
}

export default main
