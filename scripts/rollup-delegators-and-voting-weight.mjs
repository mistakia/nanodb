import debug from 'debug'
import dayjs from 'dayjs'
// import yargs from 'yargs'
// import { hideBin } from 'yargs/helpers'

/* eslint-disable no-unused-vars */
import db from '#db'
import { isMain } from '#common'
/* eslint-enable no-unused-vars */

// const argv = yargs(hideBin(process.argv)).argv
const log = debug('rollup-delegators-and-voting-weight')
debug.enable('rollup-delegators-and-voting-weight')

const first_timestamp = 1550832660

const calculate_and_save = async (timestamp, frontiers) => {
  const representatives = {}

  for (const account in frontiers) {
    const representative = frontiers[account].representative
    if (representative in representatives) {
      representatives[representative].voting_weight +=
        frontiers[account].balance
      representatives[representative].delegators += 1
    } else {
      representatives[representative] = {
        voting_weight: frontiers[account].balance,
        delegators: 1
      }
    }
  }

  const rows = []

  for (const representative_address in representatives) {
    rows.push({
      timestamp,
      representative_address,
      voting_weight: representatives[representative_address].voting_weight,
      delegators: representatives[representative_address].delegators
    })
  }
}

const rollup_delegators_and_voting_weight = async () => {
  let current_timestamp = dayjs
    .unix(first_timestamp)
    .add(1, 'day')
    .startOf('day')
  const end_timestamp = dayjs().startOf('day')

  const frontiers = {}

  const latest_blocks_per_account = await db.raw(`
  SELECT account, balance, representative
  FROM blocks
  INNER JOIN (
    SELECT account, MAX(height) as max_height
    FROM blocks
    WHERE local_timestamp < ${current_timestamp.unix()}
    GROUP BY account
  ) as latest_blocks
  ON blocks.account = latest_blocks.account AND blocks.height = latest_blocks.max_height
`)

  for (const row of latest_blocks_per_account.rows) {
    frontiers[row.account] = {
      balance: row.balance,
      representative: row.representative
    }
  }

  await calculate_and_save(current_timestamp.unix(), frontiers)

  while (current_timestamp.isBefore(end_timestamp)) {
    console.log(current_timestamp)

    // get new confirmed frontiers since last timestamp
    const new_blocks = await db.raw(`
    SELECT account, balance, representative
    FROM blocks
    INNER JOIN (
      SELECT account, MAX(height) as max_height
      FROM blocks
      WHERE local_timestamp >= ${current_timestamp.unix()} AND local_timestamp < ${current_timestamp
      .add(1, 'day')
      .unix()} and confirmed = 1
      GROUP BY account
    ) as new_blocks
    ON blocks.account = new_blocks.account AND blocks.height = new_blocks.max_height
  `)

    for (const row of new_blocks.rows) {
      frontiers[row.account] = {
        balance: row.balance,
        representative: row.representative
      }
    }

    await calculate_and_save(current_timestamp.unix(), frontiers)

    current_timestamp = current_timestamp.add(1, 'day')
  }
}

const main = async () => {
  let error
  try {
    await rollup_delegators_and_voting_weight()
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

export default rollup_delegators_and_voting_weight
