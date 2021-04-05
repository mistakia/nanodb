const { getBlock, formatBlockInfo } = require('../common')
const constants = require('../constants')
const db = require('../db')
let index = 0
let account

const verifyBlock = async (hash) => {
  const rows = await db('blocks').select().where({ hash })
  let block = rows[0]

  if (!block) {
    const b = await getBlock(hash)
    block = { hash, ...formatBlockInfo(b) }
    await db('blocks').insert(block).onConflict().merge()
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
  console.log('\nComplete')

  process.exit()
}

try {
  main()
} catch (e) {
  console.log(e)
  process.exit()
}
