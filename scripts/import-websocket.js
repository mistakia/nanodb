const ReconnectingWebSocket = require('reconnecting-websocket')
const { default: PQueue } = require('p-queue')
const WS = require('ws')
const debug = require('debug')
const nanocurrency = require('nanocurrency')
const constants = require('../constants')
const dayjs = require('dayjs')
// const yargs = require('yargs/yargs')
// const { hideBin } = require('yargs/helpers')

// const argv = yargs(hideBin(process.argv)).argv

const {
  getAccountInfo,
  getBlocksInfo,
  formatBlockInfo,
  formatAccountInfo,
  getLedger,
  getChain
} = require('../common')
const config = require('../config')
const db = require('../db')

const logger = debug('ws')
debug.enable('ws')

const MIN_BATCH_SIZE = 1000
const account_check_queue = new PQueue({ concurrency: 1 })
const account_update_queue = new PQueue({ concurrency: 1 })
let frontiers_queue = {}
let blocks_queue = []

const update_account = async ({ account, accountInfo, blockCount }) => {
  let cursor = accountInfo.frontier
  const height = Number(accountInfo.block_count)

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
      await db('blocks').insert(blockInserts).onConflict('hash').merge()
    }

    // update count
    const result = await db('blocks')
      .count('* as blockCount')
      .where({ account })
    blockCount = result[0].blockCount
  }

  logger(`finished processing blocks for ${account}`)
}

/* const check_account = async (account) => {
 *   logger(`processing account ${account}`)
 *
 *   const accountInfo = await getAccountInfo({ account })
 *   if (accountInfo.error) return
 *
 *   const key = nanocurrency.derivePublicKey(account)
 *   db('accounts')
 *     .insert({
 *       key,
 *       account,
 *       ...formatAccountInfo(accountInfo)
 *     })
 *     .onConflict('account')
 *     .merge()
 *
 *   const result = await db('blocks').count('* as blockCount').where({ account })
 *   if (!result.length) {
 *     return
 *   }
 *
 *   const { blockCount } = result[0]
 *   const height = parseInt(accountInfo.block_count, 10)
 *   logger(
 *     `found ${blockCount} blocks for account ${account} with height ${height}`
 *   )
 *
 *   if (blockCount < height) {
 *     account_update_queue.add(() =>
 *       update_account({ account, accountInfo, blockCount })
 *     )
 *   }
 * }
 *  */

const save_blocks = async () => {
  const hashes = [...blocks_queue]
  logger(`processing ${hashes.length} blocks`)

  // clear blocks queue
  blocks_queue = []

  // get blocks via rpc
  const res = await getBlocksInfo({ hashes })
  const blockInserts = []
  for (const hash in res.blocks) {
    const block = res.blocks[hash]
    blockInserts.push({ hash, ...formatBlockInfo(block) })
  }

  if (blockInserts.length) {
    logger(`saving ${blockInserts.length} blocks`)
    await db('blocks').insert(blockInserts).onConflict('hash').merge()
  }

  setTimeout(save_blocks, 20000)
}

const save_frontiers = async () => {
  const accounts = Object.keys(frontiers_queue)
  logger(`processing ${accounts.length} accounts`)

  // clear frontiers queue
  frontiers_queue = {}

  const accountInserts = []
  for (const account of accounts) {
    const accountInfo = await getAccountInfo({ account })
    if (accountInfo.error) continue
    const key = nanocurrency.derivePublicKey(account)
    accountInserts.push({
      key,
      account,
      ...formatAccountInfo(accountInfo)
    })
  }

  if (accountInserts.length) {
    logger(`saving ${accountInserts.length} accounts`)
    await db('accounts').insert(accountInserts).onConflict('account').merge()
  }

  setTimeout(save_frontiers, 60000)
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
    topic: 'confirmation'
  }
  ws.send(JSON.stringify(subscription))

  setTimeout(save_blocks, 20000)
  setTimeout(save_frontiers, 60000)
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

    // queue block for saving
    blocks_queue.push(hash)

    // queue frontier for saving
    frontiers_queue[account] = true

    if (account_check_queue.size < 1000) {
      // TODO - ignore accounts recently checked
      // account_check_queue.add(() => check_account(account))
    }
  }
}

// scan accounts to find ones with missing blocks in database
let scan_cursor_account = constants.BURN_ACCOUNT
let scan_index = 0
const scan_accounts = async () => {
  // scan accounts later if queue is full
  if (account_update_queue.size > 1000) {
    setTimeout(scan_accounts, 20000)
    return
  }

  const batchSize = 5000
  logger(
    `Scanning accounts from ${scan_index} to ${
      scan_index + batchSize
    } (${scan_cursor_account})`
  )

  const { accounts } = await getLedger({
    count: batchSize,
    modified_since: dayjs().subtract(6, 'hours').unix(),
    account: scan_cursor_account
  })

  const addresses = Object.keys(accounts)
  const addressCount = addresses.length
  logger(`${addressCount} accounts returned`)

  let stale_count = 0

  for (const address in accounts) {
    const result = await db('blocks')
      .count('* as blockCount')
      .where({ account: address })
    if (!result.length) {
      continue
    }

    const { blockCount } = result[0]
    const height = Number(accounts[address].block_count)

    if (blockCount < height) {
      stale_count += 1
      account_update_queue.add(() =>
        update_account({
          account: address,
          accountInfo: accounts[address],
          blockCount
        })
      )
    }
  }

  logger(`found ${stale_count} stale accounts to update`)

  scan_index += batchSize
  scan_cursor_account = addresses[addressCount - 1]

  if (addressCount !== batchSize) {
    logger('scan complete, resetting cursor')

    // reached the end, reset cursor
    scan_index = 0
    scan_cursor_account = constants.BURN_ACCOUNT
  }

  setTimeout(scan_accounts, 5000)
}

// initiate initial scan
scan_accounts()
