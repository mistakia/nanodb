import express from 'express'

import send from './send.mjs'
import unconfirmed from './unconfirmed.mjs'
import account_routes from './account/index.mjs'
import balance_history from './balance_history.mjs'

const router = express.Router({ mergeParams: true })

router.use('/balance_history', balance_history)
router.use('/send', send)
router.use('/unconfirmed', unconfirmed)

router.use('/:address', account_routes)

export default router
