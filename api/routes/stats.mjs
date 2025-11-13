import express from 'express'

import db from '#db'
import constants from '#constants'
import cache from '#api/cache.mjs'

const router = express.Router()

let is_calculating_stats = false

const calculate_stats = async () => {
  if (is_calculating_stats) return
  is_calculating_stats = true

  const now = Date.now()
  const one_day_total_ms = 86400000
  const one_day_ago_ms = now - one_day_total_ms
  const one_day_ago = Math.round(one_day_ago_ms / 1000)
  const one_hour_ago = Math.round((now - 3600000) / 1000)
  const ten_minutes_ago = Math.round((now - 600000) / 1000)

  // Hybrid approach: Use rollup_daily for historical data + live blocks for recent data
  // Get the start of yesterday (to query complete day from rollup)
  const yesterday_start = Math.floor((now - one_day_total_ms) / 86400000) * 86400
  const today_start = Math.floor(now / 86400000) * 86400

  // Query rollup_daily for yesterday's complete data
  const rollup_yesterday_query = db('rollup_daily')
    .where('timestamp', '>=', yesterday_start)
    .where('timestamp', '<', today_start)
    .select(
      db.raw('COALESCE(SUM(blocks), 0) as blocks_count'),
      db.raw('COALESCE(SUM(send_volume), 0) as send_volume_sum')
    )
    .first()

  // Query live blocks for today + any recent blocks from yesterday
  const confirmations_recent_query = db('blocks')
    .where('local_timestamp', '>=', one_day_ago)
    .where('confirmed', '=', 1)
    .count('* as count')

  const send_volume_recent_query = db('blocks')
    .where('local_timestamp', '>=', one_day_ago)
    .where('confirmed', '=', 1)
    .where(function () {
      this.where('subtype', '=', constants.blockSubType.send)
      this.orWhere('type', '=', constants.blockType.send)
    })
    .sum('amount')
    .first()

  const median_latency_last_24_hours_query = db('blocks')
    .where('local_timestamp', '>=', one_day_ago)
    .where('confirmed', '=', 1)
    .whereNotNull('election_time')
    .select(
      db.raw(
        'PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY election_time - local_timestamp::bigint * 1000) as median_latency_ms'
      )
    )

  const median_latency_last_hour_query = db('blocks')
    .where('local_timestamp', '>=', one_hour_ago)
    .where('confirmed', '=', 1)
    .whereNotNull('election_time')
    .select(
      db.raw(
        'PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY election_time - local_timestamp::bigint * 1000) as median_latency_ms'
      )
    )

  const median_latency_last_10_mins_query = db('blocks')
    .where('local_timestamp', '>=', ten_minutes_ago)
    .where('confirmed', '=', 1)
    .whereNotNull('election_time')
    .select(
      db.raw(
        'PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY election_time - local_timestamp::bigint * 1000) as median_latency_ms'
      )
    )

  const confirmations_without_election_time_last_24_hours_query = db('blocks')
    .where('local_timestamp', '>=', one_day_ago)
    .where('confirmed', '=', 1)
    .whereNull('election_time')
    .count('* as count')

  const [
    rollup_yesterday,
    confirmations_recent,
    send_volume_recent,
    median_latency_last_24_hours,
    median_latency_last_hour,
    median_latency_last_10_mins,
    confirmations_without_election_time_last_24_hours
  ] = await Promise.all([
    rollup_yesterday_query,
    confirmations_recent_query,
    send_volume_recent_query,
    median_latency_last_24_hours_query,
    median_latency_last_hour_query,
    median_latency_last_10_mins_query,
    confirmations_without_election_time_last_24_hours_query
  ])

  // Combine rollup data with recent live data
  const confirmations_last_24_hours = Number(confirmations_recent[0].count)
  const send_volume_last_24_hours =
    Number(rollup_yesterday?.send_volume_sum || 0) +
    Number(send_volume_recent?.sum || 0)

  const response_data = {
    confirmations_last_24_hours,
    median_latency_ms_last_24_hours: Number(
      median_latency_last_24_hours[0].median_latency_ms
    ),
    median_latency_ms_last_hour: Number(
      median_latency_last_hour[0].median_latency_ms
    ),
    median_latency_ms_last_10_mins: Number(
      median_latency_last_10_mins[0].median_latency_ms
    ),
    confirmations_without_election_time_last_24_hours: Number(
      confirmations_without_election_time_last_24_hours[0].count
    ),
    send_volume_last_24_hours
  }

  cache.set('/api/stats', response_data, 420)
  is_calculating_stats = false
  return response_data
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
