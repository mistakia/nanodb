import debug from 'debug'
import fs from 'fs-extra'
// import yargs from 'yargs'
// import { hideBin } from 'yargs/helpers'

/* eslint-disable no-unused-vars */
// import db from '#db'
import { request, isMain } from '#common'
/* eslint-enable no-unused-vars */

// const argv = yargs(hideBin(process.argv)).argv
const log = debug('rollup-delegators')
debug.enable('rollup-delegators')

const earliest_local_timestamp = 1550832660

// WITH latest_blocks AS (
//   SELECT
//     account,
//     MAX(local_timestamp) AS latest_timestamp
//   FROM
//     blocks
//   WHERE
//     local_timestamp <= EXTRACT(EPOCH FROM DATE 'YYYY-MM-DD'::timestamp + INTERVAL '1 DAY') -- Replace YYYY-MM-DD with your target day
//   GROUP BY
//     account
// ),
// latest_balances AS (
//   SELECT
//     b.account,
//     b.representative,
//     b.balance
//   FROM
//     blocks b
//   INNER JOIN latest_blocks lb ON b.account = lb.account AND b.local_timestamp = lb.latest_timestamp
// )
// SELECT
//   representative,
//   COUNT(account) AS delegator_count,
//   SUM(balance) AS total_voting_weight
// FROM
//   latest_balances
// GROUP BY
//   representative;

const rollup_delegators = async () => {
  // load cache from disk
  const cache = await fs.readJson('./cache/rollup-delegators.json')

  if (!cache) {
    // build cache using frontiers at the end of the day with the earlist known timestamp
  }
}

const main = async () => {
  let error
  try {
    await rollup_delegators()
  } catch (err) {
    error = err
    log(error)
  }

  // await db('jobs').insert({
  //   type: constants.jobs.EXAMPLE,
  //   succ: error ? 0 : 1,
  //   reason: error ? error.message : null,
  //   timestamp: Math.round(Date.now() / 1000)
  // })

  process.exit()
}

if (isMain(import.meta.url)) {
  main()
}

export default rollup_delegators
