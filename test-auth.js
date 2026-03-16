// debug-findUserByUsername.js
const { MongoClient, ObjectId } = require('mongodb');

async function debugFindUserByUsername() {
  console.log('🔍 Отладочный тест функции findUserByUsername\n');
  
  const MONGODB_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
  const DB_NAME = process.env.DB_NAME || 'dokon_store';
  
  let client = null;
  
  try {
    console.log('1. Подключаемся к MongoDB напрямую...');
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db(DB_NAME);
    
    console.log('✅ Подключение установлено\n');
    
    // Проверяем коллекцию users
    console.log('2. Проверяем коллекцию users...');
    const usersCollection = db.collection('users');
    const usersCount = await usersCollection.countDocuments();
    console.log(`✅ Документов в коллекции users: ${usersCount}\n`);
    
    // Выводим всех пользователей
    console.log('3. Все пользователи в базе:');
    const allUsers = await usersCollection.find({}).toArray();
    
    allUsers.forEach((user, index) => {
      console.log(`\n--- Пользователь ${index + 1} ---`);
      console.log('ID:', user._id);
      console.log('username:', user.username);
      console.log('role:', user.role);
      console.log('fullName:', user.fullName);
      console.log('Поля в документе:', Object.keys(user));
      
      // Проверяем, есть ли поле id
      if (user.id) {
        console.log('✓ Есть поле id:', user.id);
      } else {
        console.log('✗ Нет поля id');
      }
    });
    
    console.log('\n4. Тестируем поиск по username...');
    
    // Тест 1: Ищем admin
    console.log('\n   Поиск: { username: "admin" }');
    const admin = await usersCollection.findOne({ username: 'admin' });
    if (admin) {
      console.log('   ✅ Найден:', admin.username);
    } else {
      console.log('   ❌ Не найден');
    }
    
    // Тест 2: Ищем с учетом регистра
    console.log('\n   Поиск: { username: "ADMIN" }');
    const adminUpper = await usersCollection.findOne({ username: 'ADMIN' });
    if (adminUpper) {
      console.log('   ✅ Найден:', adminUpper.username);
    } else {
      console.log('   ❌ Не найден (ожидаемо, поиск регистрозависимый)');
    }
    
    // Тест 3: Ищем с пробелами
    console.log('\n   Поиск: { username: " admin " }');
    const adminWithSpaces = await usersCollection.findOne({ username: ' admin ' });
    if (adminWithSpaces) {
      console.log('   ✅ Найден:', adminWithSpaces.username);
    } else {
      console.log('   ❌ Не найден (ожидаемо)');
    }
    
    console.log('\n5. Проверяем индексы...');
    const indexes = await usersCollection.indexes();
    console.log('Индексы коллекции users:');
    indexes.forEach((index, i) => {
      console.log(`   ${i + 1}.`, index);
    });
    
    // Проверяем, есть ли уникальный индекс на username
    const usernameIndex = indexes.find(idx => idx.key && idx.key.username === 1);
    if (usernameIndex) {
      console.log('\n✅ Есть индекс на поле username');
      console.log('   Уникальный:', usernameIndex.unique || false);
    } else {
      console.log('\n❌ Нет индекса на поле username!');
    }
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    if (client) {
      await client.close();
      console.log('\n🔌 Соединение закрыто');
    }
  }
}

debugFindUserByUsername();