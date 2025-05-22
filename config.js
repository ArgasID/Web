module.exports = {
    // Konfigurasi Database
    dbConfig: {
        host: process.env.DB_HOST || 'db.octavia.id',
        user: process.env.DB_USER || 'o1218_ArgasID',
        password: process.env.DB_PASS || '9iR1eFbn6#6E@A',
        database: process.env.DB_NAME || 'o1218_ArgasID',
        port: process.env.DB_PORT || 3306
    },

    // Konfigurasi Tripay API
    tripayConfig: {
        apiKey: process.env.API_TRIPAY || 'DEV-W9seWzfdx3WY1A0b0pL1hxiV3CPY2TzClxhDyk37',
        privateKey: process.env.PRIVATE_TRIPAY || '0ns6O-O3yy9-6WUom-NK2ve-IhC7z',
        merchantCode: process.env.MERCHANT_TRIPAY || 'T40456',
        baseUrl: process.env.TRIPAY_BASE_URL || 'https://tripay.co.id/api-sandbox',
        callbackUrl: process.env.TRIPAY_CALLBACK_URL || 'http://localhost:3000/api/payment/callback'
    },

    // Konfigurasi Aplikasi
    appConfig: {
        port: process.env.PORT || 3000,
        env: process.env.NODE_ENV || 'development'
    }
};