// test-database-functions.js
const database = require('./database');

async function testFindUserFunctions() {
  console.log('🔍 Тестируем функции findUserById и findUserByUsername\n');
  
  try {
    // Подключаемся к базе данных
    await database.connect();
    console.log('✅ Подключение к базе данных установлено\n');
    
    // Сначала получим всех пользователей, чтобы знать их ID
    const allUsers = await database.getUsers();
    console.log(`📊 Всего пользователей в базе: ${allUsers.length}\n`);
    
    if (allUsers.length === 0) {
      console.log('❌ В базе нет пользователей!');
      return;
    }
    
    // Выведем информацию о каждом пользователе для справки
    console.log('📋 Список всех пользователей:');
    allUsers.forEach((user, index) => {
      console.log(`${index + 1}. username: "${user.username}", id: "${user.id}", _id: "${user._id}"`);
    });
    
    console.log('\n' + '='.repeat(60) + '\n');
    
    // ТЕСТ 1: findUserByUsername с существующими пользователями
    console.log('1. Тестируем findUserByUsername():');
    
    const testUsernames = ['admin', 'seller', 'warehouse', 'superadmin', 'testuser'];
    
    for (const username of testUsernames) {
      console.log(`\n   Поиск пользователя по username: "${username}"`);
      const user = await database.findUserByUsername(username);
      
      if (user) {
        console.log(`   ✅ Найден!`);
        console.log(`      - username: ${user.username}`);
        console.log(`      - id: ${user.id}`);
        console.log(`      - role: ${user.role}`);
        console.log(`      - fullName: ${user.fullName}`);
      } else {
        console.log(`   ❌ Не найден!`);
      }
    }
    
    console.log('\n' + '='.repeat(60) + '\n');
    
    // ТЕСТ 2: findUserByUsername с несуществующим пользователем
    console.log('2. Тестируем findUserByUsername() с несуществующим пользователем:');
    
    const nonExistentUser = await database.findUserByUsername('nonexistent12345');
    if (nonExistentUser) {
      console.log('   ❌ ОШИБКА: Нашли несуществующего пользователя!');
    } else {
      console.log('   ✅ Корректно вернул null для несуществующего пользователя');
    }
    
    console.log('\n' + '='.repeat(60) + '\n');
    
    // ТЕСТ 3: findUserById с существующими пользователями
    console.log('3. Тестируем findUserById():');
    
    // Берем первого пользователя для тестирования
    if (allUsers.length > 0) {
      const firstUser = allUsers[0];
      console.log(`\n   Тест 3.1: Поиск по id (строковый id): "${firstUser.id}"`);
      
      const userById = await database.findUserById(firstUser.id);
      if (userById) {
        console.log(`   ✅ Найден по id: ${userById.username}`);
        console.log(`      - Сравнение: исходный username: "${firstUser.username}", найденный: "${userById.username}"`);
        
        if (firstUser.username === userById.username) {
          console.log('      ✅ Username совпадает!');
        } else {
          console.log('      ❌ Username НЕ совпадает!');
        }
      } else {
        console.log(`   ❌ Не найден по id: ${firstUser.id}`);
        
        // Попробуем найти по _id
        console.log(`\n   Тест 3.2: Пробуем найти по _id: "${firstUser._id}"`);
        const userByObjectId = await database.findUserById(firstUser._id.toString());
        if (userByObjectId) {
          console.log(`   ✅ Найден по _id: ${userByObjectId.username}`);
        } else {
          console.log(`   ❌ Не найден даже по _id`);
        }
      }
    }
    
    console.log('\n' + '='.repeat(60) + '\n');
    
    // ТЕСТ 4: Проверка всех пользователей через findUserById
    console.log('4. Проверяем всех пользователей через findUserById():');
    
    for (const user of allUsers) {
      console.log(`\n   Поиск пользователя ${user.username}:`);
      console.log(`      - Имеет id: ${user.id ? 'да' : 'нет'} (${user.id})`);
      console.log(`      - Имеет _id: ${user._id ? 'да' : 'нет'} (${user._id})`);
      
      let foundUser = null;
      
      // Пробуем найти по id
      if (user.id) {
        foundUser = await database.findUserById(user.id);
        if (foundUser) {
          console.log(`      ✅ Найден по id: ${foundUser.username}`);
        } else {
          console.log(`      ❌ Не найден по id: ${user.id}`);
        }
      }
      
      // Если не нашли по id, пробуем по _id
      if (!foundUser && user._id) {
        foundUser = await database.findUserById(user._id.toString());
        if (foundUser) {
          console.log(`      ✅ Найден по _id: ${foundUser.username}`);
        } else {
          console.log(`      ❌ Не найден даже по _id: ${user._id}`);
        }
      }
      
      if (!foundUser) {
        console.log(`      ❌ Пользователь не найден ни по id, ни по _id!`);
      }
    }
    
    console.log('\n' + '='.repeat(60) + '\n');
    
    // ТЕСТ 5: Специальный тест для понимания проблемы в auth.js
    console.log('5. Специальный тест для диагностики проблемы в auth.js:');
    console.log('\n   Проверяем, что происходит при поиске пользователя admin:');
    
    const adminUser = await database.findUserByUsername('admin');
    if (adminUser) {
      console.log(`   ✅ Админ найден по username: ${adminUser.username}`);
      console.log(`      - id: ${adminUser.id}`);
      console.log(`      - _id: ${adminUser._id}`);
      
      // Теперь ищем по id из токена (обычно используется id, а не _id)
      console.log(`\n   Ищем того же админа по id: "${adminUser.id}"`);
      const adminById = await database.findUserById(adminUser.id);
      
      if (adminById) {
        console.log(`   ✅ Админ найден и по id!`);
        console.log(`      - username: ${adminById.username}`);
        console.log(`      - id: ${adminById.id}`);
        
        // Проверяем, совпадают ли данные
        if (adminUser.username === adminById.username && adminUser.id === adminById.id) {
          console.log(`   ✅ Данные совпадают полностью!`);
        } else {
          console.log(`   ❌ Данные НЕ совпадают!`);
          console.log(`      По username: username=${adminUser.username}, id=${adminUser.id}`);
          console.log(`      По id: username=${adminById.username}, id=${adminById.id}`);
        }
      } else {
        console.log(`   ❌ Админ НЕ найден по id! Возможные причины:`);
        console.log(`      1. Поле id не существует в документе`);
        console.log(`      2. Значение id не совпадает`);
        console.log(`      3. Ошибка в функции findUserById`);
        
        // Проверяем структуру документа
        console.log(`\n   Проверяем структуру документа админа:`);
        console.log(JSON.stringify(adminUser, null, 2));
      }
    } else {
      console.log(`   ❌ Админ не найден по username!`);
    }
    
    console.log('\n' + '='.repeat(60) + '\n');
    
    // ТЕСТ 6: Проверяем формат id
    console.log('6. Проверяем формат id у всех пользователей:');
    
    for (const user of allUsers) {
      console.log(`\n   Пользователь: ${user.username}`);
      console.log(`      id: ${user.id} (тип: ${typeof user.id}, длина: ${user.id ? user.id.length : 0})`);
      console.log(`      _id: ${user._id} (тип: ${typeof user._id})`);
      
      // Проверяем, является ли id валидным UUID
      if (user.id) {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (uuidRegex.test(user.id)) {
          console.log(`      ✅ id имеет формат UUID`);
        } else {
          console.log(`      ⚠️  id НЕ в формате UUID`);
        }
      }
    }
    
    console.log('\n' + '='.repeat(60) + '\n');
    
    // ТЕСТ 7: Проверяем случай, когда в токене есть id, но нет username
    console.log('7. Симулируем ситуацию из auth.js (токен содержит id, но нет username):');
    
    const testUser = allUsers[0]; // Берем первого пользователя
    if (testUser && testUser.id) {
      console.log(`\n   Токен содержит id: "${testUser.id}"`);
      console.log(`   Вызываем findUserById("${testUser.id}")...`);
      
      const foundUser = await database.findUserById(testUser.id);
      if (foundUser) {
        console.log(`   ✅ Пользователь найден!`);
        console.log(`      username: ${foundUser.username}`);
        console.log(`      role: ${foundUser.role}`);
        console.log(`      fullName: ${foundUser.fullName}`);
        
        // Эмулируем код из auth.js
        const payload = { id: testUser.id }; // Только id, нет username
        console.log(`\n   Эмулируем код auth.js:`);
        console.log(`      Исходный payload: ${JSON.stringify(payload)}`);
        
        if (payload.id && !payload.username) {
          console.log(`      Условие выполнено: есть id, но нет username`);
          
          // Добавляем данные из найденного пользователя
          payload.username = foundUser.username;
          payload.role = foundUser.role;
          payload.fullName = foundUser.fullName;
          
          console.log(`      Обновленный payload: ${JSON.stringify(payload)}`);
        }
      } else {
        console.log(`   ❌ Пользователь не найден!`);
        console.log(`      Это приведет к ошибке "Foydalanuvchi topilmadi 401" в auth.js`);
      }
    }
    
    console.log('\n🎉 Тестирование завершено!\n');
    
  } catch (error) {
    console.error('❌ Ошибка во время тестирования:');
    console.error(error.message);
    console.error(error.stack);
  } finally {
    // Закрываем соединение
    await database.disconnect();
    console.log('🔌 Соединение с базой данных закрыто');
  }
}

// Запускаем тест
testFindUserFunctions();