module.exports = {
  port: 8080,
  jwt: {
    secret: 'xxx',
    algorithms: ['HS256'],
    credentailsRequired: false
  },
  ssl: false,
  key: '',
  cert: '',
  url: '',
  websocketAddress: '',
  rpcAddress: '',
  mysql: {
    client: 'mysql',
    connection: {
      host: 'localhost',
      user: 'root',
      password: 'xxxxx',
      database: 'nanodb_development'
    },
    pool: {
      min: 2,
      max: 10
    }
  },
  postgresql: {
    client: 'pg',
    connection: {
      host: 'localhost',
      user: 'root',
      password: 'xxxxx',
      database: 'nanodb_development',
      port: '5432'
    }
  },
  neo4j: {
    client: 'neo4j',
    connection: {
      host: 'localhost',
      user: 'neo4j',
      password: 'neo4j',
      port: '7687'
    }
  }
}
