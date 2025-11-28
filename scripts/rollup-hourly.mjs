import debug from 'debug'
import dayjs from 'dayjs'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import BigNumber from 'bignumber.js'
import utc from 'dayjs/plugin/utc.js'

import constants from '#constants'
import db from '#db'
import { isMain } from '#common'

dayjs.extend(utc)

const logger = debug('rollup:hourly')
debug.enable('rollup:hourly')

const argv = yargs(hideBin(process.argv))
  .option('hour', {
    describe: 'Specific hour timestamp to process (Unix timestamp)',
    type: 'number'
  })
  .option('backfill-hours', {
    describe: 'Number of hours to backfill from now',
    type: 'number'
  })
  .option('force', {
    describe: 'Force re-processing even if hour already exists',
    type: 'boolean',
    default: false
  })
  .help()
  .parse()

/**
 * Get the start timestamp of the previous completed hour
 * @returns {number} Unix timestamp of hour start
 */
const get_previous_hour_timestamp = () => {
  const now = dayjs.utc()
  const previous_hour = now.subtract(1, 'hour').startOf('hour')
  return previous_hour.unix()
}

/**
 * Check if an hour has already been processed
 * @param {number} hour_timestamp - Unix timestamp of hour start
 * @returns {Promise<boolean>}
 */
const is_hour_processed = async (hour_timestamp) => {
  const existing = await db('stats_hourly')
    .where('hour_timestamp', hour_timestamp)
    .first()
  return !!existing
}

/**
 * Aggregate statistics for a specific hour
 * @param {number} hour_timestamp - Unix timestamp of hour start
 * @returns {Promise<Object>} Aggregated statistics
 */
const aggregate_hour_stats = async (hour_timestamp) => {
  const hour_end = hour_timestamp + 3600

  logger(`Aggregating hour: ${dayjs.unix(hour_timestamp).utc().format('YYYY-MM-DD HH:mm')} UTC`)

  // Base query for confirmed blocks in the hour window
  const base_query = () =>
    db('blocks')
      .where('local_timestamp', '>=', hour_timestamp)
      .where('local_timestamp', '<', hour_end)
      .where('confirmed', 1)

  // Run all aggregation queries in parallel
  const [
    confirmations_result,
    without_election_result,
    send_volume_result,
    type_counts_result,
    latency_result,
    active_accounts_result
  ] = await Promise.all([
    base_query().count('* as count').first(),

    base_query().whereNull('election_time').count('* as count').first(),

    base_query()
      .where(function () {
        this.where('subtype', constants.blockSubType.send)
          .orWhere('type', constants.blockType.send)
      })
      .sum('amount as total')
      .first(),

    base_query()
      .select(
        db.raw(`COUNT(*) FILTER (WHERE subtype = ${constants.blockSubType.send}) as send_count`),
        db.raw(`COUNT(*) FILTER (WHERE subtype = ${constants.blockSubType.receive}) as receive_count`),
        db.raw(`COUNT(*) FILTER (WHERE subtype = ${constants.blockSubType.change}) as change_count`),
        db.raw(`COUNT(*) FILTER (WHERE type = ${constants.blockType.open}) as open_count`)
      )
      .first(),

    base_query()
      .whereNotNull('election_time')
      .select(
        db.raw('PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY election_time - local_timestamp::bigint * 1000) as median_latency_ms'),
        db.raw('PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY election_time - local_timestamp::bigint * 1000) as p95_latency_ms'),
        db.raw('MIN(election_time - local_timestamp::bigint * 1000) as min_latency_ms'),
        db.raw('MAX(election_time - local_timestamp::bigint * 1000) as max_latency_ms')
      )
      .first(),

    base_query().countDistinct('account as count').first()
  ])

  const confirmations_count = Number(confirmations_result?.count || 0)

  if (confirmations_count === 0) {
    logger(`No confirmed blocks in hour ${hour_timestamp}, skipping`)
    return null
  }

  return {
    hour_timestamp,
    hour_timestamp_utc: dayjs.unix(hour_timestamp).utc().format('YYYY-MM-DD HH:mm:ss'),
    confirmations_count,
    confirmations_without_election_time: Number(without_election_result?.count || 0),
    send_volume: BigNumber(send_volume_result?.total || 0).toFixed(0),
    median_latency_ms: latency_result?.median_latency_ms ?? null,
    p95_latency_ms: latency_result?.p95_latency_ms ?? null,
    min_latency_ms: latency_result?.min_latency_ms ?? null,
    max_latency_ms: latency_result?.max_latency_ms ?? null,
    send_count: Number(type_counts_result?.send_count || 0),
    receive_count: Number(type_counts_result?.receive_count || 0),
    change_count: Number(type_counts_result?.change_count || 0),
    open_count: Number(type_counts_result?.open_count || 0),
    active_accounts_count: Number(active_accounts_result?.count || 0),
    processed_blocks_count: confirmations_count
  }
}

/**
 * Insert or update stats for an hour
 * @param {Object} stats - Aggregated statistics
 */
const upsert_hour_stats = async (stats) => {
  const { hour_timestamp, ...updateable_fields } = stats

  await db('stats_hourly')
    .insert({
      ...stats,
      created_at: db.fn.now(),
      updated_at: db.fn.now()
    })
    .onConflict('hour_timestamp')
    .merge({
      ...updateable_fields,
      updated_at: db.fn.now()
    })

  logger(`Saved stats for hour ${hour_timestamp}: ${stats.confirmations_count} confirmations`)
}

/**
 * Process a single hour
 * @param {number} hour_timestamp - Unix timestamp of hour start
 * @param {boolean} force - Force re-processing
 * @returns {Promise<Object|null>} Processed stats or null if skipped
 */
const process_hour = async (hour_timestamp, force = false) => {
  // Check if already processed
  if (!force && await is_hour_processed(hour_timestamp)) {
    logger(`Hour ${hour_timestamp} already processed, skipping`)
    return null
  }

  const stats = await aggregate_hour_stats(hour_timestamp)

  if (stats) {
    await upsert_hour_stats(stats)
  }

  return stats
}

/**
 * Backfill multiple hours
 * @param {number} hours_count - Number of hours to backfill
 * @param {boolean} force - Force re-processing
 */
const backfill_hours = async (hours_count, force = false) => {
  const now = dayjs.utc()
  let processed_count = 0
  let skipped_count = 0

  logger(`Backfilling ${hours_count} hours...`)

  for (let i = 1; i <= hours_count; i++) {
    const hour_timestamp = now.subtract(i, 'hour').startOf('hour').unix()
    const result = await process_hour(hour_timestamp, force)

    if (result) {
      processed_count++
    } else {
      skipped_count++
    }

    // Log progress every 24 hours
    if (i % 24 === 0) {
      logger(`Progress: ${i}/${hours_count} hours (${processed_count} processed, ${skipped_count} skipped)`)
    }
  }

  logger(`Backfill complete: ${processed_count} processed, ${skipped_count} skipped`)
}

const main = async () => {
  try {
    logger('Starting hourly rollup...')

    if (argv['backfill-hours']) {
      await backfill_hours(argv['backfill-hours'], argv.force)
    } else if (argv.hour) {
      await process_hour(argv.hour, argv.force)
    } else {
      // Default: process the previous completed hour
      const hour_timestamp = get_previous_hour_timestamp()
      await process_hour(hour_timestamp, argv.force)
    }

    logger('Hourly rollup complete')
    process.exit(0)
  } catch (error) {
    logger(`Error: ${error.message}`)
    console.error(error)
    process.exit(1)
  }
}

if (isMain(import.meta.url)) {
  main()
}

export { process_hour, backfill_hours, aggregate_hour_stats }
