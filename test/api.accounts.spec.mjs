/* global describe before it */
import chai from 'chai'
import chaiHTTP from 'chai-http'

import { mocha_global_setup } from './global.mjs'
import server from '#api'

process.env.NODE_ENV = 'test'
chai.use(chaiHTTP)
const expect = chai.expect

describe('API /accounts', () => {
  before(mocha_global_setup)

  describe('GET /accounts', () => {
    it('should return 200', async () => {
      const response = await chai.request(server).get('/api/accounts')
      expect(response).to.have.status(200)
    })

    // TODO mock database and test tags, accounts, offset, limit
  })

  describe('errors', () => {
    it('should return 400 for invalid limit values', async () => {
      const invalid_limits = ['-1', '101', 'abc', '']
      for (const limit of invalid_limits) {
        const response = await chai
          .request(server)
          .get(`/api/accounts?limit=${limit}`)
        expect(response).to.have.status(400)
        expect(response.body.error).to.equal(
          'Limit must be a number between 0 and 100'
        )
      }
    })

    it('should return 400 for invalid offset values', async () => {
      const invalid_offsets = ['-1', 'abc', '']
      for (const offset of invalid_offsets) {
        const response = await chai
          .request(server)
          .get(`/api/accounts?offset=${offset}`)
        expect(response).to.have.status(400)
        expect(response.body.error).to.equal(
          'Offset must be a positive integer'
        )
      }
    })
  })
})
