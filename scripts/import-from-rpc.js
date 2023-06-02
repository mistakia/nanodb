const debug = require('debug')
const dayjs = require('dayjs')

const nanocurrency = require('nanocurrency')

const constants = require('../constants')
const db = require('../db')
const {
  getFrontierCount,
  getLedger,
  getChain,
  getAccountInfo,
  getBlocksInfo,
  formatBlockInfo,
  formatAccountInfo,
  wait
} = require('../common')

const logger = debug('rpc')
debug.enable('rpc')

const BLOCKS_BATCH_SIZE = 1000

/* let queue = []
 * const processQueue = async () => {
 *   if (queue.length < 10000) {
 *     return
 *   }
 *
 *   const { blocks } = await getBlocksInfo({ hashes: queue })
 *   const blockInserts = []
 *   for (const hash in blocks) {
 *     const block = blocks[hash]
 *     blockInserts.push({ hash, ...formatBlockInfo(block) })
 *   }
 *
 *   if (blockInserts.length) {
 *     logger(`saving ${blockInserts.length} blocks`)
 *     await db('blocks').insert(blockInserts).onConflict('hash').merge()
 *   }
 *
 *   queue = []
 * }
 *  */

const processAccountBlocks = async ({
  account,
  all_blocks = false,
  delay = 0
}) => {
  logger(`processing account ${account}`)

  const accountInfo = await getAccountInfo({
    account
  })

  if (accountInfo.error) return

  const key = nanocurrency.derivePublicKey(account)
  db('accounts')
    .insert({
      key,
      account,
      ...formatAccountInfo(accountInfo)
    })
    .onConflict('account')
    .merge()

  const result = await db('blocks')
    .count('* as imported_block_count')
    .where({ account })
  if (!result.length) {
    return
  }

  let { imported_block_count } = result[0]
  let cursor = accountInfo.frontier
  let failed_attempts = 0
  const frontier_height = parseInt(accountInfo.confirmed_height, 10)
  let block_height_cursor = frontier_height

  while (
    (all_blocks
      ? block_height_cursor > 1
      : imported_block_count < frontier_height) &&
    failed_attempts < 2
  ) {
    logger(
      `account ${account}, height: ${frontier_height}, imported count: ${imported_block_count}, cursor: ${cursor}`
    )
    const batch_size = Math.min(accountInfo.block_count, BLOCKS_BATCH_SIZE)
    const chain = await getChain({ block: cursor, count: batch_size })
    cursor = chain.blocks[chain.blocks.length - 1]
    const { blocks } = await getBlocksInfo({ hashes: chain.blocks })

    const blockInserts = []
    for (const hash in blocks) {
      const block = blocks[hash]
      blockInserts.push({ hash, ...formatBlockInfo(block) })
    }

    block_height_cursor = blockInserts[blockInserts.length - 1].height

    if (blockInserts.length) {
      logger(`saving ${blockInserts.length} blocks`)
      try {
        await db.raw(
          `INSERT INTO blocks (amount, balance, height, local_timestamp, confirmed, account, previous, representative, link, link_account, signature, work, type, subtype, hash) VALUES ${blockInserts
            .map(
              (block) =>
                `(${block.amount}, ${block.balance}, ${block.height}, ${block.local_timestamp}, ${block.confirmed}, '${block.account}', '${block.previous}', '${block.representative}', '${block.link}', '${block.link_account}', '${block.signature}', '${block.work}', '${block.type}', '${block.subtype}', '${block.hash}')`
            )
            .join(', ')}
            ON CONFLICT (hash) DO UPDATE SET local_timestamp = LEAST(blocks.local_timestamp, EXCLUDED.local_timestamp), confirmed = EXCLUDED.confirmed, height = EXCLUDED.height, amount = EXCLUDED.amount, balance = EXCLUDED.balance, previous = EXCLUDED.previous, representative = EXCLUDED.representative, link = EXCLUDED.link, link_account = EXCLUDED.link_account, signature = EXCLUDED.signature, work = EXCLUDED.work, type = EXCLUDED.type, subtype = EXCLUDED.subtype`
        )
        failed_attempts = 0
      } catch (err) {
        logger(err)
        logger(`failed to save blocks for account ${account}`)
        failed_attempts += 1
        if (failed_attempts > 1) {
          logger('consecutive failed attempts, exiting')
          process.exit()
        }
      }
    }

    // update count
    const result = await db('blocks')
      .count('* as imported_block_count')
      .where({ account })
    imported_block_count = result[0].imported_block_count

    if (delay) {
      await wait(delay)
    }
  }

  logger(`finished processing blocks for ${account}`)

  return failed_attempts
}

const main = async ({
  hours,
  threshold = 0,
  include_blocks,
  account = constants.BURN_ACCOUNT,
  all_blocks = false,
  delay = 0,
  skip = false
} = {}) => {
  const { count } = await getFrontierCount()
  logger(`Frontier Count: ${count}`)

  const accounts_batch_size = 5000
  let index = 0
  let returned_address_count = 0

  const opts = {
    count: accounts_batch_size,
    threshold
  }

  if (hours) {
    opts.modified_since = dayjs().subtract(hours, 'hours').unix()
  }

  do {
    logger(
      `Fetching accounts from ${index} to ${
        index + accounts_batch_size
      } (${account})`
    )

    const { accounts } = await getLedger({
      ...opts,
      account
    })

    const addresses = Object.keys(accounts)
    returned_address_count = addresses.length
    logger(`${returned_address_count} accounts returned`)

    const accountInserts = []
    for (const address in accounts) {
      const accountInfo = formatAccountInfo(accounts[address])
      const key = nanocurrency.derivePublicKey(address)
      accountInserts.push({
        key,
        account: address,
        ...accountInfo
      })
    }
    await db('accounts').insert(accountInserts).onConflict('account').merge()

    if (include_blocks) {
      const account_keys = Object.keys(accounts)
      for (const account of skip ? account_keys.slice(1) : account_keys) {
        await processAccountBlocks({ account, all_blocks, delay })
      }
    }

    index += accounts_batch_size
    account = addresses[returned_address_count - 1]
  } while (returned_address_count === accounts_batch_size)

  process.exit()
}

module.exports = main

if (!module.parent) {
  const yargs = require('yargs/yargs')
  const { hideBin } = require('yargs/helpers')
  const argv = yargs(hideBin(process.argv)).argv

  const init = async () => {
    try {
      await main({
        hours: argv.hours,
        threshold: argv.threshold,
        include_blocks: argv.blocks,
        account: argv.account,
        all_blocks: argv.all_blocks,
        delay: argv.delay,
        skip: argv.skip
      })
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
