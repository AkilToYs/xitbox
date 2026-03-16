// routes/settings.js
const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');

const { verifyToken, requireRole } = require('../middleware/auth');
const { getSettings, updateSettings, addUserLog } = require('../database');

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

// GET /api/settings
router.get('/', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const settings = await getSettings();
    res.json({ success: true, settings });
  } catch (err) {
    console.error('settings.GET error:', err);
    res.status(500).json({ success: false, message: 'Server error: ' + err.message });
  }
});

// PUT /api/settings
router.put('/', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const body = req.body || {};
    
    // Получаем старые настройки для сравнения
    const oldSettings = await getSettings();
    
    const updated = await updateSettings(body);

    // Логируем изменение настроек
    await addUserLog({
      userId: req.user.id,
      action: 'settings_update',
      details: `Sozlamalar yangilandi. O'zgartirilgan maydonlar: ${Object.keys(body).join(', ')}`,
      entityId: 'settings',
      entityType: 'settings',
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'] || '',
      timestamp: new Date().toISOString()
    });

    res.json({ success: true, settings: updated });
  } catch (err) {
    console.error('settings.PUT error:', err);
    res.status(500).json({ success: false, message: 'Server error: ' + err.message });
  }
});

module.exports = router;