// resetStock.js
const { MongoClient } = require('mongodb');
require('dotenv').config(); // если используете переменные окружения

async function resetAllStock() {
  // Получаем URI из переменной окружения или используем localhost
  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017';
  const dbName = process.env.DB_NAME || 'dokon_store';
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');

    const db = client.db(dbName);
    const productsCollection = db.collection('products'); // название коллекции из database.js

    // Обновляем все документы, устанавливая stock: 0
    const result = await productsCollection.updateMany(
      {}, // пустой фильтр – все документы
      { $set: { stock: 0 } }
    );

    console.log(`✅ Обновлено документов: ${result.modifiedCount}`);
  } catch (err) {
    console.error('❌ Ошибка:', err);
  } finally {
    await client.close();
    console.log('🔌 Соединение закрыто');
  }
}

resetAllStock();