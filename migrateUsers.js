// migrateUsers.js
const { database } = require('./database');
const { v4: uuidv4 } = require('uuid');
const { ObjectId } = require('mongodb'); // Добавьте эту строку

async function migrateUsers() {
    try {
        await database.connect();
        
        // Получаем всех пользователей
        const users = await database.db.collection('users').find({}).toArray();
        
        console.log(`Found ${users.length} users to migrate`);
        
        let migratedCount = 0;
        
        for (const user of users) {
            // Если у пользователя нет поля id, создаем его
            if (!user.id) {
                const newId = uuidv4();
                await database.db.collection('users').updateOne(
                    { _id: user._id },
                    { $set: { id: newId } }
                );
                migratedCount++;
                console.log(`Migrated user: ${user.username}`);
            }
            
            // Также добавляем недостающие поля
            const updateFields = {};
            
            if (!user.status) updateFields.status = 'active';
            if (!user.createdAt) updateFields.createdAt = new Date().toISOString();
            if (!user.updatedAt) updateFields.updatedAt = new Date().toISOString();
            
            if (Object.keys(updateFields).length > 0) {
                await database.db.collection('users').updateOne(
                    { _id: user._id },
                    { $set: updateFields }
                );
            }
        }
        
        console.log(`Migration completed. ${migratedCount} users migrated.`);
        
        // Также обновляем логи пользователей
        const logs = await database.db.collection('userLogs').find({}).toArray();
        
        for (const log of logs) {
            // Если в логах userId это ObjectId, обновляем его на строковый id
            if (log.userId && ObjectId.isValid(log.userId)) {
                // Находим пользователя по ObjectId
                const user = await database.db.collection('users').findOne({ 
                    _id: new ObjectId(log.userId) 
                });
                
                if (user && user.id) {
                    // Обновляем userId в логе
                    await database.db.collection('userLogs').updateOne(
                        { _id: log._id },
                        { $set: { userId: user.id } }
                    );
                    console.log(`Updated log for user: ${user.username}`);
                }
            }
        }
        
        await database.disconnect();
        console.log('Migration finished successfully');
    } catch (error) {
        console.error('Migration error:', error);
    }
}

migrateUsers();