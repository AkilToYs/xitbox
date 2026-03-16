const { MongoClient, ObjectId } = require('mongodb');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');

// Указываем DNS-серверы, которые умеют резолвить SRV-записи

// Константы (объявлены один раз)
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const DB_PATH = ''; // Не используется в MongoDB

// Подключение к MongoDB
const MONGODB_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME = process.env.DB_NAME || 'dokon_store';

let client = null;
let db = null;
let isConnected = false;

class Database {
    constructor() {
        this.collections = {
            users: 'users',
            products: 'products',
            sales: 'sales',
            warehouseLogs: 'warehouseLogs',
            warehousePayments: 'warehousePayments',
            userLogs: 'userLogs',
            notifications: 'notifications',
            invoices: 'invoices',
            nasiyaClients: 'nasiyaClients',
            nasiyaSales: 'nasiyaSales',
            nasiyaPayments: 'nasiyaPayments',
            nasiyaReminders: 'nasiyaReminders',
            settings: 'settings',
            reports: 'reports'
        };
    }

    // Подключение к базе данных
    async connect() {
        if (isConnected && db) return db;

        try {
            client = new MongoClient(MONGODB_URI);
            await client.connect();
            db = client.db(DB_NAME);
            isConnected = true;
            console.log('✅ Connected to MongoDB');

            // Инициализация базы данных (создание индексов, начальных данных)
            await this.initializeDatabase();
            
            return db;
        } catch (error) {
            console.error('❌ MongoDB connection error:', error);
            throw error;
        }
    }

    // Отключение от базы данных
    async disconnect() {
        if (client) {
            await client.close();
            client = null;
            db = null;
            isConnected = false;
            console.log('Disconnected from MongoDB');
        }
    }

    // Инициализация базы данных
    async initializeDatabase() {
        try {
            // Создание индексов
            await this.createIndexes();
            
            // Проверка существования пользователей
            const usersCount = await db.collection(this.collections.users).countDocuments();
            
            if (usersCount === 0) {
                await this.createDefaultUsers();
                console.log('✅ Created default users');
            }
            
            // Проверка существования настроек
            const settingsCount = await db.collection(this.collections.settings).countDocuments();
            
            if (settingsCount === 0) {
                await this.createDefaultSettings();
                console.log('✅ Created default settings');
            }
        } catch (error) {
            console.error('Database initialization error:', error);
        }
    }
async createDefaultUsers() {
  const now = new Date().toISOString();
  const defaultUsers = [
    { 
      id: uuidv4(), 
      username: 'superadmin', 
      password: bcrypt.hashSync('super123', 10), 
      role: 'superadmin', 
      fullName: 'Супер Администратор', 
      phone: '+998901234567', // Добавлено
      email: 'superadmin@example.com', // Добавлено
      status: 'active', 
      createdAt: now 
    },
    { 
      id: uuidv4(), 
      username: 'admin', 
      password: bcrypt.hashSync('admin123', 10), 
      role: 'admin', 
      fullName: 'Администратор', 
      phone: '+998901234568', // Добавлено
      email: 'admin@example.com', // Добавлено
      status: 'active', 
      createdAt: now 
    },
    { 
      id: uuidv4(), 
      username: 'seller', 
      password: bcrypt.hashSync('seller123', 10), 
      role: 'seller', 
      fullName: 'Сотувчи', 
      phone: '+998901234569', // Добавлено
      email: 'seller@example.com', // Добавлено
      status: 'active', 
      createdAt: now 
    },
    { 
      id: uuidv4(), 
      username: 'warehouse', 
      password: bcrypt.hashSync('warehouse123', 10), 
      role: 'warehouse', 
      fullName: 'Омборчи', 
      phone: '+998901234570', // Добавлено
      email: 'warehouse@example.com', // Добавлено
      status: 'active', 
      createdAt: now 
    }
  ];

  await db.collection(this.collections.users).insertMany(defaultUsers);
}
    // Создание индексов
    async createIndexes() {
        try {
            // Индекс для пользователей
            await db.collection(this.collections.users).createIndex({ username: 1 }, { unique: true });
            
            // Индекс для продуктов
            await db.collection(this.collections.products).createIndex({ name: 1 });
            await db.collection(this.collections.products).createIndex({ type: 1 });
            await db.collection(this.collections.products).createIndex({ article: 1 });
            
            // Индекс для продаж
            await db.collection(this.collections.sales).createIndex({ date: -1 });
            await db.collection(this.collections.sales).createIndex({ productId: 1 });
            await db.collection(this.collections.sales).createIndex({ userId: 1 });
            await db.collection(this.collections.sales).createIndex({ type: 1 });
            await db.collection(this.collections.sales).createIndex({ productType: 1 });
            
            // Индекс для логов склада
            await db.collection(this.collections.warehouseLogs).createIndex({ date: -1 });
            await db.collection(this.collections.warehouseLogs).createIndex({ type: 1 });
            
            // Индекс для логов пользователей
            await db.collection(this.collections.userLogs).createIndex({ timestamp: -1 });
            await db.collection(this.collections.userLogs).createIndex({ userId: 1 });
            
            // Индекс для уведомлений
            await db.collection(this.collections.notifications).createIndex({ createdAt: -1 });
            
            // Индекс для накладных
            await db.collection(this.collections.invoices).createIndex({ createdAt: -1 });
            
            // Индексы для системы насия
            await db.collection(this.collections.nasiyaClients).createIndex({ name: 1 });
            await db.collection(this.collections.nasiyaClients).createIndex({ phone: 1 });
            await db.collection(this.collections.nasiyaSales).createIndex({ clientId: 1 });
            await db.collection(this.collections.nasiyaSales).createIndex({ createdAt: -1 });
            await db.collection(this.collections.nasiyaPayments).createIndex({ clientId: 1 });
            await db.collection(this.collections.nasiyaPayments).createIndex({ createdAt: -1 });
            await db.collection(this.collections.nasiyaReminders).createIndex({ reminderDate: 1 });
            
            // Индекс для отчетов
            await db.collection(this.collections.reports).createIndex({ year: 1, month: 1 });
            
            console.log('✅ Database indexes created');
        } catch (error) {
            console.error('Error creating indexes:', error);
        }
    }

    // Создание пользователей по умолчанию
    async createDefaultUsers() {
        const now = new Date().toISOString();
        const defaultUsers = [
            { 
                id: uuidv4(), 
                username: 'superadmin', 
                password: bcrypt.hashSync('super123', 10), 
                role: 'superadmin', 
                fullName: 'Супер Администратор', 
                status: 'active', 
                createdAt: now 
            },
            { 
                id: uuidv4(), 
                username: 'admin', 
                password: bcrypt.hashSync('admin123', 10), 
                role: 'admin', 
                fullName: 'Администратор', 
                status: 'active', 
                createdAt: now 
            },
            { 
                id: uuidv4(), 
                username: 'seller', 
                password: bcrypt.hashSync('seller123', 10), 
                role: 'seller', 
                fullName: 'Сотувчи', 
                status: 'active', 
                createdAt: now 
            },
            { 
                id: uuidv4(), 
                username: 'warehouse', 
                password: bcrypt.hashSync('warehouse123', 10), 
                role: 'warehouse', 
                fullName: 'Омборчи', 
                status: 'active', 
                createdAt: now 
            }
        ];

        await db.collection(this.collections.users).insertMany(defaultUsers);
    }

    // Создание настроек по умолчанию
    async createDefaultSettings() {
        const defaultSettings = {
            id: 'warehouse_settings',
            warehouseInitialDebt: {
                akitoy: 0,
                makplast: 0,
                createdAt: new Date().toISOString()
            },
            createdAt: new Date().toISOString()
        };

        await db.collection(this.collections.settings).insertOne(defaultSettings);
    }

    // ==================== БАЗОВЫЕ МЕТОДЫ ====================

    async ensureDatabaseInitialized() {
        await this.connect();
        return true;
    }

    // Аналог readDB - для совместимости со старым кодом
    async readDB() {
        await this.connect();
        
        // Получаем все данные из коллекций
        const result = {
            users: await db.collection(this.collections.users).find({}).toArray(),
            products: await db.collection(this.collections.products).find({}).toArray(),
            sales: await db.collection(this.collections.sales).find({}).toArray(),
            warehouseLogs: await db.collection(this.collections.warehouseLogs).find({}).toArray(),
            warehousePayments: await db.collection(this.collections.warehousePayments).find({}).toArray(),
            userLogs: await db.collection(this.collections.userLogs).find({}).toArray(),
            notifications: await db.collection(this.collections.notifications).find({}).toArray(),
            invoices: await db.collection(this.collections.invoices).find({}).toArray(),
            nasiyaClients: await db.collection(this.collections.nasiyaClients).find({}).toArray(),
            nasiyaSales: await db.collection(this.collections.nasiyaSales).find({}).toArray(),
            nasiyaPayments: await db.collection(this.collections.nasiyaPayments).find({}).toArray(),
            nasiyaReminders: await db.collection(this.collections.nasiyaReminders).find({}).toArray(),
            reports: await db.collection(this.collections.reports).find({}).toArray()
        };
        
        // Настройки - преобразуем в объект для совместимости
        const settingsDocs = await db.collection(this.collections.settings).find({}).toArray();
        result.settings = {};
        settingsDocs.forEach(doc => {
            result.settings[doc.id] = doc;
        });
        
        // Добавляем warehouseInitialDebt для совместимости
        result.warehouseInitialDebt = result.settings.warehouse_settings?.warehouseInitialDebt || {
            akitoy: 0,
            makplast: 0,
            createdAt: new Date().toISOString()
        };
        
        return result;
    }

    // Аналог getDatabaseData - для совместимости с nasiya.js
    async getDatabaseData() {
        return await this.readDB();
    }

    // Аналог writeDB - для совместимости со старым кодом
    async writeDB(data) {
        await this.connect();
        
        // Обновляем каждую коллекцию отдельно
        if (data.users && Array.isArray(data.users)) {
            await db.collection(this.collections.users).deleteMany({});
            if (data.users.length > 0) {
                await db.collection(this.collections.users).insertMany(data.users);
            }
        }
        
        if (data.products && Array.isArray(data.products)) {
            await db.collection(this.collections.products).deleteMany({});
            if (data.products.length > 0) {
                await db.collection(this.collections.products).insertMany(data.products);
            }
        }
        
        if (data.sales && Array.isArray(data.sales)) {
            await db.collection(this.collections.sales).deleteMany({});
            if (data.sales.length > 0) {
                await db.collection(this.collections.sales).insertMany(data.sales);
            }
        }
        
        if (data.warehouseLogs && Array.isArray(data.warehouseLogs)) {
            await db.collection(this.collections.warehouseLogs).deleteMany({});
            if (data.warehouseLogs.length > 0) {
                await db.collection(this.collections.warehouseLogs).insertMany(data.warehouseLogs);
            }
        }
        
        if (data.warehousePayments && Array.isArray(data.warehousePayments)) {
            await db.collection(this.collections.warehousePayments).deleteMany({});
            if (data.warehousePayments.length > 0) {
                await db.collection(this.collections.warehousePayments).insertMany(data.warehousePayments);
            }
        }
        
        if (data.userLogs && Array.isArray(data.userLogs)) {
            await db.collection(this.collections.userLogs).deleteMany({});
            if (data.userLogs.length > 0) {
                await db.collection(this.collections.userLogs).insertMany(data.userLogs);
            }
        }
        
        if (data.notifications && Array.isArray(data.notifications)) {
            await db.collection(this.collections.notifications).deleteMany({});
            if (data.notifications.length > 0) {
                await db.collection(this.collections.notifications).insertMany(data.notifications);
            }
        }
        
        if (data.invoices && Array.isArray(data.invoices)) {
            await db.collection(this.collections.invoices).deleteMany({});
            if (data.invoices.length > 0) {
                await db.collection(this.collections.invoices).insertMany(data.invoices);
            }
        }
        
        if (data.nasiyaClients && Array.isArray(data.nasiyaClients)) {
            await db.collection(this.collections.nasiyaClients).deleteMany({});
            if (data.nasiyaClients.length > 0) {
                await db.collection(this.collections.nasiyaClients).insertMany(data.nasiyaClients);
            }
        }
        
        if (data.nasiyaSales && Array.isArray(data.nasiyaSales)) {
            await db.collection(this.collections.nasiyaSales).deleteMany({});
            if (data.nasiyaSales.length > 0) {
                await db.collection(this.collections.nasiyaSales).insertMany(data.nasiyaSales);
            }
        }
        
        if (data.nasiyaPayments && Array.isArray(data.nasiyaPayments)) {
            await db.collection(this.collections.nasiyaPayments).deleteMany({});
            if (data.nasiyaPayments.length > 0) {
                await db.collection(this.collections.nasiyaPayments).insertMany(data.nasiyaPayments);
            }
        }
        
        if (data.nasiyaReminders && Array.isArray(data.nasiyaReminders)) {
            await db.collection(this.collections.nasiyaReminders).deleteMany({});
            if (data.nasiyaReminders.length > 0) {
                await db.collection(this.collections.nasiyaReminders).insertMany(data.nasiyaReminders);
            }
        }
        
        if (data.reports && Array.isArray(data.reports)) {
            await db.collection(this.collections.reports).deleteMany({});
            if (data.reports.length > 0) {
                await db.collection(this.collections.reports).insertMany(data.reports);
            }
        }
        
        // Обработка настроек
        if (data.settings && typeof data.settings === 'object') {
            await db.collection(this.collections.settings).deleteMany({});
            
            const settingsArray = Object.keys(data.settings).map(key => ({
                id: key,
                ...data.settings[key]
            }));
            
            if (settingsArray.length > 0) {
                await db.collection(this.collections.settings).insertMany(settingsArray);
            }
        }
        
        return true;
    }

    // ==================== ПОЛЬЗОВАТЕЛИ ====================



    async findUserById(id) {
  await this.connect();
  if (!id) return null;
  
  // Проверяем, является ли id ObjectId
  let user = null;
  
  try {
    // Сначала ищем по полю id
    user = await db.collection(this.collections.users).findOne({ id: id });
    
    // Если не нашли, пробуем как _id ObjectId
    if (!user && ObjectId.isValid(id)) {
      user = await db.collection(this.collections.users).findOne({ 
        _id: new ObjectId(id) 
      });
    }
    
    // Если не нашли, пробуем найти по username (для совместимости)
    if (!user) {
      user = await db.collection(this.collections.users).findOne({ 
        username: id 
      });
    }
    
    if (user) {
      // Убедимся, что у пользователя есть id поле
      if (!user.id && user._id) {
        user.id = user._id.toString();
      }
      return user;
    }
    
    return null;
  } catch (error) {
    console.error('findUserById error:', error);
    return null;
  }
}

async _ensureUserId(user) {
  if (!user || !user._id) return user;
  
  // Если у пользователя нет id, но есть _id, создаем id
  if (!user.id) {
    user.id = user._id.toString();
  }
  
  return user;
}

async getUsers() {
  await this.connect();
  try {
    const users = await db.collection(this.collections.users).find({}).toArray();
    
    // Убедимся, что у всех пользователей есть id поле
    const normalizedUsers = users.map(user => {
      if (!user.id && user._id) {
        user.id = user._id.toString();
      }
      return user;
    });
    
    return normalizedUsers;
  } catch (error) {
    console.error('getUsers error:', error);
    return [];
  }
}

async findUserByUsername(username) {
  await this.connect();
  try {
    const user = await db.collection(this.collections.users).findOne({ 
      username: username 
    });
    
    if (user) {
      // Убедимся, что у пользователя есть id поле
      if (!user.id && user._id) {
        user.id = user._id.toString();
      }
      return user;
    }
    
    return null;
  } catch (error) {
    console.error('findUserByUsername error:', error);
    return null;
  }
}

async saveUser(user) {
  await this.connect();
  
  try {
    // Если есть _id, преобразуем его для поиска
    let existingUser = null;
    
    if (user.id) {
      existingUser = await this.findUserById(user.id);
    }
    
    if (existingUser) {
      // Обновляем существующего пользователя
      const { _id, id, ...updateData } = user;
      
      // Если есть _id, используем его для поиска
      const filter = user._id ? { _id: new ObjectId(user._id) } : { id: user.id };
      
      const result = await db.collection(this.collections.users).updateOne(
        filter,
        { 
          $set: {
            ...updateData,
            updatedAt: new Date().toISOString()
          } 
        }
      );
      
      // Получаем обновленного пользователя
      return await this.findUserById(user.id);
    } else {
      // Создаем нового пользователя
      const newUser = {
        id: uuidv4(),
        ...user,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      // Хешируем пароль, если он предоставлен
      if (newUser.password && !newUser.password.startsWith('$2a$')) {
        newUser.password = bcrypt.hashSync(newUser.password, 10);
      }
      
      const result = await db.collection(this.collections.users).insertOne(newUser);
      newUser._id = result.insertedId;
      
      return newUser;
    }
  } catch (error) {
    console.error('saveUser error:', error);
    throw error;
  }
}

    async deleteUser(id) {
        await this.connect();
        const result = await db.collection(this.collections.users).deleteOne({ id });
        return result.deletedCount > 0;
    }

    // ==================== ПРОДУКТЫ ====================

    async getProducts() {
        await this.connect();
        return await db.collection(this.collections.products).find({}).toArray();
    }

   async getProductById(id) {
  await this.connect();
  try {
    let product = null;
    
    // Сначала ищем по полю id
    product = await db.collection(this.collections.products).findOne({ id: id });
    
    // Если не нашли, пробуем как _id ObjectId
    if (!product && ObjectId.isValid(id)) {
      product = await db.collection(this.collections.products).findOne({ 
        _id: new ObjectId(id) 
      });
    }
    
    if (product && !product.id && product._id) {
      product.id = product._id.toString();
    }
    
    return product;
  } catch (error) {
    console.error('getProductById error:', error);
    return null;
  }
}

    async addProduct(product) {
        await this.connect();
        const newProduct = {
            id: uuidv4(),
            ...product,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        await db.collection(this.collections.products).insertOne(newProduct);
        return newProduct;
    }

    async updateProduct(id, patch) {
        await this.connect();
        const updateData = {
            ...patch,
            updatedAt: new Date().toISOString()
        };
        
        await db.collection(this.collections.products).updateOne(
            { id },
            { $set: updateData }
        );
        
        return await this.getProductById(id);
    }

    async deleteProduct(id) {
        await this.connect();
        
        // Получаем продукт для удаления изображения
        const product = await this.getProductById(id);
        
        if (product && product.image) {
            await this.deleteProductImage(product.image);
        }
        
        const result = await db.collection(this.collections.products).deleteOne({ id });
        return result.deletedCount > 0;
    }

    async deleteProductImage(imagePath) {
        if (!imagePath || imagePath.startsWith('http')) return;
        
        try {
            const fullPath = path.join(__dirname, '..', imagePath);
            if (fsSync.existsSync(fullPath)) {
                await fs.unlink(fullPath);
                console.log(`Deleted image: ${imagePath}`);
            }
        } catch (err) {
            console.error('Error deleting product image:', err);
        }
    }

    // Обновление остатка продукта
    async updateProductStock(productId, quantityChange) {
        
  console.log(`📦 updateProductStock: productId = ${productId}, change = ${quantityChange}`);
        await this.connect();
        
        await db.collection(this.collections.products).updateOne(
            { id: productId },
            { 
                $inc: { stock: quantityChange },
                $set: { updatedAt: new Date().toISOString() }
            }
        );
    }

    // Обновление стоимости продукта при приходе
    async updateProductCost(productId, newQuantity, newCost) {
        await this.connect();
        
        const product = await this.getProductById(productId);
        
        if (product) {
            const oldStock = product.stock || 0;
            const oldCost = product.cost || 0;
            
            if (oldStock > 0) {
                const newStock = oldStock + newQuantity;
                const newAvgCost = Math.round(((oldStock * oldCost) + (newQuantity * newCost)) / newStock);
                
                await db.collection(this.collections.products).updateOne(
                    { id: productId },
                    { 
                        $set: { 
                            stock: newStock,
                            cost: newAvgCost,
                            updatedAt: new Date().toISOString()
                        }
                    }
                );
            } else {
                await db.collection(this.collections.products).updateOne(
                    { id: productId },
                    { 
                        $set: { 
                            stock: newQuantity,
                            cost: newCost,
                            updatedAt: new Date().toISOString()
                        }
                    }
                );
            }
        }
    }

    // ==================== ПРОДАЖИ ====================

    async getSales() {
        await this.connect();
        return await db.collection(this.collections.sales).find({}).sort({ date: -1 }).toArray();
    }

    async getSaleById(id) {
        await this.connect();
        return await db.collection(this.collections.sales).findOne({ id });
    }

    async addSale(sale) {
         console.log(`🔥 addSale ВЫЗВАН: quantity = ${sale.quantity}, productId = ${sale.productId}`);
        await this.connect();
        
        const newSale = {
            id: uuidv4(),
            ...sale,
            createdAt: new Date().toISOString()
        };
        
        // Добавляем продажу
        await db.collection(this.collections.sales).insertOne(newSale);
        
        // Обновляем остаток продукта
        if (sale.productId && sale.quantity) {
            await this.updateProductStock(sale.productId, -sale.quantity);
        }
        
        // Создаем лог склада для продажи
        if (sale.productId) {
            const product = await this.getProductById(sale.productId);
            
            await this.addWarehouseLog({
                id: uuidv4(),
                type: 'sale',
                productId: sale.productId,
                productName: product?.name || sale.productName || '',
                productType: product?.type || sale.productType || 'akitoy',
                quantity: -Math.abs(sale.quantity),
                cost: sale.cost || product?.cost || 0,
                totalCost: -Math.abs(sale.quantity) * (sale.cost || product?.cost || 0),
                date: sale.date || new Date().toISOString(),
                createdAt: new Date().toISOString(),
                userId: sale.userId
            });
        }
        
         console.log(`✅ addSale ЗАВЕРШЕН, id = ${newSale.id}`);
  return newSale;
    }

    async deleteSale(id) {
        await this.connect();
        const result = await db.collection(this.collections.sales).deleteOne({ id });
        return result.deletedCount > 0;
    }

    async getSalesByProductId(productId) {
        await this.connect();
        return await db.collection(this.collections.sales).find({ productId }).toArray();
    }

    // ==================== СКЛАД ====================

    async getWarehouseLogs(limit = 0) {
        await this.connect();
        let query = db.collection(this.collections.warehouseLogs).find({}).sort({ createdAt: -1 });
        
        if (limit > 0) {
            query = query.limit(limit);
        }
        
        return await query.toArray();
    }
// database.js (фрагменты)

// В методе addWarehouseLog добавим условие для refund
async addWarehouseLog(log) {
    await this.connect();
    
    const newLog = {
        id: uuidv4(),
        ...log,
        createdAt: new Date().toISOString()
    };
    
    await db.collection(this.collections.warehouseLogs).insertOne(newLog);
    
    // Если это приход или возврат, обновляем стоимость продукта
    if (log.type === 'receive' || log.type === 'refund') {
        await this.updateProductCost(log.productId, log.quantity, log.cost);
    }
    
    return newLog;
}

// Новый метод для создания возврата
async refundSale(refundData) {
    await this.connect();

    // Создаём запись возврата в продажах (отрицательное количество)
    const refundSale = {
        id: uuidv4(),
        productId: refundData.productId,
        productName: refundData.productName,
        productArticle: refundData.productArticle,
        productType: refundData.productType,
        type: 'refund',                     // или можно оставить тип продукта, но добавить флаг
        quantity: -Math.abs(refundData.quantity),
        price: refundData.price,
        cost: refundData.cost,
        total: -Math.abs(refundData.quantity) * refundData.price,
        profit: -Math.abs(refundData.quantity) * (refundData.price - refundData.cost),
        date: refundData.date || new Date().toISOString(),
        userId: refundData.userId,
        originalSaleId: refundData.saleId || null,  // связь с исходной продажей (опционально)
        createdAt: new Date().toISOString()
    };

    await db.collection(this.collections.sales).insertOne(refundSale);

    // Увеличиваем остаток продукта
    await this.updateProductStock(refundData.productId, refundData.quantity);

    // Получаем актуальные данные продукта для лога
    const product = await this.getProductById(refundData.productId);
    const productType = product?.type || refundData.productType;
    const productName = product?.name || refundData.productName;

    // Создаём лог склада типа 'refund'
    await this.addWarehouseLog({
        type: 'refund',
        productId: refundData.productId,
        productName: productName,
        productType: productType,
        quantity: refundData.quantity,
        cost: refundData.cost,
        totalCost: refundData.quantity * refundData.cost,
        date: refundData.date || new Date().toISOString(),
        userId: refundData.userId,
        description: refundData.description || 'Возврат от покупателя'
    });

    return refundSale;
}
    async addWarehouseLog(log) {
        await this.connect();
        
        const newLog = {
            id: uuidv4(),
            ...log,
            createdAt: new Date().toISOString()
        };
        
        await db.collection(this.collections.warehouseLogs).insertOne(newLog);
        
        // Если это приход товара, обновляем стоимость продукта
        if (log.type === 'receive' && log.quantity > 0 && log.productId && log.cost) {
            await this.updateProductCost(log.productId, log.quantity, log.cost);
        }
        
        return newLog;
    }

    // ==================== ПЛАТЕЖИ СКЛАДА ====================

    async getWarehousePayments() {
        await this.connect();
        return await db.collection(this.collections.warehousePayments).find({}).sort({ date: -1 }).toArray();
    }

    async addWarehousePayment(payment) {
        await this.connect();
        
        const newPayment = {
            id: uuidv4(),
            ...payment,
            createdAt: new Date().toISOString()
        };
        
        await db.collection(this.collections.warehousePayments).insertOne(newPayment);
        return newPayment;
    }

    // ==================== ЛОГИ ПОЛЬЗОВАТЕЛЕЙ ====================

    async getUserLogs(options = {}) {
        await this.connect();
        
        const { userId, action, limit = 50, page = 1 } = options;
        
        // Создаем фильтр
        const filter = {};
        if (userId) filter.userId = userId;
        if (action) filter.action = action;
        
        const skip = (page - 1) * limit;
        
        const logs = await db.collection(this.collections.userLogs)
            .find(filter)
            .sort({ timestamp: -1 })
            .skip(skip)
            .limit(limit)
            .toArray();
        
        const total = await db.collection(this.collections.userLogs).countDocuments(filter);
        
        return {
            data: logs,
            pagination: {
                total,
                page,
                limit,
                pages: Math.ceil(total / limit)
            }
        };
    }

    async addUserLog(log) {
        await this.connect();
        
        const newLog = {
            id: uuidv4(),
            ...log,
            timestamp: new Date().toISOString(),
            createdAt: new Date().toISOString()
        };
        
        await db.collection(this.collections.userLogs).insertOne(newLog);
        return newLog;
    }

    // ==================== УВЕДОМЛЕНИЯ ====================

    async getNotifications() {
        await this.connect();
        return await db.collection(this.collections.notifications).find({}).sort({ createdAt: -1 }).toArray();
    }

    async addNotification(notification) {
        await this.connect();
        
        const newNotification = {
            id: uuidv4(),
            ...notification,
            createdAt: new Date().toISOString()
        };
        
        await db.collection(this.collections.notifications).insertOne(newNotification);
        
        // Ограничиваем количество уведомлений (последние 100)
        const count = await db.collection(this.collections.notifications).countDocuments();
        if (count > 100) {
            const oldest = await db.collection(this.collections.notifications)
                .find({})
                .sort({ createdAt: 1 })
                .limit(count - 100)
                .toArray();
            
            const idsToDelete = oldest.map(n => n._id);
            await db.collection(this.collections.notifications).deleteMany({ _id: { $in: idsToDelete } });
        }
        
        return newNotification;
    }

    async markNotificationAsRead(id) {
        await this.connect();
        await db.collection(this.collections.notifications).updateOne(
            { id },
            { $set: { read: true, updatedAt: new Date().toISOString() } }
        );
        return await db.collection(this.collections.notifications).findOne({ id });
    }

    async markAllNotificationsAsRead(userId) {
        await this.connect();
        const filter = userId ? { createdBy: userId } : {};
        await db.collection(this.collections.notifications).updateMany(
            { ...filter, read: false },
            { $set: { read: true, updatedAt: new Date().toISOString() } }
        );
        return true;
    }

    async deleteNotification(id) {
        await this.connect();
        const result = await db.collection(this.collections.notifications).deleteOne({ id });
        return result.deletedCount > 0;
    }

    async deleteUserNotifications(userId) {
        await this.connect();
        const result = await db.collection(this.collections.notifications).deleteMany({ createdBy: userId });
        return result.deletedCount > 0;
    }

    async deleteAllNotifications() {
        await this.connect();
        const result = await db.collection(this.collections.notifications).deleteMany({});
        return result.deletedCount > 0;
    }

    async getUnreadNotificationsCount() {
        await this.connect();
        return await db.collection(this.collections.notifications).countDocuments({ read: false });
    }

    // ==================== НАКЛАДНЫЕ ====================

    async getInvoices() {
        await this.connect();
        return await db.collection(this.collections.invoices).find({}).sort({ createdAt: -1 }).toArray();
    }

    async getInvoiceById(id) {
        await this.connect();
        return await db.collection(this.collections.invoices).findOne({ id });
    }

    async addInvoice(invoice) {
        await this.connect();
        
        const newInvoice = {
            id: uuidv4(),
            ...invoice,
            createdAt: new Date().toISOString()
        };
        
        await db.collection(this.collections.invoices).insertOne(newInvoice);
        return newInvoice;
    }

    // ==================== СИСТЕМА НАСИЯ ====================

    // Клиенты насия
    async getNasiyaClients(search = '') {
        await this.connect();
        
        const filter = {};
        if (search) {
            filter.$or = [
                { name: { $regex: search, $options: 'i' } },
                { phone: { $regex: search, $options: 'i' } }
            ];
        }
        
        return await db.collection(this.collections.nasiyaClients).find(filter).toArray();
    }

    async getNasiyaClientById(id) {
        await this.connect();
        return await db.collection(this.collections.nasiyaClients).findOne({ id });
    }

    async addNasiyaClient(client) {
        await this.connect();
        
        const newClient = {
            id: uuidv4(),
            ...client,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        await db.collection(this.collections.nasiyaClients).insertOne(newClient);
        return newClient;
    }

    async updateNasiyaClient(id, updateData) {
        await this.connect();
        
        const update = {
            ...updateData,
            updatedAt: new Date().toISOString()
        };
        
        await db.collection(this.collections.nasiyaClients).updateOne(
            { id },
            { $set: update }
        );
        
        return await this.getNasiyaClientById(id);
    }

    async deleteNasiyaClient(id) {
        await this.connect();
        
        // Удаляем клиента
        await db.collection(this.collections.nasiyaClients).deleteOne({ id });
        
        // Удаляем связанные продажи
        await db.collection(this.collections.nasiyaSales).deleteMany({ clientId: id });
        
        // Удаляем связанные платежи
        await db.collection(this.collections.nasiyaPayments).deleteMany({ clientId: id });
        
        // Удаляем связанные напоминания
        await db.collection(this.collections.nasiyaReminders).deleteMany({ clientId: id });
        
        return true;
    }

    // Продажи насия
    async getNasiyaSales() {
        await this.connect();
        return await db.collection(this.collections.nasiyaSales).find({}).sort({ createdAt: -1 }).toArray();
    }

    async getNasiyaSaleById(id) {
        await this.connect();
        return await db.collection(this.collections.nasiyaSales).findOne({ id });
    }

    async getNasiyaSalesByClientId(clientId) {
        await this.connect();
        return await db.collection(this.collections.nasiyaSales).find({ clientId }).toArray();
    }

    async addNasiyaSale(sale) {
        await this.connect();
        
        const newSale = {
            id: uuidv4(),
            ...sale,
            createdAt: new Date().toISOString()
        };
        
        await db.collection(this.collections.nasiyaSales).insertOne(newSale);
        return newSale;
    }

    async updateNasiyaSale(id, updateData) {
        await this.connect();
        
        await db.collection(this.collections.nasiyaSales).updateOne(
            { id },
            { $set: { ...updateData, updatedAt: new Date().toISOString() } }
        );
        
        return await this.getNasiyaSaleById(id);
    }

    // Платежи насия
    async getNasiyaPayments() {
        await this.connect();
        return await db.collection(this.collections.nasiyaPayments).find({}).sort({ createdAt: -1 }).toArray();
    }

    async getNasiyaPaymentsByClientId(clientId) {
        await this.connect();
        return await db.collection(this.collections.nasiyaPayments).find({ clientId }).toArray();
    }

    async addNasiyaPayment(payment) {
        await this.connect();
        
        const newPayment = {
            id: uuidv4(),
            ...payment,
            createdAt: new Date().toISOString()
        };
        
        await db.collection(this.collections.nasiyaPayments).insertOne(newPayment);
        return newPayment;
    }

    // Напоминания насия
    async getNasiyaReminders() {
        await this.connect();
        return await db.collection(this.collections.nasiyaReminders).find({}).sort({ reminderDate: 1 }).toArray();
    }

    async getNasiyaRemindersByClientId(clientId) {
        await this.connect();
        return await db.collection(this.collections.nasiyaReminders).find({ clientId }).toArray();
    }

    async getUpcomingNasiyaReminders() {
        await this.connect();
        const today = new Date().toISOString().split('T')[0];
        return await db.collection(this.collections.nasiyaReminders).find({ 
            reminderDate: { $gte: today },
            completed: false 
        }).toArray();
    }

    async getTodaysNasiyaReminders() {
        await this.connect();
        const today = new Date().toISOString().split('T')[0];
        return await db.collection(this.collections.nasiyaReminders).find({ 
            reminderDate: today,
            completed: false 
        }).toArray();
    }

    async getNasiyaClientsWithDebt() {
        await this.connect();
        return await db.collection(this.collections.nasiyaClients).find({ 
            remainingDebt: { $gt: 0 } 
        }).toArray();
    }

    async addNasiyaReminder(reminder) {
        await this.connect();
        
        const newReminder = {
            id: uuidv4(),
            ...reminder,
            createdAt: new Date().toISOString()
        };
        
        await db.collection(this.collections.nasiyaReminders).insertOne(newReminder);
        return newReminder;
    }

    async updateNasiyaReminder(id, updateData) {
  await this.connect();
  
  await db.collection(this.collections.nasiyaReminders).updateOne(
    { id },
    { $set: { ...updateData, updatedAt: new Date().toISOString() } }
  );
  
  return await this.getNasiyaReminderById(id);
}
async getNasiyaReminderById(id) {
  await this.connect();
  
  try {
    let reminder = null;
    
    // Сначала ищем по полю id
    reminder = await db.collection(this.collections.nasiyaReminders).findOne({ id: id });
    
    // Если не нашли, пробуем как _id ObjectId
    if (!reminder && ObjectId.isValid(id)) {
      reminder = await db.collection(this.collections.nasiyaReminders).findOne({ 
        _id: new ObjectId(id) 
      });
    }
    
    if (reminder && !reminder.id && reminder._id) {
      reminder.id = reminder._id.toString();
    }
    
    return reminder;
  } catch (error) {
    console.error('getNasiyaReminderById error:', error);
    return null;
  }
}
async deleteNasiyaReminderById(id) {
  await this.connect();
  
  try {
    let result = null;
    
    // Пробуем удалить по id
    result = await db.collection(this.collections.nasiyaReminders).deleteOne({ id: id });
    
    // Если не нашли по id, пробуем по _id
    if (result.deletedCount === 0 && ObjectId.isValid(id)) {
      result = await db.collection(this.collections.nasiyaReminders).deleteOne({ 
        _id: new ObjectId(id) 
      });
    }
    
    return result.deletedCount > 0;
  } catch (error) {
    console.error('deleteNasiyaReminderById error:', error);
    return false;
  }
}
async markAllNasiyaRemindersAsSent(userId = 'system') {
  await this.connect();
  
  const result = await db.collection(this.collections.nasiyaReminders).updateMany(
    { sent: { $ne: true } },
    { 
      $set: { 
        sent: true,
        sentAt: new Date().toISOString(),
        sentBy: userId,
        updatedAt: new Date().toISOString()
      } 
    }
  );
  
  return result.modifiedCount;
}
    // ==================== НАСТРОЙКИ ====================

    async getSettings() {
        await this.connect();
        const settings = await db.collection(this.collections.settings).find({}).toArray();
        
        // Преобразуем массив в объект для совместимости
        const result = {};
        settings.forEach(setting => {
            result[setting.id] = setting;
        });
        
        return result;
    }

    async updateSettings(settings) {
        await this.connect();
        
        // Обновляем каждую настройку отдельно
        for (const [id, data] of Object.entries(settings)) {
            await db.collection(this.collections.settings).updateOne(
                { id },
                { $set: { ...data, updatedAt: new Date().toISOString() } },
                { upsert: true }
            );
        }
        
        return settings;
    }

    async updateWarehouseInitialDebt(debtData) {
        await this.connect();
        
        await db.collection(this.collections.settings).updateOne(
            { id: 'warehouse_settings' },
            { 
                $set: { 
                    'warehouseInitialDebt': debtData,
                    updatedAt: new Date().toISOString()
                }
            },
            { upsert: true }
        );
        
        return debtData;
    }

    // ==================== ОТЧЕТЫ ====================

    async getReports() {
        await this.connect();
        return await db.collection(this.collections.reports).find({}).toArray();
    }

    async addReport(report) {
        await this.connect();
        
        const newReport = {
            id: uuidv4(),
            ...report,
            createdAt: new Date().toISOString()
        };
        
        await db.collection(this.collections.reports).insertOne(newReport);
        return newReport;
    }

    async deleteReportsByMonth(year, month) {
        await this.connect();
        
        const result = await db.collection(this.collections.reports).deleteMany({
            year: parseInt(year),
            month: parseInt(month)
        });
        
        return { deletedCount: result.deletedCount };
    }
}

// Экспортируем экземпляр класса
const database = new Database();

// Экспортируем все методы и константы
module.exports = {
    // Основные методы
    ensureDatabaseInitialized: database.ensureDatabaseInitialized.bind(database),
    readDB: database.readDB.bind(database),
    getDatabaseData: database.getDatabaseData.bind(database),
    writeDB: database.writeDB.bind(database),
    
    // Пользователи
    findUserByUsername: database.findUserByUsername.bind(database),
    findUserById: database.findUserById.bind(database),
    getUsers: database.getUsers.bind(database),
    saveUser: database.saveUser.bind(database),
    deleteUser: database.deleteUser.bind(database),
    
    // Продукты
    getProducts: database.getProducts.bind(database),
    getProductById: database.getProductById.bind(database),
    addProduct: database.addProduct.bind(database),
    updateProduct: database.updateProduct.bind(database),
    deleteProduct: database.deleteProduct.bind(database),
    deleteProductImage: database.deleteProductImage.bind(database),
    updateProductStock: database.updateProductStock.bind(database),
    updateProductCost: database.updateProductCost.bind(database),
    
    // Продажи
    getSales: database.getSales.bind(database),
    getSaleById: database.getSaleById.bind(database),
    addSale: database.addSale.bind(database),
    deleteSale: database.deleteSale.bind(database),
    getSalesByProductId: database.getSalesByProductId.bind(database),
    
    // Склад
    getWarehouseLogs: database.getWarehouseLogs.bind(database),
    addWarehouseLog: database.addWarehouseLog.bind(database),
    refundSale: database.refundSale.bind(database),
    // Платежи склада
    getWarehousePayments: database.getWarehousePayments.bind(database),
    addWarehousePayment: database.addWarehousePayment.bind(database),
    
    // Логи пользователей
    getUserLogs: database.getUserLogs.bind(database),
    addUserLog: database.addUserLog.bind(database),
    
    // Уведомления
    getNotifications: database.getNotifications.bind(database),
    addNotification: database.addNotification.bind(database),
    markNotificationAsRead: database.markNotificationAsRead.bind(database),
    markAllNotificationsAsRead: database.markAllNotificationsAsRead.bind(database),
    deleteNotification: database.deleteNotification.bind(database),
    deleteUserNotifications: database.deleteUserNotifications.bind(database),
    deleteAllNotifications: database.deleteAllNotifications.bind(database),
    getUnreadNotificationsCount: database.getUnreadNotificationsCount.bind(database),
    
    // Накладные
    getInvoices: database.getInvoices.bind(database),
    getInvoiceById: database.getInvoiceById.bind(database),
    addInvoice: database.addInvoice.bind(database),
    
    // Система насия
    getNasiyaClients: database.getNasiyaClients.bind(database),
    getNasiyaClientById: database.getNasiyaClientById.bind(database),
    addNasiyaClient: database.addNasiyaClient.bind(database),
    updateNasiyaClient: database.updateNasiyaClient.bind(database),
    deleteNasiyaClient: database.deleteNasiyaClient.bind(database),
    getNasiyaSales: database.getNasiyaSales.bind(database),
    getNasiyaSaleById: database.getNasiyaSaleById.bind(database),
    getNasiyaSalesByClientId: database.getNasiyaSalesByClientId.bind(database),
    addNasiyaSale: database.addNasiyaSale.bind(database),
    updateNasiyaSale: database.updateNasiyaSale.bind(database),
    getNasiyaPayments: database.getNasiyaPayments.bind(database),
    getNasiyaPaymentsByClientId: database.getNasiyaPaymentsByClientId.bind(database),
    addNasiyaPayment: database.addNasiyaPayment.bind(database),
    getNasiyaReminders: database.getNasiyaReminders.bind(database),
    getNasiyaRemindersByClientId: database.getNasiyaRemindersByClientId.bind(database),
    getUpcomingNasiyaReminders: database.getUpcomingNasiyaReminders.bind(database),
    getTodaysNasiyaReminders: database.getTodaysNasiyaReminders.bind(database),
    getNasiyaClientsWithDebt: database.getNasiyaClientsWithDebt.bind(database),
    addNasiyaReminder: database.addNasiyaReminder.bind(database),
    updateNasiyaReminder: database.updateNasiyaReminder.bind(database),
     getNasiyaReminderById: database.getNasiyaReminderById.bind(database),
      deleteNasiyaReminderById: database.deleteNasiyaReminderById.bind(database),
       markAllNasiyaRemindersAsSent: database.markAllNasiyaRemindersAsSent.bind(database),
    // Настройки
    getSettings: database.getSettings.bind(database),
    updateSettings: database.updateSettings.bind(database),
    updateWarehouseInitialDebt: database.updateWarehouseInitialDebt.bind(database),
    
    // Отчеты
    getReports: database.getReports.bind(database),
    addReport: database.addReport.bind(database),
    deleteReportsByMonth: database.deleteReportsByMonth.bind(database),
    
    // Константы
    DB_PATH,
    UPLOADS_DIR,
    
    // Методы для удобства
    connect: database.connect.bind(database),
    disconnect: database.disconnect.bind(database),
    findUserById: database.findUserById.bind(database),
};