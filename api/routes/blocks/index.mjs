import express from 'express'

import send from './send.mjs'
// import change from './change.mjs'
// import count from './count.mjs'
import unconfirmed from './unconfirmed.mjs'
import confirmed from './confirmed.mjs'

const router = express.Router()

router.use('/send', send)
router.use('/unconfirmed', unconfirmed)
router.use('/confirmed', confirmed)

// router.use('/change', change)
// router.use('/count', count)

export default router
