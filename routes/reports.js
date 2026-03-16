// routes/reports.js
const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { verifyToken, requireRole } = require('../middleware/auth');
const { 
  getReports, 
  addReport, 
  deleteReportsByMonth, 
  addUserLog 
} = require('../database');

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
 * GET /api/reports
 * Список всех отчётов
 */
router.get('/', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const reports = await getReports();
    res.json({ success: true, reports });
  } catch (err) {
    console.error('GET /reports error:', err);
    res.status(500).json({ success: false, message: 'Server error: ' + err.message });
  }
});

/**
 * POST /api/reports
 * Создать новый месячный отчёт
 */
router.post('/', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const { month, year, data } = req.body;
    if (!month || !year) {
      return res.status(400).json({ success: false, message: 'Month и year обязательны' });
    }

    const report = {
      month,
      year,
      data: data || []
    };

    const savedReport = await addReport(report);

    // ЛОГИРОВАНИЕ ДЕЙСТВИЯ ПОЛЬЗОВАТЕЛЯ
    await addUserLog({
      userId: req.user.id,
      action: 'report_create',
      details: `Yangi hisobot: ${year}-yil ${month}-oy, Ma'lumotlar: ${data?.length || 0} ta`,
      entityId: savedReport.id || savedReport._id,
      entityType: 'report',
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'] || '',
      timestamp: new Date().toISOString()
    });

    res.json({ success: true, report: savedReport });
  } catch (err) {
    console.error('POST /reports error:', err);
    res.status(500).json({ success: false, message: 'Server error: ' + err.message });
  }
});

/**
 * DELETE /api/reports/month/:year/:month
 * Удаляет весь отчёт за указанный месяц и год
 */
router.delete('/month/:year/:month', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const { year, month } = req.params;

    const result = await deleteReportsByMonth(parseInt(year), parseInt(month));

    // ЛОГИРОВАНИЕ ДЕЙСТВИЯ ПОЛЬЗОВАТЕЛЯ
    if (result.deletedCount > 0) {
      await addUserLog({
        userId: req.user.id,
        action: 'report_delete',
        details: `Hisobot o'chirildi: ${year}-yil ${month}-oy, O'chirilganlar: ${result.deletedCount} ta`,
        entityId: `${year}-${month}`,
        entityType: 'report',
        ipAddress: getClientIp(req),
        userAgent: req.headers['user-agent'] || '',
        timestamp: new Date().toISOString()
      });
    }

    res.json({
      success: true,
      message: `Reports deleted: ${result.deletedCount}`,
      deletedCount: result.deletedCount
    });
  } catch (err) {
    console.error('DELETE /reports/month error:', err);
    res.status(500).json({ success: false, message: 'Server error: ' + err.message });
  }
});

module.exports = router;