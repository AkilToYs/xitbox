// routes/invoices.js
const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { verifyToken, requireRole } = require('../middleware/auth');
const { 
  addInvoice, 
  getInvoices, 
  getInvoiceById, 
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
 * POST /api/invoices
 * Создать новый счёт-фактуру
 */
router.post('/', verifyToken, requireRole('seller'), async (req, res) => {
  try {
    const { customer, items, date } = req.body;
 const isSuperAdmin = req.user.role === 'superadmin';
        if (!isSuperAdmin) {
            for (const item of items) {
                const product = await getProductById(item.productId);
                if (!product || (product.stock || 0) < item.quantity) {
                    return res.status(400).json({ 
                        success: false, 
                        message: `Yetarli stock yo'q: ${item.productName}` 
                    });
                }
            }
        }
    if (!customer || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Неверные данные' });
    }

    const total = items.reduce((sum, i) => sum + (i.quantity * i.price || 0), 0);

    const invoice = {
      customer,
      items,
      total,
      date: date || new Date().toISOString(),
      userId: req.user.id
    };

    const savedInvoice = await addInvoice(invoice);

    // ЛОГИРОВАНИЕ ДЕЙСТВИЯ ПОЛЬЗОВАТЕЛЯ
    await addUserLog({
      userId: req.user.id,
      action: 'invoice_create',
      details: `Yangi hisob-faktura: ${customer}, ${items.length} ta mahsulot, Jami: ${total} UZS`,
      entityId: savedInvoice.id || savedInvoice._id,
      entityType: 'invoice',
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'] || '',
      timestamp: new Date().toISOString()
    });

    res.json({ success: true, invoice: savedInvoice });
  } catch (err) {
    console.error('POST /invoices error:', err);
    res.status(500).json({ success: false, message: 'Server error: ' + err.message });
  }
});

/**
 * GET /api/invoices
 * Список всех счетов-фактур
 */
router.get('/', verifyToken, requireRole('seller'), async (req, res) => {
  try {
    const invoices = await getInvoices();
    res.json({ success: true, invoices });
  } catch (err) {
    console.error('GET /invoices error:', err);
    res.status(500).json({ success: false, message: 'Server error: ' + err.message });
  }
});

/**
 * GET /api/invoices/:id
 * Получить конкретный счёт
 */
router.get('/:id', verifyToken, requireRole('seller'), async (req, res) => {
  try {
    const invoice = await getInvoiceById(req.params.id);
    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }
    res.json({ success: true, invoice });
  } catch (err) {
    console.error('GET /invoices/:id error:', err);
    res.status(500).json({ success: false, message: 'Server error: ' + err.message });
  }
});

module.exports = router;