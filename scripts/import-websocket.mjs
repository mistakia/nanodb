import ReconnectingWebSocket from 'reconnecting-websocket'
import PQueue from 'p-queue'
import WS from 'ws'
import debug from 'debug'
import nanocurrency from 'nanocurrency'
import dayjs from 'dayjs'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import constants from '#constants'
import {
  getAccountInfo,
  getBlocksInfo,
  formatBlockInfo,
  formatAccountInfo,
  getLedger,
  getChain
} from '#common'
import config from '#config'
import db from '#db'

const logger = debug('ws')
debug.enable('ws')

const argv = yargs(hideBin(process.argv)).argv

const MIN_BATCH_SIZE = 1000
const ACCOUNTS_BATCH_SIZE = argv.accounts_batch_size || 200
const account_check_queue = new PQueue({ concurrency: 1 })
const account_update_queue = new PQueue({ concurrency: 1 })
let frontiers_queue = {}
let blocks_queue = []
const election_info_queue = {}

const update_account = async ({ account, accountInfo, blockCount }) => {
  let cursor = accountInfo.frontier
  const height = Number(accountInfo.block_count)

  while (blockCount < height) {
    logger(
      `account height: ${height}, current count: ${blockCount}, cursor: ${cursor}`
    )
    const count = Math.min(accountInfo.block_count, MIN_BATCH_SIZE)
    const chain = await getChain({ block: cursor, count })
    cursor = chain.blocks[chain.blocks.length - 1]
    const { blocks } = await getBlocksInfo({ hashes: chain.blocks })

    const blockInserts = []
    for (const hash in blocks) {
      const block = blocks[hash]
      blockInserts.push({ hash, ...formatBlockInfo(block) })
    }

    if (blockInserts.length) {
      logger(`saving ${blockInserts.length} blocks`)
      await db.raw(
        `INSERT INTO blocks (amount, balance, height, local_timestamp, confirmed, account, previous, representative, link, link_account, signature, work, type, subtype, hash) VALUES ${blockInserts
          .map(
            (block) =>
              `(${block.amount}, ${block.balance}, ${block.height}, ${
                block.local_timestamp
              }, ${block.confirmed ? 1 : 0}, '${block.account}', ${
                block.previous ? `'${block.previous}'` : null
              }, '${block.representative}', '${block.link}', '${
                block.link_account
              }', '${block.signature}', '${block.work}', '${block.type}', ${
                block.subtype ? `'${block.subtype}'` : null
              }, '${block.hash}')`
          )
          .join(', ')}
          ON CONFLICT (hash) DO UPDATE SET local_timestamp = LEAST(blocks.local_timestamp, EXCLUDED.local_timestamp), confirmed = EXCLUDED.confirmed, height = EXCLUDED.height, amount = EXCLUDED.amount, balance = EXCLUDED.balance, previous = EXCLUDED.previous, representative = EXCLUDED.representative, link = EXCLUDED.link, link_account = EXCLUDED.link_account, signature = EXCLUDED.signature, work = EXCLUDED.work, type = EXCLUDED.type, subtype = EXCLUDED.subtype`
      )
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

  // get blocks from rpc and join with election info from websocket
  const res = await getBlocksInfo({ hashes })
  const blockInserts = []
  for (const hash in res.blocks) {
    const block = res.blocks[hash]
    const election_info = election_info_queue[hash] || {}
    blockInserts.push({
      hash,
      ...formatBlockInfo(block),
      election_duration: election_info.duration
        ? Number(election_info.duration)
        : null,
      election_time: election_info.time ? Number(election_info.time) : null,
      election_tally: election_info.tally ? Number(election_info.tally) : null,
      election_request_count: election_info.request_count
        ? Number(election_info.request_count)
        : null,
      election_blocks: election_info.blocks
        ? Number(election_info.blocks)
        : null,
      election_voters: election_info.voters
        ? Number(election_info.voters)
        : null
    })

    // remove election_info for block
    delete election_info_queue[hash]
  }

  if (blockInserts.length) {
    logger(`saving ${blockInserts.length} blocks with election info`)
    await db.raw(
      `INSERT INTO blocks (amount, balance, height, local_timestamp, confirmed, account, previous, representative, link, link_account, signature, work, type, subtype, hash, election_duration, election_time, election_tally, election_request_count, election_blocks, election_voters) VALUES ${blockInserts
        .map(
          (block) =>
            `(${block.amount}, ${block.balance}, ${block.height}, ${
              block.local_timestamp
            }, ${block.confirmed ? 1 : 0}, '${block.account}', ${
              block.previous ? `'${block.previous}'` : null
            }, '${block.representative}', '${block.link}', '${
              block.link_account
            }', '${block.signature}', '${block.work}', '${block.type}', ${
              block.subtype ? `'${block.subtype}'` : null
            }, '${block.hash}', ${block.election_duration}, ${
              block.election_time
            }, ${block.election_tally}, ${block.election_request_count}, ${
              block.election_blocks
            }, ${block.election_voters})`
        )
        .join(', ')}
        ON CONFLICT (hash) DO UPDATE SET local_timestamp = LEAST(blocks.local_timestamp, EXCLUDED.local_timestamp), confirmed = EXCLUDED.confirmed, height = EXCLUDED.height, amount = EXCLUDED.amount, balance = EXCLUDED.balance, previous = EXCLUDED.previous, representative = EXCLUDED.representative, link = EXCLUDED.link, link_account = EXCLUDED.link_account, signature = EXCLUDED.signature, work = EXCLUDED.work, type = EXCLUDED.type, subtype = EXCLUDED.subtype, election_duration = EXCLUDED.election_duration, election_time = EXCLUDED.election_time, election_tally = EXCLUDED.election_tally, election_request_count = EXCLUDED.election_request_count, election_blocks = EXCLUDED.election_blocks, election_voters = EXCLUDED.election_voters`
    )
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
    topic: 'confirmation',
    options: {
      include_election_info: true
    }
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
  const { account, hash, election_info } = message

  if (topic === 'confirmation') {
    logger(`received block: ${hash}`)

    // queue block for saving
    blocks_queue.push(hash)

    // save election info
    election_info_queue[hash] = election_info

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
let last_full_scan_time = dayjs().subtract(6, 'hours').unix() // Initialize with 6 hours prior

const scan_accounts = async () => {
  try {
    // scan accounts later if queue is full
    if (account_update_queue.size > 1000) {
      setTimeout(scan_accounts, 20000)
      return
    }

    logger(
      `Scanning accounts from ${scan_index} to ${
        scan_index + ACCOUNTS_BATCH_SIZE
      } (${scan_cursor_account})`
    )

    const modified_since_time = last_full_scan_time - 900 // 15 minutes before the last full scan
    const { accounts } = await getLedger({
      count: ACCOUNTS_BATCH_SIZE,
      modified_since: modified_since_time,
      account: scan_cursor_account
    })

    const addresses = Object.keys(accounts)
    const address_count = addresses.length
    logger(`${address_count} accounts returned`)

    let stale_count = 0

    for (const address of addresses) {
      const result = await db('blocks')
        .count('* as block_count')
        .where({ account: address })
      if (!result.length) {
        continue
      }

      const { block_count } = result[0]
      const height = Number(accounts[address].block_count)

      if (block_count < height) {
        stale_count += 1
        account_update_queue.add(() =>
          update_account({
            account: address,
            account_info: accounts[address],
            block_count
          })
        )
      }
    }

    logger(`found ${stale_count} stale accounts to update`)

    scan_index += ACCOUNTS_BATCH_SIZE
    scan_cursor_account = addresses[address_count - 1]

    if (address_count !== ACCOUNTS_BATCH_SIZE) {
      logger('scan complete, resetting cursor')

      // reached the end, reset cursor and update last full scan time
      scan_index = 0
      scan_cursor_account = constants.BURN_ACCOUNT
      last_full_scan_time = dayjs().unix() // Update the last full scan time to now
    }

    setTimeout(scan_accounts, 5000)
  } catch (error) {
    logger(`Error scanning accounts: ${error.message}`)
    setTimeout(scan_accounts, 20000) // Retry after a delay in case of error
  }
}

// initiate initial scan
scan_accounts()
