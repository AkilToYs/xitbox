const db = require('./database');

async function testUserSearch() {
    try {
        console.log('=== Testing User Search ===');
        
        // Получаем всех пользователей
        const allUsers = await db.getUsers();
        console.log('\nAll users in database:');
        allUsers.forEach((user, index) => {
            console.log(`${index + 1}. ${user.username}`);
            console.log(`   id: ${user.id}`);
            console.log(`   _id: ${user._id}`);
        });
        
        // Тестируем поиск по UUID
        console.log('\n=== Testing search by UUID ===');
        if (allUsers.length > 0) {
            const testUser = allUsers[0];
            console.log(`Searching for user by UUID: ${testUser.id}`);
            const foundByUuid = await db.findUserById(testUser.id);
            console.log(`Found: ${foundByUuid ? 'YES' : 'NO'}`);
        }
        
        // Тестируем поиск по ObjectId
        console.log('\n=== Testing search by ObjectId ===');
        if (allUsers.length > 0) {
            const testUser = allUsers[0];
            console.log(`Searching for user by ObjectId: ${testUser._id}`);
            const foundByObjectId = await db.findUserById(testUser._id.toString());
            console.log(`Found: ${foundByObjectId ? 'YES' : 'NO'}`);
        }
        
        // Тестируем поиск по username
        console.log('\n=== Testing search by username ===');
        if (allUsers.length > 0) {
            const testUser = allUsers[0];
            console.log(`Searching for user by username: ${testUser.username}`);
            const foundByUsername = await db.findUserById(testUser.username);
            console.log(`Found: ${foundByUsername ? 'YES' : 'NO'}`);
        }
        
        console.log('\n=== Testing complete ===');
    } catch (error) {
        console.error('Test error:', error);
    }
}

testUserSearch();