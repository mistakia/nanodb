import express from 'express'
import dayjs from 'dayjs'

import constants from '#constants'

const router = express.Router()

router.get('/?', async (req, res) => {
  const { logger, cache, db } = req.app.locals
  try {
    const maxHours = 168 // 1w
    const hours = Math.min(
      Math.abs(parseInt(req.query.hours || 24, 10)),
      maxHours
    )

    const defaultLimit = 100
    const limit = Math.min(parseInt(req.query.limit || defaultLimit, 0), 100)

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
      .groupBy('account')

    if (accounts.length) cache.set(cacheKey, accounts, 60)
    res.status(200).send(accounts)
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

export default router
