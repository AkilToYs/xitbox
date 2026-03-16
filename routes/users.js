// routes/users.js - ДОПОЛНЕННАЯ ВЕРСИЯ
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');

const { verifyToken, requireRole } = require('../middleware/auth');
const database = require('../database'); // ИЗМЕНЕНО: импорт всего объекта

// Функция для получения IP
function getClientIp(req) {
  if (req.headers['cf-connecting-ip']) return req.headers['cf-connecting-ip'];
  const xForwardedFor = req.headers['x-forwarded-for'];
  if (xForwardedFor) {
    const ips = xForwardedFor.split(',').map(ip => ip.trim());
    return ips[0];
  }
  if (req.headers['x-client-ip']) return req.headers['x-client-ip'];
  return req.ip || req.connection?.remoteAddress || req.socket?.remoteAddress || 'unknown';
}

// GET /api/users
router.get('/', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const users = await database.getUsers(); // ИЗМЕНЕНО: через database
    res.json({ success: true, users });
  } catch (err) {
    console.error('users.GET error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/users/:id - Получить пользователя по ID
router.get('/:id', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const user = await database.findUserById(id); // ИЗМЕНЕНО: через database
    
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'Foydalanuvchi topilmadi' 
      });
    }
    
    res.json({ success: true, user });
  } catch (err) {
    console.error('users.GET by ID error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// PUT /api/users/:id - Обновить пользователя
router.put('/:id', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body;
    
    const user = await database.findUserById(id); // ИЗМЕНЕНО: через database
    
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'Foydalanuvchi topilmadi' 
      });
    }
    
    // Подготавливаем обновленные данные с новыми полями
    const updatedData = {
      ...user,
      role: body.role || user.role,
      fullName: body.fullName || user.fullName,
      phone: body.phone !== undefined ? body.phone : user.phone,
      email: body.email !== undefined ? body.email : user.email,
      status: body.status || user.status
    };
    
    // Если пароль обновляется
    if (body.password) {
      updatedData.password = bcrypt.hashSync(body.password, 10);
    }
    
    // Сохраняем обновленного пользователя
    const savedUser = await database.saveUser(updatedData); // ИЗМЕНЕНО: через database
    
    // Логируем обновление
    await database.addUserLog({ // ИЗМЕНЕНО: через database
      userId: req.user.id,
      action: 'user_update',
      details: `Foydalanuvchi o'zgartirildi: ${savedUser.username} (${savedUser.role})`,
      entityId: savedUser.id || savedUser._id, // ОБНОВЛЕНО: поддержка обоих форматов
      entityType: 'user',
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'] || ''
    });
    
    res.json({ 
      success: true, 
      user: savedUser,
      message: 'Foydalanuvchi muvaffaqiyatli yangilandi'
    });
  } catch (err) {
    console.error('users.PUT error:', err);
    res.status(500).json({ 
      success: false, 
      message: err.message || 'Server error' 
    });
  }
});

// POST /api/users
router.post('/', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const body = req.body;
    if (!body.username || !body.password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Username va password talab qilinadi' 
      });
    }

    // Проверяем, существует ли пользователь
    const existingUser = await database.findUserByUsername(body.username); // ИЗМЕНЕНО: через database
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Bu foydalanuvchi nomi band'
      });
    }

    const newUser = {
      username: body.username,
      password: bcrypt.hashSync(body.password, 10),
      role: body.role || 'seller',
      fullName: body.fullName || body.username,
      phone: body.phone || '',
      email: body.email || '',
      status: body.status || 'active'
    };

    // Сохраняем пользователя через метод базы данных
    const savedUser = await database.saveUser(newUser); // ИЗМЕНЕНО: через database

    // Логируем создание пользователя
    await database.addUserLog({ // ИЗМЕНЕНО: через database
      userId: req.user.id,
      action: 'user_create',
      details: `Yangi foydalanuvchi yaratildi: ${savedUser.username} (${savedUser.role})`,
      entityId: savedUser.id || savedUser._id, // ОБНОВЛЕНО: поддержка обоих форматов
      entityType: 'user',
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'] || ''
    });

    res.json({ 
      success: true, 
      user: savedUser,
      message: 'Foydalanuvchi muvaffaqiyatli yaratildi'
    });
  } catch (err) {
    console.error('users.POST error:', err);
    res.status(500).json({ 
      success: false, 
      message: err.message || 'Server error' 
    });
  }
});

// DELETE /api/users/:id
router.delete('/:id', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    
    const user = await database.findUserById(id); // ИЗМЕНЕНО: через database
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Foydalanuvchi topilmadi'
      });
    }
    
    const result = await database.deleteUser(id); // ИЗМЕНЕНО: через database
    
    if (result) {
      await database.addUserLog({ // ИЗМЕНЕНО: через database
        userId: req.user.id,
        action: 'user_delete',
        details: `Foydalanuvchi o'chirildi: ${user.username} (${user.role})`,
        entityId: id,
        entityType: 'user',
        ipAddress: getClientIp(req),
        userAgent: req.headers['user-agent'] || ''
      });
      
      res.json({
        success: true,
        message: 'Foydalanuvchi muvaffaqiyatli o\'chirildi'
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Foydalanuvchini o\'chirishda xatolik'
      });
    }
  } catch (err) {
    console.error('users.DELETE error:', err);
    res.status(500).json({
      success: false,
      message: err.message || 'Server error'
    });
  }
});

// НОВЫЙ ЭНДПОИНТ: Для обратной совместимости с auth.js
// findUserByUsername уже используется в auth.js для регистрации
async function findUserByUsername(username) {
  return await database.findUserByUsername(username);
}

module.exports = router;