import express from 'express'

import send from './send.mjs'
import unconfirmed from './unconfirmed.mjs'
import account_routes from './account/index.mjs'

const router = express.Router({ mergeParams: true })

router.get('/?', async (req, res) => {
  const { logger, cache, db } = req.app.locals
  try {
    let { tags, accounts, limit = 100, offset = 0 } = req.query

    // Validate limit
    limit = parseInt(limit, 10)
    if (isNaN(limit) || limit < 0 || limit > 100) {
      return res
        .status(400)
        .send({ error: 'Limit must be a number between 0 and 100' })
    }

    // Validate offset
    offset = parseInt(offset, 10)
    if (isNaN(offset) || offset < 0) {
      return res
        .status(400)
        .send({ error: 'Offset must be a positive integer' })
    }

    let accounts_array = accounts ? accounts.toLowerCase().split(',') : []
    let tags_array = tags ? tags.toLowerCase().split(',') : []

    // Alphabetize and remove duplicates
    accounts_array = [...new Set(accounts_array.sort())]
    tags_array = [...new Set(tags_array.sort())]

    let cache_key = ''
    if (accounts_array.length === 0 && tags_array.length === 0) {
      cache_key = `/accounts/offset/${offset}/limit/${limit}`
    } else if (accounts_array.length === 0) {
      cache_key = `/accounts//tags/${tags_array.join(
        ','
      )}/offset/${offset}/limit/${limit}`
    } else if (tags_array.length === 0) {
      cache_key = `/accounts/${accounts_array.join(
        ','
      )}/offset/${offset}/limit/${limit}`
    } else {
      cache_key = `/accounts/${accounts_array.join(',')}/tags/${tags_array.join(
        ','
      )}/offset/${offset}/limit/${limit}`
    }

    const cache_value = cache.get(cache_key)

    if (cache_value) {
      return res.send(cache_value)
    }

    const query = db('accounts').select('accounts.*')

    query.leftJoin(
      'accounts_tags',
      'accounts.account',
      '=',
      'accounts_tags.account'
    )

    if (accounts_array.length > 0) {
      query.whereIn('account', accounts_array)
    }

    if (tags_array.length > 0) {
      query.whereIn('accounts_tags.tag', tags_array)
    }

    // Add a query to get all tags for each account
    query
      .select(db.raw('ARRAY_AGG(accounts_tags.tag) as tags'))
      .groupBy('accounts.account')

    query.limit(limit).offset(offset)

    const result = await query

    if (result.length > 0) {
      // cache for 1 hour
      cache.set(cache_key, result, 3600)
    }

    res.status(200).send(result)
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.message })
  }
})

router.use('/send', send)
router.use('/unconfirmed', unconfirmed)

router.use('/:address', account_routes)

export default router
