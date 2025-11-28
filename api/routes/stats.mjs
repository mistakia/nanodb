import express from 'express'
import debug from 'debug'

import db from '#db'
import constants from '#constants'
import cache from '#api/cache.mjs'

const router = express.Router()
const logger = debug('api:stats')

let is_calculating_stats = false

const LATENCY_SQL = 'PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY election_time - local_timestamp::bigint * 1000) as median_latency_ms'

/**
 * Build a median latency query for confirmed blocks with election_time
 * @param {number} since_timestamp - Unix timestamp to filter from
 * @returns {Knex.QueryBuilder}
 */
const build_latency_query = (since_timestamp) =>
  db('blocks')
    .where('local_timestamp', '>=', since_timestamp)
    .where('confirmed', 1)
    .whereNotNull('election_time')
    .select(db.raw(LATENCY_SQL))
    .first()

/**
 * Check if stats_hourly table exists and has recent data
 * @returns {Promise<boolean>}
 */
const check_stats_hourly_available = async () => {
  try {
    const one_day_ago = Math.floor(Date.now() / 1000) - 86400
    const result = await db('stats_hourly')
      .where('hour_timestamp', '>=', one_day_ago)
      .count('* as count')
      .first()
    return result && Number(result.count) > 0
  } catch (error) {
    logger('stats_hourly not available: %s', error.message)
    return false
  }
}

/**
 * Calculate stats using stats_hourly + live blocks for current hour
 */
const calculate_stats = async () => {
  if (is_calculating_stats) return
  is_calculating_stats = true

  try {
    const now = Date.now()
    const one_day_ago = Math.floor(now / 1000) - 86400
    const one_hour_ago = Math.floor(now / 1000) - 3600
    const ten_minutes_ago = Math.floor(now / 1000) - 600
    const current_hour_start = Math.floor(now / 3600000) * 3600

    const use_stats_hourly = await check_stats_hourly_available()

    let response_data
    if (use_stats_hourly) {
      logger('Using stats_hourly + live blocks')
      response_data = await calculate_stats_with_hourly(
        one_day_ago,
        one_hour_ago,
        ten_minutes_ago,
        current_hour_start
      )
    } else {
      logger('Using live blocks only (stats_hourly not available)')
      response_data = await calculate_stats_live_only(
        one_day_ago,
        one_hour_ago,
        ten_minutes_ago
      )
    }

    cache.set('/api/stats', response_data, 420)
    return response_data
  } finally {
    is_calculating_stats = false
  }
}

/**
 * Calculate stats using stats_hourly for complete hours + live blocks for current hour
 */
const calculate_stats_with_hourly = async (
  one_day_ago,
  one_hour_ago,
  ten_minutes_ago,
  current_hour_start
) => {
  const [
    stats_hourly,
    live_confirmations,
    live_send_volume,
    live_without_election,
    latency_24h,
    latency_1h,
    latency_10m
  ] = await Promise.all([
    // Aggregated stats from complete hours
    db('stats_hourly')
      .where('hour_timestamp', '>=', one_day_ago)
      .where('hour_timestamp', '<', current_hour_start)
      .select(
        db.raw('COALESCE(SUM(confirmations_count), 0) as confirmations_count'),
        db.raw('COALESCE(SUM(send_volume), 0) as send_volume'),
        db.raw('COALESCE(SUM(confirmations_without_election_time), 0) as confirmations_without_election_time')
      )
      .first(),

    // Live blocks for current incomplete hour
    db('blocks')
      .where('local_timestamp', '>=', current_hour_start)
      .where('confirmed', 1)
      .count('* as count')
      .first(),

    db('blocks')
      .where('local_timestamp', '>=', current_hour_start)
      .where('confirmed', 1)
      .where(function () {
        this.where('subtype', constants.blockSubType.send)
          .orWhere('type', constants.blockType.send)
      })
      .sum('amount as sum')
      .first(),

    db('blocks')
      .where('local_timestamp', '>=', current_hour_start)
      .where('confirmed', 1)
      .whereNull('election_time')
      .count('* as count')
      .first(),

    // Latency percentiles from live blocks (can't aggregate percentiles)
    build_latency_query(one_day_ago),
    build_latency_query(one_hour_ago),
    build_latency_query(ten_minutes_ago)
  ])

  return {
    confirmations_last_24_hours:
      Number(stats_hourly?.confirmations_count || 0) +
      Number(live_confirmations?.count || 0),
    send_volume_last_24_hours:
      Number(stats_hourly?.send_volume || 0) +
      Number(live_send_volume?.sum || 0),
    confirmations_without_election_time_last_24_hours:
      Number(stats_hourly?.confirmations_without_election_time || 0) +
      Number(live_without_election?.count || 0),
    median_latency_ms_last_24_hours: Number(latency_24h?.median_latency_ms || 0),
    median_latency_ms_last_hour: Number(latency_1h?.median_latency_ms || 0),
    median_latency_ms_last_10_mins: Number(latency_10m?.median_latency_ms || 0)
  }
}

/**
 * Calculate stats from live blocks only (fallback when stats_hourly unavailable)
 */
const calculate_stats_live_only = async (
  one_day_ago,
  one_hour_ago,
  ten_minutes_ago
) => {
  const [
    confirmations,
    send_volume,
    without_election,
    latency_24h,
    latency_1h,
    latency_10m
  ] = await Promise.all([
    db('blocks')
      .where('local_timestamp', '>=', one_day_ago)
      .where('confirmed', 1)
      .count('* as count')
      .first(),

    db('blocks')
      .where('local_timestamp', '>=', one_day_ago)
      .where('confirmed', 1)
      .where(function () {
        this.where('subtype', constants.blockSubType.send)
          .orWhere('type', constants.blockType.send)
      })
      .sum('amount as sum')
      .first(),

    db('blocks')
      .where('local_timestamp', '>=', one_day_ago)
      .where('confirmed', 1)
      .whereNull('election_time')
      .count('* as count')
      .first(),

    build_latency_query(one_day_ago),
    build_latency_query(one_hour_ago),
    build_latency_query(ten_minutes_ago)
  ])

  return {
    confirmations_last_24_hours: Number(confirmations?.count || 0),
    send_volume_last_24_hours: Number(send_volume?.sum || 0),
    confirmations_without_election_time_last_24_hours: Number(without_election?.count || 0),
    median_latency_ms_last_24_hours: Number(latency_24h?.median_latency_ms || 0),
    median_latency_ms_last_hour: Number(latency_1h?.median_latency_ms || 0),
    median_latency_ms_last_10_mins: Number(latency_10m?.median_latency_ms || 0)
  }
}

calculate_stats()

setInterval(calculate_stats, 300000)

router.get('/', async (req, res) => {
  const { logger } = req.app.locals
  try {
    const cache_key = '/api/stats'
    const cached_data = cache.get(cache_key)
    if (cached_data) {
      return res.status(200).send(cached_data)
    }

    const response_data = await calculate_stats()

    if (response_data) {
      cache.set(cache_key, response_data, 420)
    }
    res.status(200).send(response_data)
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

export default router
