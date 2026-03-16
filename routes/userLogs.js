// routes/userLogs.js
const express = require('express');
const router = express.Router();

const { verifyToken, requireRole } = require('../middleware/auth');
const database = require('../database'); // ИЗМЕНЕНО: импорт всего объекта

// Функция для получения реального IP клиента
function getClientIp(req) {
  if (req.headers['cf-connecting-ip']) {
    return req.headers['cf-connecting-ip'];
  }
  
  const xForwardedFor = req.headers['x-forwarded-for'];
  if (xForwardedFor) {
    const ips = xForwardedFor.split(',').map(ip => ip.trim());
    return ips[0];
  }
  
  if (req.headers['x-client-ip']) {
    return req.headers['x-client-ip'];
  }
  
  return req.ip || req.connection?.remoteAddress || req.socket?.remoteAddress || 'unknown';
}

/**
 * GET /api/users/logs/debug-ip
 * Для отладки - показывает какой IP видит сервер
 */
router.get('/debug-ip', (req, res) => {
  const ipHeaders = {};
  Object.keys(req.headers).forEach(key => {
    const lowerKey = key.toLowerCase();
    if (lowerKey.includes('ip') || 
        lowerKey.includes('forward') || 
        lowerKey.includes('client') ||
        lowerKey.includes('real')) {
      ipHeaders[key] = req.headers[key];
    }
  });
  
  res.json({
    success: true,
    clientIp: getClientIp(req),
    serverInfo: {
      ip: req.ip,
      connectionRemoteAddress: req.connection?.remoteAddress,
      socketRemoteAddress: req.socket?.remoteAddress,
      connectionSocketRemoteAddress: req.connection?.socket?.remoteAddress,
    },
    headers: ipHeaders,
    method: req.method,
    url: req.url,
    protocol: req.protocol,
    secure: req.secure,
    hostname: req.hostname,
    timestamp: new Date().toISOString()
  });
});

/**
 * GET /api/users/logs
 * Получить логи действий пользователей
 */
router.get('/', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const { userId, action, limit = 50, page = 1 } = req.query;
    
    const logs = await database.getUserLogs({ // ИЗМЕНЕНО: через database
      userId: userId !== 'all' ? userId : undefined,
      action: action !== 'all' ? action : undefined,
      limit: parseInt(limit),
      page: parseInt(page)
    });
    
    // Получаем информацию о пользователях
    const users = await database.getUsers(); // ИЗМЕНЕНО: через database
    const logsWithUserInfo = logs.data.map(log => {
      const user = users.find(u => 
        u.id === log.userId || 
        u._id === log.userId || 
        (u._id && u._id.toString() === log.userId)
      );
      return {
        ...log,
        userName: user ? user.username : 'Неизвестный',
        userFullName: user ? user.fullName : 'Неизвестный'
      };
    });
    
    res.json({
      success: true,
      logs: logsWithUserInfo,
      pagination: logs.pagination
    });
  } catch (err) {
    console.error('GET /users/logs error:', err);
    res.status(500).json({ success: false, message: 'Server error: ' + err.message });
  }
});

/**
 * POST /api/users/logs
 * Создать лог действия пользователя
 */
router.post('/', verifyToken, async (req, res) => {
  try {
    const { action, details, entityId, entityType } = req.body;
    
    if (!action) {
      return res.status(400).json({ 
        success: false, 
        message: 'Action обязателен' 
      });
    }
    
    const log = {
      userId: req.user.id,
      action,
      details: details || '',
      entityId: entityId || null,
      entityType: entityType || null,
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'] || '',
      timestamp: new Date().toISOString()
    };
    
    const savedLog = await database.addUserLog(log); // ИЗМЕНЕНО: через database
    
    res.json({ success: true, log: savedLog });
  } catch (err) {
    console.error('POST /users/logs error:', err);
    res.status(500).json({ success: false, message: 'Server error: ' + err.message });
  }
});

module.exports = router;