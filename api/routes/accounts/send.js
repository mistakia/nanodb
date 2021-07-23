const express = require('express')
const dayjs = require('dayjs')

const constants = require('../../../constants')

const router = express.Router()

router.get('/?', async (req, res) => {
  const { logger, cache, db } = req.app.locals
  try {
    const maxHours = 720 // 1m
    const hours = Math.min(
      Math.abs(parseInt(req.query.hours || 24, 10)),
      maxHours
    )
    const limit = Math.min(parseInt(req.query.limit || 10, 0), 100)
    const offset = parseInt(req.query.offset, 0) || 0

    const cacheKey = `/accounts/send/${hours}`
    const cacheValue = cache.get(cacheKey)
    if (cacheValue) {
      return res.status(200).send(cacheValue)
    }

    const cutoff = dayjs().subtract(hours, 'hours')

    const accounts = await db('blocks')
      .select('account')
      .count('* as block_count')
      .sum('amount as total_amount')
      .max('amount as max_amount')
      .min('amount as min_amount')
      .where('local_timestamp', '>', cutoff.unix())
      .whereIn('type', [constants.blockType.state, constants.blockType.send])
      .where(function () {
        this.whereNull('subtype')
        this.orWhere('subtype', constants.blockSubType.send)
      })
      .orderBy('total_amount', 'desc')
      .limit(limit)
      .offset(offset)
      .groupBy('account')

    if (accounts.length) cache.set(cacheKey, accounts, 60)
    res.status(200).send(accounts)
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

module.exports = router
