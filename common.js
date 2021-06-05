const fs = require('fs')
const path = require('path')
const { default: fetch, Request } = require('node-fetch')

const constants = require('./constants')
const config = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, 'config.json'))
)

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

const getLedger = ({ account, count = 1, threshold = 100000000000000000 }) => {
  const data = {
    action: 'ledger',
    pending: true,
    account,
    threshold,
    count
  }
  const options = rpcRequest(data)
  return request(options)
}

const getBlock = async (hash) => {
  const data = {
    action: 'blocks_info',
    json_block: true,
    source: true,
    hashes: [hash]
  }
  const options = rpcRequest(data)
  const res = await request(options)
  return res.blocks[hash]
}

const getBlocksInfo = ({ hashes }) => {
  const data = {
    action: 'blocks_info',
    include_not_found: true,
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

const formatBlockInfo = ({
  amount,
  balance,
  height,
  local_timestamp,
  confirmed,
  contents,
  subtype
}) => ({
  amount,
  balance,
  height,
  local_timestamp,
  confirmed: confirmed === 'true',
  account: contents.account,
  previous: contents.previous,
  representative: contents.representative,
  link: contents.link,
  link_as_account:
    contents.link_as_account || contents.destination || contents.source,
  signature: contents.signature,
  work: contents.work,
  type: constants.blockType[contents.type],
  subtype: constants.blockSubType[subtype]
})

module.exports = {
  getFrontierCount,
  getAccountInfo,
  getChain,
  getLedger,
  getBlocksInfo,
  getBlock,
  formatBlockInfo,
  wait
}
