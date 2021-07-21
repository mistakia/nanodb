const debug = require('debug')
const dayjs = require('dayjs')

/* eslint-disable no-unused-vars */
const { getLedger } = require('../common')
const constants = require('../constants')
const db = require('../db')

const logger = debug('script')
debug.enable('script')
/* eslint-enable no-unused-vars */

const main = async ({ hours, threshold }) => {
  const batchSize = 2
  let index = 0
  let addressCount = 0
  let account = constants.BURN_ACCOUNT

  const opts = {
    count: batchSize,
    threshold
  }

  if (hours) {
    opts.modified_since = dayjs().subtract(hours, 'hours').unix()
  }

  // main
  do {
    logger(
      `Fetching accounts from ${index} to ${index + batchSize} (${account})`
    )

    const { accounts } = await getLedger({
      ...opts,
      account
    })

    const addresses = Object.keys(accounts)
    addressCount = addresses.length
    logger(`${addressCount} accounts returned`)

    // create table from query
    // union send, receive, change
    // update on conflict

    const send = db
      .select('source_account')
      .select('destination_account')
      .select(db.raw('"SEND" as type'))
      .count('* as block_count')
      .min('local_timestamp as min_timestamp')
      .max('local_timestamp as max_timestamp')
      .min('amount as min_amount')
      .max('amount as max_amount')
      .sum('amount as total_amount')
      .groupBy('source_account', 'destination_account')
      .orderBy('total_amount', 'desc')
      .from(function () {
        this.select('account as source_account')
          .select('amount')
          .select('local_timestamp')
          .from('blocks')
          .whereIn('account', addresses)
          .as('t1')

        this.select('link_account as destination_account')
          .whereIn('type', [
            constants.blockType.state,
            constants.blockType.send
          ])
          .where(function () {
            this.whereNull('subtype')
            this.orWhere('subtype', constants.blockSubType.send)
          })
      })

    const receive = db
      .select('source_account')
      .select('destination_account')
      .select(db.raw('"RECEIVE" as type'))
      .count('* as block_count')
      .min('local_timestamp as min_timestamp')
      .max('local_timestamp as max_timestamp')
      .min('amount as min_amount')
      .max('amount as max_amount')
      .sum('amount as total_amount')
      .groupBy('source_account', 'destination_account')
      .orderBy('total_amount', 'desc')
      .from(function () {
        this.select('account as source_account')
          .select('amount')
          .select('local_timestamp')
          .from('blocks')
          .whereIn('account', addresses)
          .as('t1')

        this.select('link_account as destination_account')
          .whereIn('type', [
            constants.blockType.state,
            constants.blockType.receive,
            constants.blockType.open
          ])
          .where(function () {
            this.whereNull('subtype')
            this.orWhereIn('subtype', [
              constants.blockSubType.open,
              constants.blockSubType.receive
            ])
          })
      })

    const change = db
      .select('source_account')
      .select('destination_account')
      .select(db.raw('"CHANGE" as type'))
      .count('* as block_count')
      .min('local_timestamp as min_timestamp')
      .max('local_timestamp as max_timestamp')
      .min('amount as min_amount')
      .max('amount as max_amount')
      .sum('amount as total_amount')
      .groupBy('source_account', 'destination_account')
      .orderBy('total_amount', 'desc')
      .from(function () {
        this.select('account as source_account')
          .select('amount')
          .select('local_timestamp')
          .from('blocks')
          .whereIn('account', addresses)
          .as('t1')

        this.select('representative as destination_account')
          .whereIn('type', [
            constants.blockType.state,
            constants.blockType.change
          ])
          .where(function () {
            this.whereNull('subtype')
            this.orWhere('subtype', constants.blockSubType.change)
          })
      })

    await Promise.all([
      db.raw(`INSERT INTO account_blocks_summary ${send.toString()}`),
      db.raw(`INSERT INTO account_blocks_summary ${receive.toString()}`),
      db.raw(`INSERT INTO account_blocks_summary ${change.toString()}`)
    ])

    index += batchSize
    account = addresses[addressCount - 1]
  } while (addressCount === batchSize)

  process.exit()
}

module.exprots = main

if (!module.parent) {
  const yargs = require('yargs/yargs')
  const { hideBin } = require('yargs/helpers')
  const argv = yargs(hideBin(process.argv)).argv

  const init = async () => {
    try {
      const hours = argv.hours
      const threshold = argv.threshold
      await main({ hours, threshold })
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
