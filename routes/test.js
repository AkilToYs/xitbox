// routes/test.js
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { SECRET } = require('../middleware/auth');

// Эндпоинт для тестирования токена
router.get('/test-token', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Токен не предоставлен или неверный формат'
      });
    }

    const token = authHeader.split(' ')[1];
    
    console.log('Полученный токен:', token);
    console.log('SECRET:', SECRET);
    
    try {
      const decoded = jwt.verify(token, SECRET);
      console.log('Декодированный токен:', decoded);
      
      return res.json({
        success: true,
        message: 'Токен валиден',
        user: decoded
      });
    } catch (jwtError) {
      console.error('Ошибка проверки токена:', jwtError.message);
      
      return res.status(401).json({
        success: false,
        message: 'Токен невалиден',
        error: jwtError.message
      });
    }
  } catch (err) {
    console.error('Общая ошибка:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: err.message
    });
  }
});

// Эндпоинт для теста без аутентификации
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Сервер работает',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;