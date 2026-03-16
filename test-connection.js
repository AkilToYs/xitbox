const db = require('./database');

async function test() {
  try {
    await db.connect();
    console.log('✅ Подключение к БД успешно');
    
    const users = await db.getUsers();
    console.log(`👥 Пользователей в базе: ${users.length}`);
    
    if (users.length === 0) {
      console.log('⚠️  База пуста. Нужно создать пользователей.');
    } else {
      console.log('Пользователи:');
      users.forEach(user => {
        console.log(`  - ${user.username} (${user.role})`);
      });
    }
    
    await db.disconnect();
    console.log('🔌 Отключились от БД');
  } catch (error) {
    console.error('❌ Ошибка:', error);
  }
}

test();