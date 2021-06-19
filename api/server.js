const https = require('https')
const http = require('http')
const fs = require('fs')
const url = require('url')

const express = require('express')
const debug = require('debug')
const compression = require('compression')
const bodyParser = require('body-parser')
const extend = require('deep-extend')
const NodeCache = require('node-cache')
const morgan = require('morgan-debug')
const cors = require('cors')
const WebSocket = require('ws')
const jwt = require('jsonwebtoken')
const expressJwt = require('express-jwt')

const config = require('../config')
const routes = require('./routes')
const db = require('../db')
// const sockets = require('./sockets')

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
api.locals.cache = new NodeCache({ stdTTL: 600, checkperiod: 120 })

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

api.use('/api/ledger', routes.ledger)

// protected api routes
api.use('/api/*', expressJwt(config.jwt), (err, req, res, next) => {
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
const wss = new WebSocket.Server({ noServer: true })

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

module.exports = server
