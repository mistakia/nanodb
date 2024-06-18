import express from 'express'

const router = express.Router()

router.get('/?', async (req, res) => {
  const { logger, cache, db } = req.app.locals
  try {
    const cache_key = '/price_history'
    const cached = await cache.get(cache_key)
    if (cached) {
      return res.json(cached)
    }

    const data = await db('historical_price').orderBy('timestamp_utc', 'asc')

    if (data.length) {
      // set cache for 12 hours
      cache.set(cache_key, data, 60 * 60 * 12)
    }

    res.json(data)
  } catch (error) {
    logger(error)
    res.status(500).json({ error: error.toString() })
  }
})

export default router
