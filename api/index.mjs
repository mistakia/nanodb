import https from 'https'
import http from 'http'
import fs from 'fs'
import url from 'url'

import express from 'express'
import debug from 'debug'
import compression from 'compression'
import bodyParser from 'body-parser'
import extend from 'deep-extend'
import morgan from 'morgan-debug'
import cors from 'cors'
import { WebSocketServer } from 'ws'
import jwt from 'jsonwebtoken'
import { expressjwt } from 'express-jwt'

import config from '#config'
import * as routes from './routes/index.mjs'
import db from '#db'
import cache from '#api/cache.mjs'
// import sockets from './sockets.mjs'

const logger = debug('api')

const defaults = {}
const options = extend(defaults, config)
const IS_DEV = process.env.NODE_ENV === 'development'
const IS_PROD = process.env.NODE_ENV === 'production'

if (IS_DEV) {
  debug.enable('server,api*,knex:*')
} else if (IS_PROD) {
  debug.enable('server,api*')
}

const api = express()

api.locals.db = db
api.locals.logger = logger
api.locals.cache = cache

api.enable('etag')
api.disable('x-powered-by')
api.use(compression())
api.use(morgan('api', 'combined'))
api.use(bodyParser.json())
api.use(
  cors({
    origin: true,
    credentials: true
  })
)
api.use('/api/ping', (req, res) => res.status(200).send({ pong: true }))
api.use('/api/status', routes.status)
api.use('/api/ledger', routes.ledger)
api.use('/api/accounts', routes.accounts)
api.use('/api/blocks', routes.blocks)
api.use('/api/stats', routes.stats)
api.use('/api/price_history', routes.price_history)

// protected api routes
api.use('/api/*', expressjwt(config.jwt), (err, req, res, next) => {
  res.set('Expires', '0')
  res.set('Pragma', 'no-cache')
  res.set('Surrogate-Control', 'no-store')
  if (err.code === 'invalid_token') return next()
  return next(err)
})

api.get('*', (req, res) => {
  res.status(404).send({ error: 'not found' })
})

const createServer = () => {
  if (!options.ssl) {
    return http.createServer(api)
  }

  const sslOptions = {
    key: fs.readFileSync(config.key),
    cert: fs.readFileSync(config.cert)
  }
  return https.createServer(sslOptions, api)
}

const server = createServer()
const wss = new WebSocketServer({ noServer: true })

server.on('upgrade', async (request, socket, head) => {
  const parsed = new url.URL(request.url, config.url)
  try {
    const token = parsed.searchParams.get('token')
    const decoded = await jwt.verify(token, config.jwt.secret)
    request.user = decoded
  } catch (error) {
    logger(error)
    return socket.destroy()
  }

  wss.handleUpgrade(request, socket, head, function (ws) {
    ws.userId = request.user.userId
    wss.emit('connection', ws, request)
  })
})

// sockets(wss)

export default server
