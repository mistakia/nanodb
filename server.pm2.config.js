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
  ],

  deploy: {
    production: {
      user: 'root',
      host: 'storage',
      ref: 'origin/main',
      repo: 'https://github.com/mistakia/nanodb.git',
      path: '/home/user/nanodb',
      'pre-deploy': 'git pull',
      'pre-deploy-local': '',
      'post-deploy':
        'source ~/.bash_profile && /home/user/.nvm/versions/node/v16.4.0/bin/yarn install && pm2 reload server.pm2.config.js --env production',
      'pre-setup': ''
    }
  }
}
