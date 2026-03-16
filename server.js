const express = require("express");
const cors = require('cors');
const path = require('path');
const db = require('./database.js');
require('dotenv').config();
// ===== middleware =====
const { verifyToken, requireRole, verifyTokenForRoute } = require('./middleware/auth');
const { uploadSingle } = require('./middleware/upload');

// ===== routes =====
const authRoutes = require('./routes/auth');
const productsRoutes = require('./routes/products');
const warehouseRoutes = require('./routes/warehouse');
const salesRoutes = require('./routes/sales');
const usersRoutes = require('./routes/users');
const settingsRoutes = require('./routes/setting');
const userLogsRouter = require('./routes/userLogs.js');

// ===== НОВЫЕ МАРШРУТЫ =====
const notificationRoutes = require('./routes/notification');
const nasiyaRoutes = require('./routes/nasiya');
const invoicesRoutes = require('./routes/invoices');
const reportsRoutes = require('./routes/reports');

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

// ===== ВАЖНО: ДОБАВЬТЕ ЭТУ НАСТРОЙКУ ПЕРВОЙ =====
app.set('trust proxy', true);

// ===== global =====
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ===== static =====
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// защищённые роуты
app.use('/api/auth', authRoutes);
app.use('/api/products', verifyToken, productsRoutes);
app.use('/api/warehouse', verifyToken, warehouseRoutes);
app.use('/api/users/logs', verifyToken, userLogsRouter);
app.use('/api/sales', verifyToken, salesRoutes);
app.use('/api/users', verifyToken, requireRole('admin'), usersRoutes);  // Уже есть, для пользователей
app.use('/api/settings', verifyToken, requireRole('admin'), settingsRoutes);
app.use('/api/notifications', verifyToken, notificationRoutes);  // Предполагаю, что это уже есть или добавьте
app.use('/api/nasiya', verifyToken, nasiyaRoutes);
app.use('/api/invoices', verifyToken, invoicesRoutes);
app.use('/api/reports', verifyToken, reportsRoutes);


// ===== health =====
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    time: new Date().toISOString()
  });
});

// Удалите или закомментируйте эту строку, так как verifyToken уже есть в middleware/auth.js
// app.get('/api/auth/verify', (req, res) => {
//   const auth = require('./middleware/auth');
//   auth.verifyTokenRoute(req, res);
// });
app.get('/api/auth/verify', verifyTokenForRoute);
// ===== frontend =====
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/login.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/dokon.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dokon.html'));
});

// ===== API 404 =====
app.use('/api/*', (req, res) => {
  console.error(`API route not found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    success: false,
    message: `API route not found: ${req.originalUrl}`
  });
});

// ===== error handler =====
app.use((err, req, res, next) => {
  console.error('SERVER ERROR:', err.message);
  res.status(500).json({
    success: false,
    message: err.message || 'Internal server error'
  });
});

// ===== start =====
async function start() {
  try {
    await db.ensureDatabaseInitialized();
    app.listen(PORT, HOST, () => {
      console.log(`🚀 Server running on http://${HOST}:${PORT}`);
      console.log(`📡 MongoDB connected to: ${process.env.MONGODB_URI || 'mongodb://localhost:27017'}`);
      console.log(`📊 Database: ${process.env.DB_NAME || 'dokon_store'}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();