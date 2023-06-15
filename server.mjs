import debug from 'debug'

import { port } from '#config'
import server from '#api'

const logger = debug('server')

debug.enable('server')

const main = async () => {
  server.listen(port, () => logger(`API listening on port ${port}`))
}

try {
  main()
} catch (err) {
  // TODO move to stderr
  logger(err)
}
