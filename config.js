// config.js dengan environment variables
global.dbConfig = {
  host: process.env.DB_HOST || 'db.octavia.id',
  user: process.env.DB_USER || 'o1218_ArgasID',
  password: process.env.DB_PASSWORD || '9iR1eFbn6#6E@A',
  database: process.env.DB_NAME || 'o1218_ArgasID',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

module.exports = global.dbConfig;