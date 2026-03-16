// routes/warehouse.js - ИСПРАВЛЕННАЯ ВЕРСИЯ (убрано двойное обновление стока)
const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');

const { verifyToken, requireRole } = require('../middleware/auth');
const database = require('../database'); // Используем методы MongoDB

// Функция для получения реального IP клиента
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

// Функция для генерации ID прихода (для bulk-receive)
function generateReceiptId() {
  return `REC-${uuidv4().slice(0, 8)}-${Date.now()}`;
}

/**
 * GET /api/warehouse/logs
 */
router.get('/logs', verifyToken, requireRole('seller'), async (req, res) => {
  try {
    const { month, year, type, limit = 100 } = req.query;
    
    const logs = await database.getWarehouseLogs();
    
    let filteredLogs = logs || [];
    
    if (type && ['akitoy', 'makplast'].includes(type)) {
      filteredLogs = filteredLogs.filter(log => 
        log.productType === type || log.type === type
      );
    }
    
    if (month !== undefined && year !== undefined) {
      const filterMonth = parseInt(month);
      const filterYear = parseInt(year);
      
      filteredLogs = filteredLogs.filter(log => {
        if (!log.date) return false;
        const logDate = new Date(log.date);
        return logDate.getMonth() === filterMonth && 
               logDate.getFullYear() === filterYear;
      });
    }
    
    filteredLogs.sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt));
    
    if (limit > 0) {
      filteredLogs = filteredLogs.slice(0, parseInt(limit));
    }
    
    res.json({ 
      success: true, 
      logs: filteredLogs,
      total: filteredLogs.length
    });
  } catch (err) {
    console.error('warehouse/logs error:', err.message);
    res.status(500).json({ 
      success: false, 
      message: 'Server error: ' + err.message 
    });
  }
});

/**
 * POST /api/warehouse/payment
 */
router.post('/payment', verifyToken, requireRole('warehouse'), async (req, res) => {
  try {
    const { type, amount, date, description } = req.body;

    if (!type || !amount) {
      return res.status(400).json({ 
        success: false, 
        message: 'type va amount majburiy' 
      });
    }

    const payment = await database.addWarehousePayment({
      type,
      amount: Number(amount),
      date: date || new Date().toISOString(),
      description: description || '',
      userId: req.user.id
    });

    await database.addUserLog({
      userId: req.user.id,
      action: 'warehouse_payment',
      details: `To'lov amalga oshirildi: ${type}, ${amount} UZS, ${description || ''}`,
      entityId: payment.id,
      entityType: 'warehouse_payment',
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'] || '',
      timestamp: new Date().toISOString()
    });

    res.json({ success: true, payment });
  } catch (err) {
    console.error('warehouse/payment error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * GET /api/warehouse/debt
 */
router.get('/debt', verifyToken, requireRole('seller'), async (req, res) => {
  try {
    const settings = await database.getSettings();
    const warehouseSettings = settings.warehouse_settings || {};
    const initialDebt = warehouseSettings.warehouseInitialDebt || {
      akitoy: 0,
      makplast: 0
    };
    
    const logs = await database.getWarehouseLogs();
    const totalPurchases = { akitoy: 0, makplast: 0 };
    
    logs.forEach(log => {
      if (log.type === 'receive') {
        const total = log.totalCost || (log.quantity * log.cost) || 0;
        if (log.productType === 'akitoy') {
          totalPurchases.akitoy += total;
        } else if (log.productType === 'makplast') {
          totalPurchases.makplast += total;
        }
      }
    });
    
    const payments = await database.getWarehousePayments();
    const totalPayments = { akitoy: 0, makplast: 0 };
    
    payments.forEach(payment => {
      if (payment.type === 'akitoy') {
        totalPayments.akitoy += payment.amount || 0;
      } else if (payment.type === 'makplast') {
        totalPayments.makplast += payment.amount || 0;
      }
    });
    
    const currentDebt = {
      akitoy: initialDebt.akitoy + totalPurchases.akitoy - totalPayments.akitoy,
      makplast: initialDebt.makplast + totalPurchases.makplast - totalPayments.makplast
    };
    
    const products = await database.getProducts();
    const currentStockValue = { akitoy: 0, makplast: 0 };
    
    products.forEach(product => {
      if (product.type === 'akitoy') {
        currentStockValue.akitoy += (product.cost || 0) * (product.stock || 0);
      } else if (product.type === 'makplast') {
        currentStockValue.makplast += (product.cost || 0) * (product.stock || 0);
      }
    });
    
    res.json({
      success: true,
      initialDebt,
      totalPurchases,
      totalPayments,
      currentDebt,
      currentStockValue
    });
  } catch (err) {
    console.error('warehouse/debt error:', err);
    res.status(500).json({ success: false, message: 'Server error: ' + err.message });
  }
});

/**
 * GET /api/warehouse/payments
 */
router.get('/payments', verifyToken, requireRole('warehouse'), async (req, res) => {
  try {
    const payments = await database.getWarehousePayments();
    res.json({ success: true, payments });
  } catch (err) {
    console.error('warehouse/payments error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * POST /api/warehouse/receive - ИСПРАВЛЕННЫЙ (убрано явное обновление стока)
 */
router.post('/receive', verifyToken, requireRole('warehouse'), async (req, res) => {
  try {
    const { productId, productType, name, quantity, cost, date, description } = req.body;

    if (!productType || !['akitoy', 'makplast'].includes(productType)) {
      return res.status(400).json({ 
        success: false, 
        message: 'productType "akitoy" yoki "makplast" bo\'lishi kerak' 
      });
    }

    if (!quantity || !cost) {
      return res.status(400).json({ 
        success: false, 
        message: 'quantity va cost majburiy' 
      });
    }

    const qty = Number(quantity);
    const unitCost = Number(cost);

    if (!Number.isFinite(qty) || qty <= 0 || !Number.isFinite(unitCost) || unitCost <= 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'quantity va cost musbat son bo\'lishi kerak' 
      });
    }

    let product;
    let isNew = false;

    if (productId) {
      product = await database.getProductById(productId);
      if (!product) {
        return res.status(404).json({ 
          success: false, 
          message: 'Mahsulot topilmadi' 
        });
      }
      // Явное обновление стока УДАЛЕНО – остаток обновится через addWarehouseLog
    } else {
      if (!name) {
        return res.status(400).json({ 
          success: false, 
          message: 'Yangi mahsulot uchun name majburiy' 
        });
      }
      
      // Создаём новый продукт с начальным остатком 0
      product = await database.addProduct({
        name,
        type: productType,
        cost: unitCost,
        stock: 0,                             // ИСПРАВЛЕНО: теперь 0, не qty
        price: unitCost * 1.5,                 // примерная цена (можно изменить)
        article: `AUTO-${Date.now()}`
      });
      isNew = true;
    }

    // Создаём лог склада – именно он вызовет updateProductCost и увеличит остаток
    const warehouseLog = await database.addWarehouseLog({
      type: 'receive',
      productType,
      productId: product.id,
      productName: product.name,
      quantity: qty,
      cost: unitCost,
      totalCost: qty * unitCost,
      description: description || '',
      date: date || new Date().toISOString(),
      userId: req.user.id
    });

    // Логируем действие пользователя
    await database.addUserLog({
      userId: req.user.id,
      action: isNew ? 'warehouse_product_create' : 'warehouse_receive',
      details: `${isNew ? 'Yangi mahsulot qo\'shildi' : 'Omborga qabul qilindi'}: ${product.name} (${productType}), ${qty} dona, ${qty * unitCost} UZS`,
      entityId: product.id,
      entityType: 'warehouse',
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'] || '',
      timestamp: new Date().toISOString()
    });

    res.json({ 
      success: true, 
      product, 
      log: warehouseLog,
      isNew 
    });

  } catch (err) {
    console.error('warehouse/receive error:', err.message);
    res.status(500).json({ 
      success: false, 
      message: 'Server error: ' + err.message 
    });
  }
});

/**
 * POST /api/warehouse/bulk-receive - ИСПРАВЛЕННЫЙ (массовый приход, убрано явное обновление)
 */
router.post('/bulk-receive', verifyToken, requireRole('warehouse'), async (req, res) => {
  try {
    const { items, type, date } = req.body;
    
    // Для диагностики можно оставить логи
    console.log('=== BULK-RECEIVE DEBUG ===');
    console.log('Received items count:', items ? items.length : 0);
    console.log('====================');
    
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Items majburiy' });
    }

    const receiptId = generateReceiptId();
    const operations = [];
    let totalCost = 0;

    for (const item of items) {
      if (!item.productId || !item.quantity || !item.cost) {
        return res.status(400).json({ 
          success: false, 
          message: `Noto'g'ri item: ${item.productName || 'Noma\'lum'}` 
        });
      }

      const product = await database.getProductById(item.productId);
      if (!product) {
        return res.status(404).json({ 
          success: false, 
          message: `Mahsulot topilmadi: ${item.productName}` 
        });
      }

      // Явное обновление стока УДАЛЕНО – остаток обновится через addWarehouseLog

      // Создаём лог склада
      const log = await database.addWarehouseLog({
        type: 'receive',
        productType: item.productType || product.type,
        productId: item.productId,
        productName: item.productName || product.name,
        quantity: Number(item.quantity),
        cost: Number(item.cost),
        totalCost: Number(item.totalCost || (item.quantity * item.cost)),
        description: `Bulk receipt: ${receiptId}`,
        date: date || new Date().toISOString(),
        userId: req.user.id
      });
      operations.push(log);

      totalCost += Number(item.totalCost || (item.quantity * item.cost));

      // Лог пользователя
      await database.addUserLog({
        userId: req.user.id,
        action: 'warehouse_bulk_receive',
        details: `Omborga ommaviy qabul: ${item.productName}, ${item.quantity} dona, ${item.totalCost} UZS`,
        entityId: log.id,
        entityType: 'warehouse_log',
        ipAddress: getClientIp(req),
        userAgent: req.headers['user-agent'] || '',
        timestamp: new Date().toISOString()
      });
    }

    console.log(`Bulk receive muvaffaqiyatli: ${operations.length} log qo'shildi, total: ${totalCost}`);
    res.json({ success: true, receiptId, count: operations.length, totalCost });
  } catch (err) {
    console.error('warehouse/bulk-receive error:', err);
    res.status(500).json({ success: false, message: 'Server error: ' + err.message });
  }
});

module.exports = router;