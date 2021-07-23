const express = require('express')

const send = require('./send')
// const change = require('./change')
// const count = require('./count')

const router = express.Router()

router.use('/send', send)
// router.use('/change', change)
// router.use('/count', count)

module.exports = router
