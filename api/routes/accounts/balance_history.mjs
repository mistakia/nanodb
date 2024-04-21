import express from 'express'

const router = express.Router({ mergeParams: true })

router.get('/?', async (req, res) => {
  const { logger, cache, db } = req.app.locals
  try {
    const { accounts, tags } = req.query

    // Validation for at least one account or one tag
    if (!accounts && !tags) {
      return res.status(400).json({ error: 'missing accounts or tags' })
    }

    let accounts_array = accounts ? accounts.toLowerCase().split(',') : []
    let tags_array = tags ? tags.toLowerCase().split(',') : []

    // Alphabetize and remove duplicates
    accounts_array = [...new Set(accounts_array.sort())]
    tags_array = [...new Set(tags_array.sort())]

    // Early return if no accounts and no tags provided
    if (accounts_array.length === 0 && tags_array.length === 0) {
      return res.status(400).json({ error: 'missing accounts or tags' })
    }

    let cache_key = ''
    if (accounts_array.length === 0) {
      cache_key = `/accounts//tags/${tags_array.join(',')}/balance_history`
    } else if (tags_array.length === 0) {
      cache_key = `/accounts/${accounts_array.join(',')}/tags//balance_history`
    } else {
      cache_key = `/accounts/${accounts_array.join(',')}/tags/${tags_array.join(
        ','
      )}/balance_history`
    }
    const cache_value = cache.get(cache_key)

    if (cache_value) {
      return res.json(cache_value)
    }

    const query = db
      .with(
        'tagged_accounts',
        db.select('account').from('accounts_tags').whereIn('tag', tags_array)
      )
      .with(
        'daily_last_transaction',
        db.raw(
          `
          SELECT
            account,
            EXTRACT(EPOCH FROM DATE(to_timestamp(COALESCE(NULLIF(local_timestamp, 0), 1550832660))))::INTEGER AS date_unix,
            DATE(to_timestamp(COALESCE(NULLIF(local_timestamp, 0), 1550832660))) AS date,
            MAX(height) AS max_height
          FROM
            blocks
          WHERE
            account = ANY(ARRAY(SELECT account FROM tagged_accounts) || ?)
          GROUP BY
            account, date
          `,
          [accounts_array]
        )
      )
      .select(
        'daily_last_transaction.account',
        'daily_last_transaction.date_unix',
        'daily_last_transaction.date',
        'b.balance'
      )
      .from('daily_last_transaction')
      .joinRaw(
        `
        JOIN blocks b ON b.height = daily_last_transaction.max_height
        `
      )
      .orderBy([
        { column: 'daily_last_transaction.account', order: 'asc' },
        { column: 'daily_last_transaction.date_unix', order: 'asc' }
      ])

    const data = await query

    if (data.length) {
      // 12 hours
      cache.set(cache_key, data, 60 * 60 * 12)
    }
    res.json(data)
  } catch (error) {
    logger.error(error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
