// create-test-data.js
const database = require('./database');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

async function createTestData() {
  try {
    console.log('🔍 Проверка подключения к базе данных...');
    
    // Подключаемся к базе
    await database.connect();
    
    // Хешируем пароль
    const hashedPassword = bcrypt.hashSync('test123', 10);
    
    // Создаем тестового пользователя БЕЗ поля id
    const testUser = {
      username: 'testuser',
      password: hashedPassword,
      role: 'seller',
      fullName: 'Test User',
      phone: '+998901111111',
      email: 'test@example.com',
      status: 'active'
      // Не передаем id, createdAt, updatedAt - они будут созданы в saveUser
    };
    
    console.log('📝 Создаем тестового пользователя...');
    const savedUser = await database.saveUser(testUser);
    
    if (!savedUser) {
      throw new Error('Пользователь не был сохранен');
    }
    
    console.log('✅ Пользователь создан:', savedUser.username);
    
    // Создаем тестовый лог
    const testLog = {
      userId: savedUser.id,
      action: 'test_action',
      details: 'Test log entry',
      entityId: savedUser.id,
      entityType: 'user',
      ipAddress: '127.0.0.1',
      userAgent: 'Test/1.0',
      timestamp: new Date().toISOString()
    };
    
    console.log('📝 Создаем тестовый лог...');
    const savedLog = await database.addUserLog(testLog);
    console.log('✅ Лог создан');
    
    // Получаем всех пользователей
    const users = await database.getUsers();
    console.log('👥 Всего пользователей:', users.length);
    console.log('Список пользователей:');
    users.forEach((user, index) => {
      console.log(`${index + 1}. ${user.username} (${user.role}) - ID: ${user.id}`);
    });
    
    // Получаем все логи
    const userLogs = await database.getUserLogs({});
    console.log('📊 Всего логов пользователей:', userLogs.data?.length || 0);
    
    // Получаем логи склада
    const warehouseLogs = await database.getWarehouseLogs();
    console.log('📦 Всего логов склада:', warehouseLogs?.length || 0);
    
    console.log('✅ Тестовые данные успешно созданы!');
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await database.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

createTestData();