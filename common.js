const fs = require('fs')
const path = require('path')
const { default: fetch, Request } = require('node-fetch')

const constants = require('./constants')
const config = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, 'config.json'))
)

const debounce = (callback, wait, immediate = false) => {
  let timeout = null

  return function () {
    const callNow = immediate && !timeout
    const next = () => callback.apply(this, arguments)

    clearTimeout(timeout)
    timeout = setTimeout(next, wait)

    if (callNow) {
      next()
    }
  }
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

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
  return { url: config.rpcAddress, ...POST(data) }
}

const getFrontierCount = () => {
  const data = {
    action: 'frontier_count'
  }
  const options = rpcRequest(data)
  return request(options)
}

/* eslint-disable camelcase */
const getLedger = ({
  account = constants.BURN_ACCOUNT,
  count = 1,
  threshold = 100000000000000000,
  modified_since,
  sorting
}) => {
  const data = {
    action: 'ledger',
    pending: true,
    representative: true,
    weight: true,
    account,
    threshold,
    count,
    modified_since,
    sorting
  }
  const options = rpcRequest(data)
  return request(options)
}
/* eslint-enable camelcase */

const getBlocksInfo = ({ hashes }) => {
  const data = {
    action: 'blocks_info',
    include_not_found: true,
    source: true,
    json_block: true,
    hashes
  }
  const options = rpcRequest(data)
  return request(options)
}

const getAccountInfo = ({ account }) => {
  const data = {
    action: 'account_info',
    account,
    representative: true,
    weight: true,
    pending: true,
    include_confirmed: true
  }
  const options = rpcRequest(data)
  return request(options)
}

const getChain = ({ block, count }) => {
  const data = {
    action: 'chain',
    block,
    count
  }
  const options = rpcRequest(data)
  return request(options)
}

/* eslint-disable camelcase */
const formatAccountInfo = ({
  frontier,
  open_block,
  representative_block,
  balance,
  modified_timestamp,
  block_count,
  representative,
  weight,
  pending,
  confirmation_height,
  confirmation_height_frontier
}) => ({
  frontier,
  open_block,
  representative_block,
  balance,
  modified_timestamp,
  block_count,
  representative,
  weight,
  pending,
  confirmation_height,
  confirmation_height_frontier
})

const formatBlockInfo = ({
  amount,
  balance,
  block_account,
  height,
  local_timestamp,
  confirmed,
  contents,
  subtype,
  source_account
}) => ({
  amount,
  balance,
  height,
  local_timestamp,
  confirmed: confirmed === 'true',
  account: contents.account || block_account,
  previous: contents.previous,
  representative: contents.representative,
  link: contents.link || contents.destination || contents.source,
  link_account:
    (source_account !== '0' && source_account) || // receive
    (contents.link_as_account !== constants.BURN_ACCOUNT &&
      contents.link_as_account) || // send
    contents.destination || // send
    contents.representative || // change
    null,
  signature: contents.signature,
  work: contents.work,
  type: constants.blockType[contents.type],
  subtype: constants.blockSubType[subtype]
})
/* eslint-enable camelcase */

module.exports = {
  getFrontierCount,
  getAccountInfo,
  getChain,
  getLedger,
  getBlocksInfo,
  formatBlockInfo,
  formatAccountInfo,
  wait,
  debounce
}
