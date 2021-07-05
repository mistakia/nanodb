const debug = require('debug')
const dayjs = require('dayjs')

const { getLedger } = require('../common')

const db = require('../db')
const logger = debug('script')
debug.enable('script')

const main = async ({ all = false, days = 3 } = {}) => {
  logger({
    all,
    days
  })

  const { accounts } = await getLedger({
    modified_since: dayjs().subtract(days, 'days').unix(),
    threshold: 100000000000000000
  })

  const addresses = Object.keys(accounts)
  const accountsStr = addresses.map((a) => `'${a}'`).join(',')

  let query = `
INSERT INTO account_stats
SELECT account, count(*) as block_count ,sum(amount) as total_amount ,1 as blocktype
FROM blocks b1
WHERE b1.type in (1,4) AND (b1.subtype IS NULL or b1.subtype = 3)
  `
  if (!all) {
    query = query + `AND account IN (${accountsStr})`
  }

  query =
    query +
    `
GROUP BY account
UNION ALL
SELECT account, count(*) as block_count ,sum(amount) as total_amount,3 as blocktype
FROM blocks b1
WHERE b1.type in (1,2,3) AND (b1.subtype IS NULL or b1.subtype IN (1, 2))
  `
  if (!all) {
    query =
      query +
      `AND (account IN (${accountsStr}) OR link_as_account IN (${accountsStr}))`
  }

  query =
    query +
    `
GROUP BY account
ON DUPLICATE KEY UPDATE account=account, block_count=block_count, total_amount=total_amount, blocktype=blocktype
  `

  logger('Creating accounts_stats table')
  const result = await db.raw(query)
  logger('Finished creating accounts_stats table')
  logger(result)

  // TODO create source destination stats table
}

module.exprots = main

if (!module.parent) {
  const init = async () => {
    const yargs = require('yargs/yargs')
    const { hideBin } = require('yargs/helpers')
    const argv = yargs(hideBin(process.argv)).argv

    try {
      await main({ all: argv.all, days: argv.days })
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
