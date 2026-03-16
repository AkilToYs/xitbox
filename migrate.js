// migrate.js
const { MongoClient, ObjectId } = require('mongodb');
const { v4: uuidv4 } = require('uuid');

const MONGODB_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME = process.env.DB_NAME || 'dokon_store';

async function migrateUsers() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    const db = client.db(DB_NAME);
    
    const users = await db.collection('users').find({}).toArray();
    
    console.log(`Найдено ${users.length} пользователей для миграции`);
    
    let updatedCount = 0;
    
    for (const user of users) {
      // Если у пользователя нет поля id, добавляем его
      if (!user.id && user._id) {
        const userId = uuidv4();
        await db.collection('users').updateOne(
          { _id: user._id },
          { $set: { id: userId } }
        );
        updatedCount++;
        console.log(`Добавлен ID для пользователя ${user.username}: ${userId}`);
      }
    }
    
    console.log(`Миграция завершена. Обновлено ${updatedCount} пользователей`);
    
  } catch (error) {
    console.error('Ошибка миграции:', error);
  } finally {
    await client.close();
  }
}

// Запуск миграции
migrateUsers().then(() => {
  console.log('Миграция завершена успешно');
  process.exit(0);
}).catch(error => {
  console.error('Ошибка при миграции:', error);
  process.exit(1);
});