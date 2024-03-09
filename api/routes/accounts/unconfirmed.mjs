import express from 'express'

const router = express.Router()

router.get('/summary', async (req, res) => {
  const { logger, db } = req.app.locals
  try {
    // number of accounts with unconfirmed blocks
    const { count: unconfirmed_accounts_count } = await db('accounts as acc')
      .count('acc.account')
      .where('acc.confirmation_height', '!=', db.raw('acc.block_count'))
      .first()

    res.status(200).send({
      unconfirmed_accounts_count: Number(unconfirmed_accounts_count)
    })
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

// return a list of accounts with unconfirmed blocks
router.get('/?', async (req, res) => {
  const { logger, db } = req.app.locals
  try {
    const limit = Math.min(Number(req.query.limit || 100), 100)
    const offset = Number(req.query.offset) || 0
    const balance_min = Number(req.query.balance_min) || null
    const balance_max = Number(req.query.balance_max) || null

    // validate balance_min
    const max_raw_balance = 133248297000000000000000000000000000000
    if (balance_min != null) {
      if (
        balance_min > max_raw_balance ||
        balance_min < 0 ||
        !Number.isInteger(balance_min)
      ) {
        return res.status(400).send({
          error:
            'balance_min must be a positive integer and cannot exceed maximum raw amount'
        })
      }
    }

    // validate balance_max
    if (balance_max != null) {
      if (
        balance_max > max_raw_balance ||
        balance_max < 0 ||
        !Number.isInteger(balance_max)
      ) {
        return res.status(400).send({
          error:
            'balance_max must be a positive integer and cannot exceed maximum raw amount'
        })
      }
    }

    const sort_by = req.query.sort_by || 'unconfirmed_blocks'
    const sort_order = req.query.sort_order || 'desc'

    // Validate sort_by parameter
    const valid_sort_options = [
      'unconfirmed_blocks',
      'oldest_unconfirmed_block_timestamp'
    ]
    if (!valid_sort_options.includes(sort_by)) {
      return res.status(400).send({ error: 'Invalid sort_by parameter' })
    }

    // Validate sort_order parameter
    const valid_sort_orders = ['asc', 'desc']
    if (!valid_sort_orders.includes(sort_order)) {
      return res.status(400).send({ error: 'Invalid sort_order parameter' })
    }

    // get a list of accounts where the confirmation height does not equal the block height
    // Updated to use the correct column names based on the database schema and modified to left join in case the block is missing
    const query = db('accounts as acc')
      .leftJoin('blocks as blk', function () {
        this.on('acc.account', '=', 'blk.account').andOn(
          'acc.confirmation_height',
          '=',
          db.raw('blk.height + 1')
        )
      })
      .leftJoin('blocks as blk2', function () {
        this.on('acc.account', '=', 'blk2.account').andOn(
          'acc.confirmation_height',
          '=',
          'blk2.height'
        )
      })
      .select(
        'acc.account',
        db.raw(
          'acc.block_count - acc.confirmation_height as unconfirmed_blocks'
        ),
        'blk.local_timestamp as oldest_unconfirmed_block_timestamp',
        'blk.hash as oldest_unconfirmed_block_hash',
        'blk2.local_timestamp as newest_confirmed_block_timestamp',
        'blk2.hash as newest_confirmed_block_hash'
      )
      .where('acc.confirmation_height', '!=', db.raw('acc.block_count'))
      .orderBy(sort_by, sort_order)
      .limit(limit)
      .offset(offset)

    if (balance_min) {
      query.andWhere('acc.balance', '>=', balance_min)
    }
    if (balance_max) {
      query.andWhere('acc.balance', '<=', balance_max)
    }

    const rows = await query

    res.status(200).send(rows)
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

export default router
