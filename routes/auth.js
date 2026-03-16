// routes/auth.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const database = require('../database');
const { verifyToken, requireRole, SECRET } = require('../middleware/auth');

// Логин
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Foydalanuvchi nomi va parol kiritilishi shart' 
      });
    }

    // Находим пользователя
    const user = await database.findUserByUsername(username);
    
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Noto\'g\'ri foydalanuvchi nomi yoki parol' 
      });
    }

    // Проверяем пароль
    const validPassword = await bcrypt.compare(password, user.password);
    
    if (!validPassword) {
      return res.status(401).json({ 
        success: false, 
        message: 'Noto\'g\'ri foydalanuvchi nomi yoki parol' 
      });
    }

    // Проверяем статус пользователя
    if (user.status !== 'active') {
      return res.status(403).json({ 
        success: false, 
        message: 'Foydalanuvchi faol emas' 
      });
    }

    // Убедимся, что у пользователя есть id поле
    const userId = user.id || (user._id ? user._id.toString() : null);
    
    if (!userId) {
      console.error('User ID not found:', user);
      return res.status(500).json({
        success: false,
        message: 'Foydalanuvchi ID topilmadi'
      });
    }

    // Создаем токен
    const token = jwt.sign(
      { 
        id: userId, 
        username: user.username, 
        role: user.role, 
        fullName: user.fullName 
      }, 
      SECRET, 
      { expiresIn: '24h' }
    );

    // Логируем вход
    try {
      if (database.addUserLog) {
        await database.addUserLog({
          userId: userId,
          action: 'login',
          details: `Foydalanuvchi tizimga kirdi: ${user.username}`,
          entityId: userId,
          entityType: 'user',
          ipAddress: req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
          userAgent: req.headers['user-agent'] || '',
          timestamp: new Date().toISOString()
        });
      }
    } catch (logErr) {
      console.warn('Failed to log user login:', logErr);
    }

    res.json({
      success: true,
      message: 'Muvaffaqiyatli kirish',
      token,
      user: {
        id: userId,
        username: user.username,
        role: user.role,
        fullName: user.fullName,
        status: user.status,
        phone: user.phone || '',
        email: user.email || ''
      }
    });

  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Server xatosi: ' + err.message 
    });
  }
});

// Проверка токена
router.get('/verify', verifyToken, (req, res) => {
  try {
    res.json({ 
      success: true, 
      valid: true, 
      user: req.user 
    });
  } catch (err) {
    console.error('Token verify error:', err);
    return res.status(401).json({ 
      success: false, 
      message: 'Token yaroqsiz yoki muddati o\'tgan' 
    });
  }
});

// Смена пароля
router.post('/change-password', verifyToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ 
        success: false, 
        message: 'Barcha maydonlar to\'ldirilishi shart' 
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ 
        success: false, 
        message: 'Yangi parol kamida 6 ta belgidan iborat bo\'lishi kerak' 
      });
    }

    // Находим пользователя по ID из токена
    const user = await database.findUserById(req.user.id);
    
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'Foydalanuvchi topilmadi' 
      });
    }

    // Убедимся, что у пользователя есть id поле
    const userId = user.id || (user._id ? user._id.toString() : null);
    
    if (!userId) {
      return res.status(500).json({ 
        success: false, 
        message: 'Foydalanuvchi ID topilmadi' 
      });
    }

    // Проверяем текущий пароль
    const validPassword = await bcrypt.compare(currentPassword, user.password);
    
    if (!validPassword) {
      return res.status(401).json({ 
        success: false, 
        message: 'Joriy parol noto\'g\'ri' 
      });
    }

    // Хешируем новый пароль
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Обновляем пароль
    await database.updateUserPassword(userId, newPassword);

    // Логируем смену пароля
    try {
      if (database.addUserLog) {
        await database.addUserLog({
          userId: req.user.id,
          action: 'password_change',
          details: 'Parol muvaffaqiyatli o\'zgartirildi',
          entityId: userId,
          entityType: 'user',
          ipAddress: req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
          userAgent: req.headers['user-agent'] || '',
          timestamp: new Date().toISOString()
        });
      }
    } catch (logErr) {
      console.warn('Failed to log password change:', logErr);
    }

    res.json({
      success: true,
      message: 'Parol muvaffaqiyatli o\'zgartirildi'
    });

  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Server xatosi: ' + err.message 
    });
  }
});

// Регистрация нового пользователя (только для admin/superadmin)
router.post('/register', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const { username, password, role, fullName, phone, email } = req.body;

    if (!username || !password || !role || !fullName) {
      return res.status(400).json({ 
        success: false, 
        message: 'Barcha maydonlar to\'ldirilishi shart' 
      });
    }

    if (password.length < 6) {
      return res.status(400).json({ 
        success: false, 
        message: 'Parol kamida 6 ta belgidan iborat bo\'lishi kerak' 
      });
    }

    // Проверяем, существует ли пользователь
    const existingUser = await database.findUserByUsername(username);
    
    if (existingUser) {
      return res.status(400).json({ 
        success: false, 
        message: 'Bu foydalanuvchi nomi band' 
      });
    }

    // Проверяем допустимые роли
    const allowedRoles = ['seller', 'warehouse', 'admin'];
    if (!allowedRoles.includes(role)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Noto\'g\'ri rol. Ruxsat etilgan rollar: seller, warehouse, admin' 
      });
    }

    // Хешируем пароль
    const hashedPassword = await bcrypt.hash(password, 10);

    // Создаем пользователя
    const newUser = {
      username,
      password: hashedPassword,
      role,
      fullName,
      phone: phone || '',
      email: email || '',
      status: 'active'
    };

    // Сохраняем пользователя
    const savedUser = await database.saveUser(newUser);
    
    // Убедимся, что у сохраненного пользователя есть id поле
    const savedUserId = savedUser.id || (savedUser._id ? savedUser._id.toString() : null);
    
    if (!savedUserId) {
      console.error('Saved user ID not found:', savedUser);
      return res.status(500).json({
        success: false,
        message: 'Foydalanuvchi yaratildi, lekin ID topilmadi'
      });
    }

    // Логируем создание пользователя
    try {
      if (database.addUserLog) {
        await database.addUserLog({
          userId: req.user.id,
          action: 'user_create',
          details: `Yangi foydalanuvchi yaratildi: ${username} (${role})`,
          entityId: savedUserId,
          entityType: 'user',
          ipAddress: req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
          userAgent: req.headers['user-agent'] || '',
          timestamp: new Date().toISOString()
        });
      }
    } catch (logErr) {
      console.warn('Failed to log user creation:', logErr);
    }

    res.json({
      success: true,
      message: 'Foydalanuvchi muvaffaqiyatli yaratildi',
      user: {
        id: savedUserId,
        username: savedUser.username,
        role: savedUser.role,
        fullName: savedUser.fullName,
        status: savedUser.status,
        phone: savedUser.phone || '',
        email: savedUser.email || '',
        createdAt: savedUser.createdAt || new Date().toISOString()
      }
    });

  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Server xatosi: ' + err.message 
    });
  }
});

// Получить профиль текущего пользователя
router.get('/profile', verifyToken, async (req, res) => {
  try {
    const user = await database.findUserById(req.user.id);
    
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'Foydalanuvchi topilmadi' 
      });
    }

    // Убедимся, что у пользователя есть id поле
    const userId = user.id || (user._id ? user._id.toString() : null);
    
    res.json({
      success: true,
      user: {
        id: userId,
        username: user.username,
        role: user.role,
        fullName: user.fullName,
        phone: user.phone || '',
        email: user.email || '',
        status: user.status,
        createdAt: user.createdAt
      }
    });
  } catch (err) {
    console.error('Profile error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Server xatosi: ' + err.message 
    });
  }
});

// Обновить профиль
router.put('/profile', verifyToken, async (req, res) => {
  try {
    const { fullName, phone, email } = req.body;
    
    const user = await database.findUserById(req.user.id);
    
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'Foydalanuvchi topilmadi' 
      });
    }

    // Убедимся, что у пользователя есть id поле
    const userId = user.id || (user._id ? user._id.toString() : null);
    
    // Обновляем данные
    const updatedUser = {
      ...user,
      fullName: fullName || user.fullName,
      phone: phone !== undefined ? phone : user.phone,
      email: email !== undefined ? email : user.email
    };

    // Сохраняем обновленного пользователя
    const savedUser = await database.saveUser(updatedUser);
    
    // Логируем обновление
    try {
      if (database.addUserLog) {
        await database.addUserLog({
          userId: req.user.id,
          action: 'profile_update',
          details: 'Foydalanuvchi profili yangilandi',
          entityId: userId,
          entityType: 'user',
          ipAddress: req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
          userAgent: req.headers['user-agent'] || '',
          timestamp: new Date().toISOString()
        });
      }
    } catch (logErr) {
      console.warn('Failed to log profile update:', logErr);
    }

    res.json({
      success: true,
      message: 'Profil muvaffaqiyatli yangilandi',
      user: {
        id: userId,
        username: savedUser.username,
        role: savedUser.role,
        fullName: savedUser.fullName,
        phone: savedUser.phone || '',
        email: savedUser.email || '',
        status: savedUser.status
      }
    });
  } catch (err) {
    console.error('Profile update error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Server xatosi: ' + err.message 
    });
  }
});

// Выход из системы
router.post('/logout', verifyToken, async (req, res) => {
  try {
    // Логируем выход
    try {
      if (database.addUserLog) {
        await database.addUserLog({
          userId: req.user.id,
          action: 'logout',
          details: `Foydalanuvchi tizimdan chiqdi: ${req.user.username}`,
          entityId: req.user.id,
          entityType: 'user',
          ipAddress: req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
          userAgent: req.headers['user-agent'] || '',
          timestamp: new Date().toISOString()
        });
      }
    } catch (logErr) {
      console.warn('Failed to log user logout:', logErr);
    }

    res.json({
      success: true,
      message: 'Muvaffaqiyatli chiqish'
    });
  } catch (err) {
    console.error('Logout error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Server xatosi: ' + err.message 
    });
  }
});

// Проверка доступности имени пользователя
router.get('/check-username/:username', async (req, res) => {
  try {
    const { username } = req.params;
    
    if (!username) {
      return res.status(400).json({ 
        success: false, 
        message: 'Foydalanuvchi nomi kiritilishi shart' 
      });
    }

    const user = await database.findUserByUsername(username);
    
    res.json({
      success: true,
      available: !user,
      username: username
    });
  } catch (err) {
    console.error('Check username error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Server xatosi: ' + err.message 
    });
  }
});

module.exports = router;