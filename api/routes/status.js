const express = require('express')
const router = express.Router()

router.get('/?', async (req, res) => {
  const { logger, db } = req.app.locals
  try {
    const accounts = await db('accounts').count('* as accounts')
    const blocks = await db('blocks').count('* as blocks')

    const data = {
      accounts: accounts.length ? accounts[0].accounts : null,
      blocks: blocks.length ? blocks[0].blocks : null
    }

    res.status(200).send(data)
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

module.exports = router
