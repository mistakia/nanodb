const yargs = require('yargs/yargs')
const debug = require('debug')
const path = require('path')
const fs = require('fs')
const { hideBin } = require('yargs/helpers')
const argv = yargs(hideBin(process.argv)).argv
const { default: fetch, Request } = require('node-fetch')
const nanocurrency = require('nanocurrency')

const constants = require('../constants')
const config = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', 'config.json')))
const db = require('../db')
const logger = debug('script')
debug.enable('script')

const wait = ms => new Promise(resolve => setTimeout(resolve, ms))

const POST = (data) => ({
  method: 'POST',
  body: JSON.stringify(data),
  headers: {
    'Content-Type': 'application/json'
  }
})

const request = async (options) => {
  const request = new Request(options.url, options)
  const response = await fetch(request)
  if (response.status >= 200 && response.status < 300) {
    return response.json()
  } else {
    const res = await response.json()
    const error = new Error(res.error || response.statusText)
    error.response = response
    throw error
  }
}

const rpcRequest = (data) => {
  return { url: config.nodeAddress, ...POST(data) }
}

const getFrontierCount = () => {
  const data = {
    action: 'frontier_count'
  }
  const options = rpcRequest(data)
  return request(options)
}

const getLedger = ({ account, count = 1, threshold = 100000000000000000 }) => {
  const data = {
    action: 'ledger',
    pending: true,
    account,
    threshold,
    count
  }
  const options = rpcRequest(data)
  return request(options)
}

const getBlocksInfo = ({ hashes }) => {
  const data = {
    action: 'blocks_info',
    json_block: true,
    hashes
  }
  const options = rpcRequest(data)
  return request(options)
}

const formatBlockInfo = ({
  block_account,
  amount,
  balance,
  height,
  local_timestamp,
  confirmed,
  contents,
  subtype
}) => ({
  block_account,
  amount,
  balance,
  height,
  local_timestamp,
  confirmed: confirmed === 'true',
  ...contents,
  type: constants.blockType[contents.type],
  subtype: constants.blockSubType[subtype]
})

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
