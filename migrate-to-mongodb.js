// migrate-to-mongodb.js
require('dotenv').config();
const fs = require('fs').promises;
const path = require('path');

// Подключение к MongoDB
const { MongoClient } = require('mongodb');

async function migrateData() {
    const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
    const DB_NAME = process.env.DB_NAME || 'dokon_store';
    
    const client = new MongoClient(MONGODB_URI);
    
    try {
        await client.connect();
        const db = client.db(DB_NAME);
        
        // Чтение данных из JSON файла
        const jsonPath = path.join(__dirname, 'data', 'database.json');
        const jsonData = await fs.readFile(jsonPath, 'utf8');
        const data = JSON.parse(jsonData);
        
        console.log('Starting migration...');
        
        // Миграция пользователей
        if (data.users && data.users.length > 0) {
            await db.collection('users').insertMany(data.users);
            console.log(`✅ Migrated ${data.users.length} users`);
        }
        
        // Миграция продуктов
        if (data.products && data.products.length > 0) {
            await db.collection('products').insertMany(data.products);
            console.log(`✅ Migrated ${data.products.length} products`);
        }
        
        // Миграция продаж
        if (data.sales && data.sales.length > 0) {
            await db.collection('sales').insertMany(data.sales);
            console.log(`✅ Migrated ${data.sales.length} sales`);
        }
        
        // Миграция логов склада
        if (data.warehouseLogs && data.warehouseLogs.length > 0) {
            await db.collection('warehouseLogs').insertMany(data.warehouseLogs);
            console.log(`✅ Migrated ${data.warehouseLogs.length} warehouse logs`);
        }
        
        // Миграция накладных
        if (data.invoices && data.invoices.length > 0) {
            await db.collection('invoices').insertMany(data.invoices);
            console.log(`✅ Migrated ${data.invoices.length} invoices`);
        }
        
        // Миграция уведомлений (если есть)
        if (data.notifications && data.notifications.length > 0) {
            await db.collection('notifications').insertMany(data.notifications);
            console.log(`✅ Migrated ${data.notifications.length} notifications`);
        }
        
        console.log('✅ Migration completed successfully!');
        
    } catch (error) {
        console.error('Migration error:', error);
    } finally {
        await client.close();
    }
}

// Запуск миграции
migrateData().then(() => {
    console.log('Migration script finished');
    process.exit(0);
}).catch(error => {
    console.error('Migration failed:', error);
    process.exit(1);
});