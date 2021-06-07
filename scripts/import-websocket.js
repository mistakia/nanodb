const ReconnectingWebSocket = require('reconnecting-websocket')
const { default: PQueue } = require('p-queue')
const WS = require('ws')
const debug = require('debug')
const dayjs = require('dayjs')
const nanocurrency = require('nanocurrency')

const {
  getAccountInfo,
  getBlocksInfo,
  getLedger,
  formatBlockInfo,
  getChain,
  wait
} = require('../common')
const constants = require('../constants')
const config = require('../config')
const db = require('../db')

const logger = debug('ws')
debug.enable('ws')

const MIN_BATCH_SIZE = 1000
const queue = new PQueue({ concurrency: 1 })
let frontiersQueue = {}
let blocksQueue = []

let queueAccount = constants.BURN_ACCOUNT

queue.on('idle', async () => {
  logger('idle - searching for accounts to update')
  const { accounts } = await getLedger({
    account: queueAccount,
    count: 100,
    sorting: true,
    threshold: 0,
    modified_since: dayjs().subtract(3, 'days').unix()
  })

  if (!accounts) {
    queueAccount = constants.BURN_ACCOUNT
    await wait(60000)
    return
  }

  const addresses = Object.keys(accounts)
  queueAccount = addresses[addresses.length - 1]

  logger(`found ${addresses.length} accounts to process`)

  for (const address of addresses) {
    queue.add(() => processFrontiers(address))
  }
})

const processFrontiers = async (account) => {
  logger(`processing account ${account}`)

  const accountInfo = await getAccountInfo({ account })
  if (accountInfo.error) return

  const result = await db('blocks').count('* as blockCount').where({ account })
  if (!result.length) {
    return
  }

  let { blockCount } = result[0]
  let cursor = accountInfo.frontier
  const height = parseInt(accountInfo.block_count, 10)
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

const upsertBlocks = async () => {
  const hashes = [...blocksQueue]
  logger(`processing ${hashes.length} blocks`)

  // clear blocks queue
  blocksQueue = []

  // get blocks via rpc
  const res = await getBlocksInfo({ hashes })
  const blockInserts = []
  for (const hash in res.blocks) {
    const block = res.blocks[hash]
    blockInserts.push({ hash, ...formatBlockInfo(block) })
  }

  if (blockInserts.length) {
    logger(`saving ${blockInserts.length} blocks`)
    await db('blocks').insert(blockInserts).onConflict().merge()
  }

  setTimeout(upsertBlocks, 20000)
}

const upsertFrontiers = async () => {
  const accounts = Object.keys(frontiersQueue)
  logger(`processing ${accounts.length} accounts`)

  // clear frontiers queue
  frontiersQueue = {}

  const accountInserts = []
  for (const account of accounts) {
    const accountInfo = await getAccountInfo({ account })
    if (accountInfo.error) continue
    accountInserts.push({
      account,
      frontier: accountInfo.confirmed_frontier,
      open_block: accountInfo.open_block,
      representative_block: accountInfo.representative_block,
      balance: accountInfo.confirmed_balance,
      modified_timestamp: accountInfo.modified_timestamp,
      block_count: accountInfo.block_count,
      confirmation_height: accountInfo.confirmed_height,
      representative: accountInfo.confirmed_representative,
      weight: accountInfo.weight,
      pending: accountInfo.confirmed_pending,
      key: nanocurrency.derivePublicKey(account)
    })
  }

  if (accountInserts.length) {
    logger(`saving ${accountInserts.length} accounts`)
    await db('accounts').insert(accountInserts).onConflict().merge()
  }

  setTimeout(upsertFrontiers, 60000)
}

const ws = new ReconnectingWebSocket(config.websocketAddress, [], {
  WebSocket: WS,
  connectionTimeout: 1000,
  maxRetries: 100000,
  maxReconnectionDelay: 2000,
  minReconnectionDelay: 10
})

ws.onopen = () => {
  logger('connected')
  const subscription = {
    action: 'subscribe',
    topic: 'confirmation',
    options: {
      confirmation_type: 'active_quorum'
    }
  }
  ws.send(JSON.stringify(subscription))

  setTimeout(upsertBlocks, 20000)
  setTimeout(upsertFrontiers, 60000)
}

ws.onclose = () => {
  logger('disconnected')
}

ws.onerror = (err) => {
  logger('error:', err)
}

ws.onmessage = (msg) => {
  const { topic, message } = JSON.parse(msg.data)
  const { account, hash } = message

  if (topic === 'confirmation') {
    logger(`received block: ${hash}`)

    // queue for block upsert
    blocksQueue.push(hash)

    // queue for frontier upsert
    frontiersQueue[account] = true

    // queue for processor
    if (queue.size < 1000) {
      queue.add(() => processFrontiers(account))
    }
  }
}
