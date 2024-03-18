import debug from 'debug'
import dayjs from 'dayjs'
import nanocurrency from 'nanocurrency'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import constants from '#constants'
import db from '#db'
import {
  getFrontierCount,
  getLedger,
  getChain,
  getAccountInfo,
  getBlocksInfo,
  formatBlockInfo,
  formatAccountInfo,
  wait,
  isMain
} from '#common'

const argv = yargs(hideBin(process.argv)).argv
const logger = debug('rpc')
debug.enable('rpc')

const BLOCKS_BATCH_SIZE = 1000
const RETRY_BACKOFF = 5000

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
 *     await db('blocks').insert(blockInserts).onConflict('hash').merge()
 *   }
 *
 *   queue = []
 * }
 *  */

const processAccountBlocks = async ({
  account,
  all_blocks = false,
  delay = 0,
  account_info_retries = 0
}) => {
  logger(`processing account ${account}`)

  let accountInfo
  try {
    accountInfo = await getAccountInfo({
      account
    })
  } catch (err) {
    logger(`error getting account info for ${account}`)
    logger(err)

    if (account_info_retries > 5) {
      logger(`too many retries for account ${account}`)
      throw err
    }

    const wait_time = RETRY_BACKOFF * Math.pow(2, account_info_retries)
    await wait(wait_time)

    await processAccountBlocks({
      account,
      all_blocks,
      delay,
      account_info_retries: account_info_retries + 1
    })
    return
  }

  if (!accountInfo || accountInfo.error) return

  const key = nanocurrency.derivePublicKey(account)
  db('accounts')
    .insert({
      key,
      account,
      ...formatAccountInfo(accountInfo)
    })
    .onConflict('account')
    .merge()

  const result = await db('blocks')
    .count('* as imported_block_count')
    .where({ account })
  if (!result.length) {
    return
  }

  let { imported_block_count } = result[0]
  let cursor = accountInfo.frontier
  let failed_attempts = 0
  const frontier_height = parseInt(accountInfo.confirmed_height, 10)
  let block_height_cursor = frontier_height

  while (
    (all_blocks
      ? block_height_cursor > 1
      : imported_block_count < frontier_height) &&
    failed_attempts < 6
  ) {
    logger(
      `account ${account}, height: ${frontier_height}, imported count: ${imported_block_count}, cursor: ${cursor}`
    )
    const blockInserts = []
    let chain

    try {
      const batch_size = Math.min(accountInfo.block_count, BLOCKS_BATCH_SIZE)
      chain = await getChain({ block: cursor, count: batch_size })
      cursor = chain.blocks[chain.blocks.length - 1]
    } catch (err) {
      logger(`error getting blocks for account ${account}, cursor: ${cursor}`)
      logger(err)

      const wait_time = RETRY_BACKOFF * Math.pow(2, failed_attempts)
      await wait(wait_time)

      failed_attempts++
      continue
    }

    try {
      const { blocks } = await getBlocksInfo({ hashes: chain.blocks })
      for (const hash in blocks) {
        const block = blocks[hash]
        blockInserts.push({ hash, ...formatBlockInfo(block) })
      }
    } catch (err) {
      logger(`error getting blocks info for ${chain.blocks.length} blocks`)
      logger(err)

      const wait_time = RETRY_BACKOFF * Math.pow(2, failed_attempts)
      await wait(wait_time)

      failed_attempts++
      continue
    }

    block_height_cursor = blockInserts[blockInserts.length - 1].height

    if (blockInserts.length) {
      logger(`saving ${blockInserts.length} blocks`)
      try {
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
        failed_attempts = 0
      } catch (err) {
        logger(err)
        logger(`failed to save blocks for account ${account}`)
        failed_attempts += 1
        if (failed_attempts > 1) {
          logger('consecutive failed attempts, exiting')
          process.exit()
        }
      }
    }

    if (!all_blocks) {
      // update count
      const result = await db('blocks')
        .count('* as imported_block_count')
        .where({ account })
      imported_block_count = result[0].imported_block_count
    }

    if (delay) {
      await wait(delay)
    }
  }

  if (failed_attempts === 6) {
    logger(`exiting after too many failed attempts for ${account}`)
  } else {
    logger(`finished processing blocks for ${account}`)
  }
  return failed_attempts
}
/**
 * Main function to process accounts and blocks from RPC and insert into the database.
 * @param {Object} options - The options for processing accounts and blocks.
 * @param {number} options.hours - The number of hours to go back for modified accounts.
 * @param {number} [options.threshold=0] - The minimum balance threshold for accounts to be processed.
 * @param {boolean} [options.include_blocks=false] - Flag to include block processing for each account.
 * @param {boolean} [options.include_account_info=false] - Flag to include account info for each account.
 * @param {string} [options.account=constants.BURN_ACCOUNT] - The account to start processing from.
 * @param {boolean} [options.all_blocks=false] - Flag to process all blocks for each account.
 * @param {number} [options.delay=0] - The delay in milliseconds between processing each account.
 * @param {number} [options.accounts_batch_size=200] - The number of accounts to process in each batch.
 * @param {boolean} [options.skip=false] - Flag to skip the first account in the processing queue.
 * @param {string} [options.single_account] - Process just one account
 */

const main = async ({
  hours,
  threshold = 0,
  include_blocks = false,
  include_account_info = false,
  account = constants.BURN_ACCOUNT,
  all_blocks = false,
  delay = 0,
  skip = false,
  accounts_batch_size = 200,
  single_account = false
} = {}) => {
  if (single_account && account) {
    // Process a single account if the flag is provided
    await processAccountBlocks({ account, all_blocks, delay })
    process.exit()
  }

  const { count } = await getFrontierCount()
  logger(`Frontier Count: ${count}`)

  let index = 0
  let returned_address_count = 0

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
    returned_address_count = addresses.length
    logger(`${returned_address_count} accounts returned`)

    const accountInserts = []
    for (const address in accounts) {
      const key = nanocurrency.derivePublicKey(address)
      let account_info_rpc
      if (include_account_info && !include_blocks) {
        try {
          account_info_rpc = await getAccountInfo({ account: address })
        } catch (error) {
          logger(`Error fetching account info for ${address}: ${error}`)
        }
      }
      const accountInfo = formatAccountInfo(
        account_info_rpc || accounts[address]
      )
      accountInserts.push({
        key,
        account: address,
        ...accountInfo
      })
    }
    await db('accounts').insert(accountInserts).onConflict('account').merge()

    if (include_blocks) {
      const account_keys = Object.keys(accounts)
      for (const account of skip ? account_keys.slice(1) : account_keys) {
        await processAccountBlocks({ account, all_blocks, delay })
      }
    }

    index += accounts_batch_size
    account = addresses[returned_address_count - 1]
  } while (returned_address_count === accounts_batch_size)

  process.exit()
}

if (isMain(import.meta.url)) {
  const init = async () => {
    try {
      await main({
        hours: argv.hours,
        threshold: argv.threshold,
        include_blocks: argv.blocks,
        include_account_info: argv.include_account_info,
        account: argv.account,
        all_blocks: argv.all_blocks,
        delay: argv.delay,
        skip: argv.skip,
        accounts_batch_size: argv.accounts_batch_size,
        single_account: argv.single_account
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

export default main
