const debug = require('debug')
const dayjs = require('dayjs')
const BigNumber = require('bignumber.js')
const utc = require('dayjs/plugin/utc')
const yargs = require('yargs/yargs')
const { hideBin } = require('yargs/helpers')

const constants = require('../constants')
const db = require('../db')

dayjs.extend(utc)

const argv = yargs(hideBin(process.argv)).argv
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

const main = async () => {
  const inserts = []
  let time = dayjs().utc().startOf('day')
  const end = argv.full ? dayjs('1550832660', 'X') : time.subtract('1', 'day')

  do {
    const blocks = await db('blocks')
      .where('local_timestamp', '>=', time.unix())
      .where('local_timestamp', '<', time.add('1', 'day').unix())
      .whereNot('local_timestamp', 0)

    let sendVolume = BigNumber(0)
    let changeVolume = BigNumber(0)
    const counters = {
      send_count: 0,
      receive_count: 0,
      change_count: 0,
      open_count: 0
    }

    const amountRangeCounters = new Array(amounts.size).fill(0)
    const amountRangeTotals = new Array(amounts.size).fill(BigNumber(0))
    let amountBottomRangeCounter = 0
    let amountBottomRangeTotal = BigNumber(0)

    const addresses = {}

    const processSendAmount = (blockAmount) => {
      let i = 0
      const amountsIterator = amounts.values()
      for (; i < amounts.size; i++) {
        const amount = amountsIterator.next().value
        if (blockAmount.isGreaterThanOrEqualTo(amount)) {
          amountRangeCounters[i] += 1
          amountRangeTotals[i] = amountRangeTotals[i].plus(blockAmount)
          break
        }
      }

      if (i === amounts.size) {
        amountBottomRangeCounter += 1
        amountBottomRangeTotal = amountBottomRangeTotal.plus(blockAmount)
      }
    }

    for (const block of blocks) {
      addresses[block.account] = true
      const blockBalance = BigNumber(block.balance)
      const blockAmount = BigNumber(block.amount)
      sendVolume = sendVolume.plus(blockAmount)

      switch (block.type) {
        case constants.blockType.state:
          switch (block.subtype) {
            case constants.blockSubType.send:
              processSendAmount(blockAmount)
              counters.send_count += 1
              break

            case constants.blockSubType.receive:
              counters.receive_count += 1
              if (block.height === 1) counters.open_count += 1
              break

            case constants.blockSubType.change:
              counters.change_count += 1
              changeVolume = changeVolume.plus(blockBalance)
              break
          }
          break

        case constants.blockType.send:
          processSendAmount(blockAmount)
          counters.send_count += 1
          break

        case constants.blockType.receive:
          if (block.height === 1) counters.open_count += 1
          counters.receive_count += 1
          break

        case constants.blockType.change:
          changeVolume = changeVolume.plus(blockBalance)
          counters.change_count += 1
          break
      }
    }

    const insert = {
      timestamp: time.unix(),
      active_addresses: Object.keys(addresses).length,
      blocks: blocks.length,
      send_volume: sendVolume.toFixed(),
      change_volume: changeVolume.toFixed(),

      _000001_below_count: amountBottomRangeCounter,
      _000001_below_total: amountBottomRangeTotal.toFixed(),

      ...counters
    }

    const amountsIterator = amounts.keys()
    for (let i = 0; i < amounts.size; i++) {
      const key = amountsIterator.next().value
      insert[`${key}_count`] = amountRangeCounters[i]
      insert[`${key}_total`] = amountRangeTotals[i].toFixed()
    }

    inserts.push(insert)

    logger(`processed ${time.format('MM/DD/YYYY')}`)

    time = time.subtract('1', 'day')
  } while (time.isAfter(end))

  await db('rollup_daily').insert(inserts).onConflict().merge()
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
