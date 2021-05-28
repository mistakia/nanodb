const yargs = require('yargs/yargs')
const debug = require('debug')

const { hideBin } = require('yargs/helpers')
const argv = yargs(hideBin(process.argv)).argv
const nanocurrency = require('nanocurrency')

const constants = require('../constants')
const db = require('../db')
const logger = debug('script')
debug.enable('script')
const {
  getFrontierCount,
  getLedger,
  getBlocksInfo,
  formatBlockInfo,
  wait
} = require('../common')

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
      count: batchSize
    })

    const addresses = Object.keys(accounts)
    addressCount = addresses.length
    logger(`${addressCount} accounts returned`)

    const accountInserts = []
    for (const address in accounts) {
      const {
        frontier,
        open_block,
        representative_block,
        balance,
        modified_timestamp,
        block_count
      } = accounts[address]
      const key = nanocurrency.derivePublicKey(address)
      accountInserts.push({
        frontier,
        open_block,
        representative_block,
        balance,
        modified_timestamp,
        block_count,
        account: address,
        key
      })
    }
    await db('accounts').insert(accountInserts).onConflict().merge()

    if (argv.b) {
      const frontierHashes = Object.values(accounts).map((a) => a.frontier)
      logger(`Fetching ${frontierHashes.length} blocks`)

      const { blocks } = await getBlocksInfo({ hashes: frontierHashes })
      const blockCount = Object.keys(blocks).length
      logger(`${blockCount} blocks returned`)

      const blockInserts = []
      for (const hash in blocks) {
        const block = blocks[hash]
        blockInserts.push({ hash, ...formatBlockInfo(block) })
      }
      await db('blocks').insert(blockInserts).onConflict().merge()
    }

    index += batchSize
    account = addresses[addressCount - 1]

    await wait(3000)
  } while (addressCount === batchSize)

  process.exit()
}

try {
  main()
} catch (e) {
  console.log(e)
}
