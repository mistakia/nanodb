import express from 'express'

const router = express.Router({ mergeParams: true })

router.get('/?', async (req, res) => {
  const { logger, cache, db } = req.app.locals
  try {
    const { address } = req.params

    if (!address) {
      return res.status(400).json({ error: 'missing address' })
    }

    const re = /^(nano|xrb)_[13]{1}[13456789abcdefghijkmnopqrstuwxyz]{59}$/gi
    if (!re.test(address)) {
      return res.status(401).send({ error: 'invalid address' })
    }

    const cache_key = `/account/${address}/balance_history`
    const cache_value = cache.get(cache_key)

    if (cache_value) {
      return res.json(cache_value)
    }

    const data = await db
      .with(
        'daily_last_transaction',
        db.raw(
          `
          SELECT
            EXTRACT(EPOCH FROM DATE(to_timestamp(local_timestamp)))::INTEGER AS date_unix,
            MAX(local_timestamp) AS max_timestamp
          FROM
            blocks
          WHERE
            account = ?
          GROUP BY
            DATE(to_timestamp(local_timestamp))
          `,
          [address]
        )
      )
      .select('daily_last_transaction.date_unix', 'b.balance')
      .from('daily_last_transaction')
      .joinRaw(
        `
        JOIN blocks b ON b.local_timestamp = daily_last_transaction.max_timestamp
        AND EXTRACT(EPOCH FROM DATE(to_timestamp(b.local_timestamp)))::INTEGER = daily_last_transaction.date_unix
        `
      )
      .where('b.account', address)
      .orderBy('daily_last_transaction.date_unix', 'asc')

    if (data.length) {
      // 12 hours
      cache.set(cache_key, data, 60 * 60 * 12)
    }
    res.json(data)
  } catch (error) {
    logger(error)
    res.status(500).json({ error: error.toString() })
  }
})

export default router
