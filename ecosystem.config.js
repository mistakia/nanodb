module.exports = {
  apps: [
    {
      name: 'nanodb-api',
      script: 'server.mjs',
      watch: './api',
      env_production: {
        NODE_ENV: 'production'
      },
      max_memory_restart: '2G'
    },
    {
      name: 'nanodb-sync-websocket',
      script: 'scripts/import-websocket.mjs',
      watch: '.',
      env_production: {
        NODE_ENV: 'production'
      },
      max_memory_restart: '2G'
    }
  ]
}
