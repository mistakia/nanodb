module.exports = {
  apps: [
    {
      script: 'server.js',
      // watch: '.',
      env_production: {
        NODE_ENV: 'production'
      },
      max_memory_restart: '2G'
    }
  ]
}
