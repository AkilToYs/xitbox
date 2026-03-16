// migrateLogs.js
const { database } = require('./database');
const { ObjectId } = require('mongodb');

async function migrateLogs() {
    try {
        await database.connect();
        
        // Получаем все логи
        const logs = await database.db.collection('userLogs').find({}).toArray();
        
        console.log(`Found ${logs.length} logs to check`);
        
        let updatedCount = 0;
        
        for (const log of logs) {
            // Если userId в логе - это ObjectId (строка), находим пользователя и обновляем на UUID
            if (log.userId && ObjectId.isValid(log.userId)) {
                // Находим пользователя по _id
                const user = await database.db.collection('users').findOne({
                    _id: new ObjectId(log.userId)
                });
                
                if (user && user.id) {
                    // Обновляем лог
                    await database.db.collection('userLogs').updateOne(
                        { _id: log._id },
                        { $set: { userId: user.id } }
                    );
                    updatedCount++;
                    console.log(`Updated log ${log._id}: ${log.userId} -> ${user.id}`);
                }
            }
        }
        
        console.log(`Migration completed. ${updatedCount} logs updated.`);
        
        await database.disconnect();
        console.log('Migration finished successfully');
    } catch (error) {
        console.error('Migration error:', error);
    }
}

migrateLogs();