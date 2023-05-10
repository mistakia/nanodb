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
  formatAccountInfo
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

const processAccountBlocks = async (account) => {
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
  const height = parseInt(accountInfo.confirmed_height, 10)

  while (imported_block_count < height && failed_attempts < 2) {
    logger(
      `account ${account}, height: ${height}, imported count: ${imported_block_count}, cursor: ${cursor}`
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

    if (blockInserts.length) {
      logger(`saving ${blockInserts.length} blocks`)
      try {
        await db('blocks').insert(blockInserts).onConflict('hash').merge()
        failed_attempts = 0
      } catch (err) {
        logger(err)
        logger(
          `failed to save blocks for account ${account} at height ${height}`
        )
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
  }

  logger(`finished processing blocks for ${account}`)

  return failed_attempts
}

const main = async ({
  hours,
  threshold = 0,
  include_blocks,
  account = constants.BURN_ACCOUNT
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
      for (const account of Object.keys(accounts)) {
        await processAccountBlocks(account)
      }
    }

    index += accounts_batch_size
    account = addresses[returned_address_count - 1]
  } while (returned_address_count === accounts_batch_size)

  process.exit()
}

module.exprots = main

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
        account: argv.account
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
