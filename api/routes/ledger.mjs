import express from 'express'

const router = express.Router()

router.get('/daily', async (req, res) => {
  const { logger, cache, db } = req.app.locals
  try {
    const cacheKey = '/ledger/daily'
    const cached = cache.get(cacheKey)
    if (cached) {
      return res.status(200).send(cached)
    }

    const data = await db('rollup_daily').orderBy('timestamp', 'desc')
    cache.set(cacheKey, data, 900)
    res.status(200).send(data)
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

export default router
