import express from 'express'

import send from './send.mjs'
import unconfirmed from './unconfirmed.mjs'
import account_routes from './account/index.mjs'

const router = express.Router({ mergeParams: true })

router.use('/send', send)
router.use('/unconfirmed', unconfirmed)

router.use('/:address', account_routes)

export default router
