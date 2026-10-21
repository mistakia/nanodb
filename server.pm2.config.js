module.exports = {
  apps: [
    {
      name: 'nanodb-api',
      script: 'server.mjs',
      // The fleet node through nvm's `current`, so a restart after a fleet node
      // bump runs the new version (bootstrap docs/guides/toolchain.md).
      interpreter: require('path').join(
        require('os').homedir(),
        '.nvm/versions/node/current/bin/node'
      ),
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
      // The fleet node through nvm's `current`, so a restart after a fleet node
      // bump runs the new version (bootstrap docs/guides/toolchain.md).
      interpreter: require('path').join(
        require('os').homedir(),
        '.nvm/versions/node/current/bin/node'
      ),
      cwd: '/home/user/projects/nanodb',
      watch: '.',
      env_production: {
        NODE_ENV: 'production'
      },
      max_memory_restart: '2G'
    }
  ]
}
