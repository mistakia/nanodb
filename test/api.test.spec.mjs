/* global describe before it */
import chai from 'chai'
import chaiHTTP from 'chai-http'

import { mocha_global_setup } from './global.mjs'
import server from '#api'

process.env.NODE_ENV = 'test'
chai.use(chaiHTTP)
const expect = chai.expect

describe('API /status', () => {
  before(mocha_global_setup)

  describe('GET /status', () => {
    it('should return 200', async () => {
      const response = await chai.request(server).get('/api/status')

      expect(response).to.have.status(200)

      expect(response.body).to.be.an('object')
      expect(response.body).to.have.all.keys('accounts', 'blocks')
      expect(response.body.accounts).to.satisfy(
        (num) => (Number.isInteger(num) && num >= 0) || num === null
      )
      expect(response.body.blocks).to.satisfy(
        (num) => (Number.isInteger(num) && num >= 0) || num === null
      )
    })
  })
})
