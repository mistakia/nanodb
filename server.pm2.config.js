module.exports = {
  apps: [
    {
      name: 'nanodb-api',
      script: 'server.mjs',
      cwd: '/home/user/projects/nanodb',
      watch: './api',
      env_production: {
        NODE_ENV: 'production'
      },
      max_memory_restart: '2G'
    },
    {
      name: 'nanodb-sync-websocket',
      script: 'scripts/import-websocket.mjs',
      cwd: '/home/user/projects/nanodb',
      watch: '.',
      env_production: {
        NODE_ENV: 'production'
      },
      max_memory_restart: '2G'
    }
  ]
}
