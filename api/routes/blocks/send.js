const express = require('express')
const dayjs = require('dayjs')

const constants = require('../../../constants')

const router = express.Router()

router.get('/?', async (req, res) => {
  const { logger, cache, db } = req.app.locals
  try {
    // TODO includeAccounts
    // TODO excludeAccounts
    const maxHours = 1 // TODO - fix slow query
    const hours = Math.min(
      Math.abs(parseInt(req.query.hours || 24, 10)),
      maxHours
    )

    const defaultLimit = 100
    const limit = Math.min(parseInt(req.query.limit || defaultLimit, 0), 100)
    const offset = parseInt(req.query.offset, 0) || 0

    const cacheKey = `/blocks/send/${hours}`
    const cacheValue = cache.get(cacheKey)
    if (cacheValue) {
      return res.status(200).send(cacheValue)
    }

    const cutoff = dayjs().subtract(hours, 'hours')

    const blocks = await db('blocks')
      .where('local_timestamp', '>', cutoff.unix())
      .whereIn('type', [constants.blockType.state, constants.blockType.send])
      .where(function () {
        this.whereNull('subtype')
        this.orWhere('subtype', constants.blockSubType.send)
      })
      .orderBy('amount', 'desc')
      .limit(limit)
      .offset(offset)

    if (blocks.length) cache.set(cacheKey, blocks, 60)
    res.status(200).send(blocks)
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

module.exports = router
