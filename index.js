const yargs = require('yargs/yargs')
const debug = require('debug')
const { hideBin } = require('yargs/helpers')
const argv = yargs(hideBin(process.argv)).argv
const { default: fetch, Request } = require('node-fetch')

const constants = require('./constants')
const config = require('./config')
const logger = debug('script')
debug.enable('script')

const POST = (data) => ({
  method: 'POST',
  body: JSON.stringify(data),
  headers: {
    'Content-Type': 'application/json'
  }
})

const request = async (options) => {
  const request = new Request(options.url, options)
  const response = await fetch(request)
  if (response.status >= 200 && response.status < 300) {
    return response.json()
  } else {
    const res = await response.json()
    const error = new Error(res.error || response.statusText)
    error.response = response
    throw error
  }
}

const rpcRequest = (data) => {
  return { url: config.nodeAddress, ...POST(data) }
}

const getFrontierCount = () => {
  const data = {
    action: 'frontier_count'
  }
  const options = rpcRequest(data)
  return request(options)
}

const getFrontiers = ({ account, count = 1 }) => {
  const data = {
    action: 'frontiers',
    account,
    count
  }
  const options = rpcRequest(data)
  return request(options)
}

const main = async () => {
  const frontierCount = await getFrontierCount()
  logger(frontierCount)

  const frontiers = await getFrontiers({
    account: constants.BURN_ACCOUNT,
    count: 100
  })
  logger(frontiers)
}

try {
  main()
} catch (e) {
  console.log(e)
}
