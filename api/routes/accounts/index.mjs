import express from 'express'

import constants from '#constants'
import send from './send.mjs'
import unconfirmed from './unconfirmed.mjs'
import balance_history from './balance_history.mjs'

const router = express.Router({ mergeParams: true })

router.get('/:address/blocks_per_day', async (req, res) => {
  const { logger, cache, db } = req.app.locals
  try {
    const { address } = req.params

    if (!address) {
      return res.status(401).send({ error: 'missing address' })
    }

    const re = /^(nano|xrb)_[13]{1}[13456789abcdefghijkmnopqrstuwxyz]{59}$/gi
    if (!re.test(address)) {
      return res.status(401).send({ error: 'invalid address' })
    }

    const cache_key = `/account/${address}/blocks_per_day`
    const cache_value = cache.get(cache_key)
    if (cache_value) {
      return res.status(200).send(cache_value)
    }

    const query = `
      SELECT
        DATE_TRUNC('day', TO_TIMESTAMP(local_timestamp)) AS day,
        COUNT(*) AS block_count
      FROM
        blocks
      WHERE
        account = '${address}'
      GROUP BY
        day
      ORDER BY
        day ASC;
    `
    const query_response = await db.raw(query)
    const { rows = [] } = query_response
    if (rows.length) {
      cache.set(cache_key, rows, 60)
      return res.status(200).send(rows)
    }

    res.status(200).send([])
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

router.get('/:address/stats', async (req, res) => {
  const { logger, cache, db } = req.app.locals
  try {
    const { address } = req.params

    if (!address) {
      return res.status(401).send({ error: 'missing address' })
    }

    const re = /^(nano|xrb)_[13]{1}[13456789abcdefghijkmnopqrstuwxyz]{59}$/gi
    if (!re.test(address)) {
      return res.status(401).send({ error: 'invalid address' })
    }

    const cache_key = `/account/${address}/stats`
    const cache_value = cache.get(cache_key)
    if (cache_value) {
      return res.status(200).send(cache_value)
    }

    const query = `
      WITH balance_timestamps AS (
        SELECT
          balance,
          local_timestamp,
          subtype,
          RANK() OVER (ORDER BY balance DESC) AS max_balance_rank,
          RANK() OVER (ORDER BY balance ASC) AS min_balance_rank
        FROM
          blocks
        WHERE
          account = '${address}'
      ),
      last_send_change AS (
        SELECT
          MAX(CASE WHEN (type = ${constants.blockType.send} OR (type = ${constants.blockType.state} AND subtype = ${constants.blockSubType.send})) THEN local_timestamp END) AS last_send_block_timestamp,
          MAX(CASE WHEN (type = ${constants.blockType.change} OR (type = ${constants.blockType.state} AND subtype = ${constants.blockSubType.change})) THEN local_timestamp END) AS last_change_block_timestamp
        FROM
          blocks
        WHERE
          account = '${address}'
      ),
      non_epoch_max_timestamp AS (
        SELECT
          MAX(local_timestamp) AS max_non_epoch_timestamp
        FROM
          blocks
        WHERE
          account = '${address}' AND type != ${constants.blockType.epoch}
      )
      SELECT
        MAX(balance) AS max_balance,
        MIN(balance) AS min_balance,
        MAX(CASE WHEN max_balance_rank = 1 THEN local_timestamp END) AS max_balance_timestamp,
        MAX(CASE WHEN min_balance_rank = 1 THEN local_timestamp END) AS min_balance_timestamp,
        (SELECT last_send_block_timestamp FROM last_send_change) AS last_send_block_timestamp,
        (SELECT last_change_block_timestamp FROM last_send_change) AS last_change_block_timestamp,
        (SELECT max_non_epoch_timestamp FROM non_epoch_max_timestamp) AS last_non_epoch_block_timestamp
      FROM
        balance_timestamps;
    `
    const query_response = await db.raw(query)
    const { rows = [] } = query_response
    if (rows.length) {
      cache.set(cache_key, rows[0], 60)
      return res.status(200).send(rows[0])
    }

    res.status(200).send({})
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

router.get('/:address/open', async (req, res) => {
  const { logger, cache, db } = req.app.locals
  try {
    const { address } = req.params

    if (!address) {
      return res.status(401).send({ error: 'missing address' })
    }

    const re = /^(nano|xrb)_[13]{1}[13456789abcdefghijkmnopqrstuwxyz]{59}$/gi
    if (!re.test(address)) {
      return res.status(401).send({ error: 'invalid address' })
    }

    const cache_key = `/account/${address}/summary`
    const cache_value = cache.get(cache_key)
    if (cache_value) {
      return res.status(200).send(cache_value)
    }

    const funding = await db('blocks')
      .select('blocks.local_timestamp as open_timestamp')
      .select('blocks.balance as open_balance')
      .select('b.local_timestamp as funding_timestamp')
      .select('b.account as funding_account')
      .where('blocks.account', address)
      .where('blocks.height', 1)
      .leftJoin({ b: 'blocks' }, 'b.hash', 'blocks.link')

    const data = funding.length ? funding[0] : {}
    if (funding.length) cache.set(cache_key, data, 60)
    res.status(200).send(data)
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

router.get('/:address/blocks/:type/summary', async (req, res) => {
  const { logger, cache, db } = req.app.locals
  try {
    const { address, type } = req.params

    if (!address) {
      return res.status(401).send({ error: 'missing address' })
    }

    const re = /^(nano|xrb)_[13]{1}[13456789abcdefghijkmnopqrstuwxyz]{59}$/gi
    if (!re.test(address)) {
      return res.status(401).send({ error: 'invalid address' })
    }

    if (!type) {
      return res.status(401).send({ error: 'missing type' })
    }

    const types = ['send', 'receive', 'change']
    if (!types.includes(type)) {
      return res.status(401).send({ error: 'invalid type' })
    }

    const limit = Math.min(parseInt(req.query.limit || 100, 0), 100)
    const offset = parseInt(req.query.offset, 0) || 0

    const cache_key = `/account/${address}/${type}/${offset},${limit}`
    const cache_value = cache.get(cache_key)
    if (cache_value) {
      return res.status(200).send(cache_value)
    }

    const rows = await db
      .select('source_account')
      .select('destination_account')
      .count('* as block_count')
      .min('local_timestamp as first_timestamp')
      .max('local_timestamp as last_timestamp')
      .min('amount as min_amount')
      .avg('amount as avg_amount')
      .max('amount as max_amount')
      .sum('amount as total_amount')
      .groupBy('source_account', 'destination_account')
      .orderBy('total_amount', 'desc')
      .limit(limit)
      .offset(offset)
      .from(function () {
        this.select('account as source_account')
          .select('amount')
          .select('local_timestamp')
          .from('blocks')
          .where('account', address)
          .as('t1')

        if (type === 'send') {
          this.select('link_account as destination_account')
            .whereIn('type', [
              constants.blockType.state,
              constants.blockType.send
            ])
            .where(function () {
              this.whereNull('subtype')
              this.orWhere('subtype', constants.blockSubType.send)
            })
        } else if (type === 'receive') {
          this.select('link_account as destination_account')
            .whereIn('type', [
              constants.blockType.state,
              constants.blockType.receive,
              constants.blockType.open
            ])
            .where(function () {
              this.whereNull('subtype')
              this.orWhereIn('subtype', [
                constants.blockSubType.open,
                constants.blockSubType.receive
              ])
            })
        } else {
          this.select('representative as destination_account')
            .whereIn('type', [
              constants.blockType.state,
              constants.blockType.change
            ])
            .where(function () {
              this.whereNull('subtype')
              this.orWhere('subtype', constants.blockSubType.change)
            })
        }
      })

    cache.set(cache_key, rows, 60)
    res.status(200).send(rows)
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

router.use('/:address/balance_history', balance_history)
router.use('/send', send)
router.use('/unconfirmed', unconfirmed)

export default router
