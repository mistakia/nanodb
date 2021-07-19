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

  const batchSize = 5000
  let blockCount = 0
  let height = accountInfo.confirmed_height
  let cursor = accountInfo.confirmed_frontier
  do {
    logger(`Fetching blocks from height: ${height} (${account})`)

    const chain = await getChain({ block: cursor, count: batchSize })
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

    blockCount = chain.blocks.length
    cursor = chain.blocks[chain.blocks.length - 1]
    height = height - batchSize
  } while (blockCount === batchSize)

  logger(`finished processing blocks for ${account}`)
}

const main = async ({ hours, threshold }) => {
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

    for (const account of Object.keys(accounts)) {
      await importAccountBlocks(account)
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
