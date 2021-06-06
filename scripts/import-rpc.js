const yargs = require('yargs/yargs')
const debug = require('debug')

const { hideBin } = require('yargs/helpers')
const argv = yargs(hideBin(process.argv)).argv
const nanocurrency = require('nanocurrency')

const constants = require('../constants')
const db = require('../db')
const logger = debug('rpc')
debug.enable('rpc')
const {
  getFrontierCount,
  getLedger,
  getChain,
  getBlocksInfo,
  formatBlockInfo,
  formatAccountInfo
} = require('../common')

let queue = []

const processQueue = async () => {
  if (queue.length < 10000) {
    return
  }

  const { blocks } = await getBlocksInfo({ hashes: queue })
  const blockInserts = []
  for (const hash in blocks) {
    const block = blocks[hash]
    blockInserts.push({ hash, ...formatBlockInfo(block) })
  }

  if (blockInserts.length) {
    logger(`saving ${blockInserts.length} blocks`)
    await db('blocks').insert(blockInserts).onConflict().merge()
  }

  queue = []
}

const processAccountBlocks = async ({ account, frontier }) => {
  logger(`Fetching blocks for ${account}`)

  const batchSize = 1000
  let chain
  let cursor = frontier
  do {
    chain = await getChain({ block: cursor, count: batchSize })
    cursor = chain.blocks[chain.blocks.length - 1]
    queue = queue.concat(chain.blocks)
    await processQueue()
  } while (chain.blocks.length === batchSize)
}

const main = async () => {
  const { count } = await getFrontierCount()
  logger(`Frontier Count: ${count}`)

  const batchSize = 5000
  let index = 0
  let addressCount = 0
  let account = constants.BURN_ACCOUNT

  do {
    logger(
      `Fetching accounts from ${index} to ${index + batchSize} (${account})`
    )

    const { accounts } = await getLedger({
      account,
      count: batchSize,
      threshold: argv.threshold
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

    if (argv.b) {
      for (const [account, accountInfo] of Object.entries(accounts)) {
        const { frontier } = accountInfo
        await processAccountBlocks({ frontier, account })
      }
    }

    index += batchSize
    account = addresses[addressCount - 1]
  } while (addressCount === batchSize)

  process.exit()
}

try {
  main()
} catch (e) {
  console.log(e)
}
