import got from 'got'
import { fileURLToPath } from 'url'
import constants from './constants.mjs'

import config from '#config'

export const debounce = (callback, wait, immediate = false) => {
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

export const isMain = (path) => process.argv[1] === fileURLToPath(path)
export const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const POST = (data) => ({
  method: 'POST',
  body: JSON.stringify(data),
  headers: {
    'Content-Type': 'application/json'
  }
})

export const request = async ({ url, ...options }) =>
  got(url, {
    ...options,
    timeout: {
      request: 10000
    }
  }).json()

const rpcRequest = (data) => {
  return { url: config.rpcAddress, ...POST(data) }
}

export const getFrontierCount = () => {
  const data = {
    action: 'frontier_count'
  }
  const options = rpcRequest(data)
  return request(options)
}

/* eslint-disable camelcase */
export const getLedger = ({
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

export const getBlocksInfo = ({ hashes }) => {
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

export const getAccountInfo = ({ account }) => {
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

export const getChain = ({ block, count }) => {
  const data = {
    action: 'chain',
    block,
    count
  }
  const options = rpcRequest(data)
  return request(options)
}

/* eslint-disable camelcase */
export const formatAccountInfo = ({
  frontier,
  open_block,
  representative_block,
  balance,
  modified_timestamp,
  block_count,
  representative,
  weight,
  pending,
  confirmed_height,
  confirmed_frontier
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
  confirmation_height: confirmed_height,
  confirmation_height_frontier: confirmed_frontier
})

export const formatBlockInfo = ({
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
  previous: contents.previous || null,
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
  subtype: constants.blockSubType[subtype] || null
})
/* eslint-enable camelcase */
