import ReconnectingWebSocket from 'reconnecting-websocket'
import WS from 'ws'
import debug from 'debug'

import config from '#config'
import db from '#db'

const BATCH_SIZE = 1000
const logger = debug('ws:votes')
debug.enable('ws:votes')

const ws = new ReconnectingWebSocket(config.websocketAddress, [], {
  WebSocket: WS,
  connectionTimeout: 1000,
  maxRetries: 100000,
  maxReconnectionDelay: 2000,
  minReconnectionDelay: 10
})

let votes = []

const save = async () => {
  if (!votes.length) return

  const inserts = votes
  votes = []
  await db('votes')
    .insert(inserts)
    .onConflict(['account', 'hash', 'vote_timestamp'])
    .ignore()
  logger(`saved ${inserts.length} votes`)
}

ws.onopen = () => {
  logger('connected')
  const subscription = {
    action: 'subscribe',
    topic: 'vote',
    options: {
      include_indeterminate: 'true'
    }
  }
  ws.send(JSON.stringify(subscription))
}

ws.onclose = () => {
  logger('disconnected')
}

ws.onerror = (err) => {
  logger('error:', err)
}

ws.onmessage = (msg) => {
  const { topic, message } = JSON.parse(msg.data)
  const { account, timestamp, blocks } = message

  if (topic === 'vote') {
    const localTimestamp = Math.round(Date.now() / 1000)

    blocks.forEach((hash) => {
      votes.push({
        hash,
        account,
        vote_timestamp: timestamp,
        local_timestamp: localTimestamp
      })
    })

    if (votes.length > BATCH_SIZE) save()
  }
}
