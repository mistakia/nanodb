import express from 'express'

import constants from '#constants'
import send from './send.mjs'

const router = express.Router()

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

    const cacheKey = `/account/${address}/summary`
    const cacheValue = cache.get(cacheKey)
    if (cacheValue) {
      return res.status(200).send(cacheValue)
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
    if (funding.length) cache.set(cacheKey, data, 60)
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

    const cacheKey = `/account/${address}/${type}/${offset},${limit}`
    const cacheValue = cache.get(cacheKey)
    if (cacheValue) {
      return res.status(200).send(cacheValue)
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

    cache.set(cacheKey, rows, 60)
    res.status(200).send(rows)
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

router.use('/send', send)

export default router
