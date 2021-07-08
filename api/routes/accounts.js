const express = require('express')
const router = express.Router()

router.get('/:address/transactions/:type', async (req, res) => {
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

    const types = ['send', 'receive']
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
      .from(function () {
        this.select('account as source_account')
          .select('link_as_account as destination_account')
          .select('amount')
          .select('local_timestamp')
          .from('blocks')
          .where('account', address)
          .as('t1')

        if (type === 'send') {
          this.whereIn('type', [1, 4]).where(function () {
            this.whereNull('subtype')
            this.orWhere('subtype', 3)
          })
        } else {
          this.whereIn('type', [1, 2, 3]).where(function () {
            this.whereNull('subtype')
            this.orWhereIn('subtype', [1, 2])
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

module.exports = router
