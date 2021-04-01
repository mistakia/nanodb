const yargs = require('yargs/yargs')
const debug = require('debug')
const { hideBin } = require('yargs/helpers')
const argv = yargs(hideBin(process.argv)).argv
const { default: fetch, Request } = require('node-fetch')
const nanocurrency = require('nanocurrency')

const constants = require('./constants')
const config = require('./config')
const db = require('./db')
const logger = debug('script')
debug.enable('script')

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

const getFrontiers = ({ account, count = 1 }) => {
  const data = {
    action: 'frontiers',
    account,
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

  const batchSize = 1000
  let index = 0
  let accountCount = 0
  let account = constants.BURN_ACCOUNT

  do {
    logger(
      `Fetching accounts from ${index} to ${index + batchSize} (${account})`
    )

    const { frontiers } = await getFrontiers({
      account,
      count: batchSize
    })

    const accounts = Object.keys(frontiers)
    accountCount = accounts.length
    logger(`${accountCount} accounts returned`)

    const accountInserts = []
    for (const account in frontiers) {
      const key = nanocurrency.derivePublicKey(account)
      accountInserts.push({
        frontier: frontiers[account],
        account,
        key
      })
    }
    await db('accounts').insert(accountInserts).onConflict().ignore()

    const frontierHashes = Object.values(frontiers)
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

    index += batchSize
    account = accounts[accountCount - 1]
  } while (accountCount === batchSize)

  process.exit()
}

try {
  main()
} catch (e) {
  console.log(e)
}
