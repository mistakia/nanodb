module.exports = {
  BURN_ACCOUNT:
    'nano_1111111111111111111111111111111111111111111111111111hifc8npp',
  OPEN_BLOCK_PREVIOUS:
    '0000000000000000000000000000000000000000000000000000000000000000',
  type: {
    send: 1,
    receive: 2,
    change: 3
  },
  blockType: {
    state: 1,
    open: 2,
    receive: 3,
    send: 4,
    change: 5,
    epoch: 6
  },
  blockSubType: {
    open: 1,
    receive: 2,
    send: 3,
    change: 4,
    epoch: 5
  }
}
