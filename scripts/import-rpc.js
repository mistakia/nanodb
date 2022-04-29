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

const MIN_BATCH_SIZE = 1000

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
 *     await db('blocks').insert(blockInserts).onConflict().merge()
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
    .onConflict()
    .merge()

  const result = await db('blocks').count('* as blockCount').where({ account })
  if (!result.length) {
    return
  }

  let { blockCount } = result[0]
  let cursor = accountInfo.frontier
  const height = parseInt(accountInfo.confirmed_height, 10)
  logger(
    `found ${blockCount} blocks for account ${account} with height ${height}`
  )

  while (blockCount < height) {
    logger(
      `account height: ${height}, current count: ${blockCount}, cursor: ${cursor}`
    )
    const batchSize = Math.min(accountInfo.block_count, MIN_BATCH_SIZE)
    const chain = await getChain({ block: cursor, count: batchSize })
    cursor = chain.blocks[chain.blocks.length - 1]
    const { blocks } = await getBlocksInfo({ hashes: chain.blocks })

    const blockInserts = []
    for (const hash in blocks) {
      const block = blocks[hash]
      blockInserts.push({ hash, ...formatBlockInfo(block) })
    }

    if (blockInserts.length) {
      logger(`saving ${blockInserts.length} blocks`)
      await db('blocks').insert(blockInserts).onConflict().merge()
    }

    // update count
    const result = await db('blocks')
      .count('* as blockCount')
      .where({ account })
    blockCount = result[0].blockCount
  }

  logger(`finished processing blocks for ${account}`)
}

const main = async ({ hours, threshold = 0, includeBlocks } = {}) => {
  const { count } = await getFrontierCount()
  logger(`Frontier Count: ${count}`)

  const batchSize = 5000
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
    await db('accounts').insert(accountInserts).onConflict().merge()

    if (includeBlocks) {
      for (const account of Object.keys(accounts)) {
        await processAccountBlocks(account)
      }
    }

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
      await main({ hours, threshold, includeBlocks: argv.blocks })
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
