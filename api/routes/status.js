const express = require('express')
const router = express.Router()

router.get('/?', async (req, res) => {
  const { logger, db, cache } = req.app.locals
  try {
    const cache_key = '/api/status'
    const cached = cache.get(cache_key)
    if (cached) {
      return res.status(200).send(cached)
    }

    const accounts = await db('accounts').count('* as accounts')
    const blocks = await db('blocks').count('* as blocks')

    const data = {
      accounts: accounts.length ? accounts[0].accounts : null,
      blocks: blocks.length ? blocks[0].blocks : null
    }

    res.status(200).send(data)
    cache.set(cache_key, data, 3600)
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

module.exports = router
