module.exports = {
  apps: [
    {
      name: 'nanodb-api',
      script: 'server.js',
      watch: './api',
      env_production: {
        NODE_ENV: 'production'
      },
      max_memory_restart: '2G'
    }
  ]
}
