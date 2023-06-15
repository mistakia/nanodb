import yargs from 'yargs/yargs'
import { hideBin } from 'yargs/helpers'

import { getBlocksInfo, formatBlockInfo } from '#common'
import constants from '#constants'
import db from '#db'

const argv = yargs(hideBin(process.argv)).argv
let index = 0
let account
const missing = []

const blockLimit = argv.blockLimit || Infinity

console.log(`Running with a block limit of: ${blockLimit}`)

const verifyBlock = async (hash) => {
  const rows = await db('blocks').select().where({ hash })
  let block = rows[0]

  if (!block) {
    if (argv.noSync) {
      missing.push(hash)
      return
    }
    const b = await getBlocksInfo({ hashes: [hash] })
    block = { hash, ...formatBlockInfo(b) }
    await db('blocks').insert(block).onConflict('hash').merge()
  }

  if (!block.previous) {
    return
  }

  if (block.previous === constants.OPEN_BLOCK_PREVIOUS) {
    return
  }

  process.stdout.write(
    `\rVerifying / ${index} / ${account.account} / ${block.height}`
  )
  return verifyBlock(block.previous)
}

const getAccountRow = async (index = 0) => {
  const rows = await db('accounts').select().limit(1).offset(index)
  return rows[0]
}

const main = async () => {
  account = await getAccountRow()
  while (account) {
    process.stdout.write(`\rVerifying / ${index} / ${account.account}`)
    if (account.frontier) {
      if (account.block_count > blockLimit) {
        console.log(
          `\nSkipping ${account.account} block count, ${account.block_count}, exceeds limit`
        )
        continue
      }

      try {
        await verifyBlock(account.frontier)
      } catch (e) {
        console.log(`Error verifying ${account.account}`)
        console.log(e)
      }
    }

    index += 1
    account = await getAccountRow(index)
  }
  if (missing.length) console.log('Missing blocks', missing)
  console.log('\nComplete')

  process.exit()
}

try {
  main()
} catch (e) {
  console.log(e)
  process.exit()
}
