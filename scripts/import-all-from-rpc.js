const debug = require('debug')
const dayjs = require('dayjs')
const nanocurrency = require('nanocurrency')

const constants = require('../constants')
const db = require('../db')
const {
  getLedger,
  getChain,
  getAccountInfo,
  getBlocksInfo,
  formatBlockInfo,
  formatAccountInfo
} = require('../common')

const logger = debug('script')
debug.enable('script')

const importAccountBlocks = async (account) => {
  logger(`processing account ${account}`)

  const accountInfo = await getAccountInfo({
    account
  })

  if (accountInfo.error) return

  const blocks_batch_size = 2000
  let blockCount = 0
  let failed_attempts = 0
  let height = accountInfo.confirmed_height
  let cursor = accountInfo.confirmed_frontier
  do {
    logger(`Fetching blocks from height: ${height} (${account})`)

    const chain = await getChain({ block: cursor, count: blocks_batch_size })
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
        logger(`failed to save blocks for ${account} at height ${height}`)
        failed_attempts += 1
        if (failed_attempts > 1) {
          logger('two consecutive failed attempts, exiting')
          return
        }
      }
    }

    blockCount = chain.blocks.length
    cursor = chain.blocks[chain.blocks.length - 1]
    height = height - blocks_batch_size
  } while (blockCount === blocks_batch_size && failed_attempts < 2)

  logger(`finished processing blocks for ${account}`)
}

const main = async ({ hours, threshold, account = constants.BURN_ACCOUNT }) => {
  const accounts_batch_size = 5000
  let index = 0
  let addressCount = 0

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
    await db('accounts').insert(accountInserts).onConflict('account').merge()

    for (const account of Object.keys(accounts)) {
      await importAccountBlocks(account)
    }

    index += accounts_batch_size
    account = addresses[addressCount - 1]
  } while (addressCount === accounts_batch_size)

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
