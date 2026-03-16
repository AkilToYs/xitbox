// routes/sales.js - ИСПРАВЛЕННАЯ ВЕРСИЯ
const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');

const { verifyToken, requireRole } = require('../middleware/auth');
const { 
    addSale, 
    getSales, 
    getProductById, 
    addUserLog,
    updateProductStock,
    addWarehouseLog,
    deleteSale,
    refundSale,
    getProducts   // добавлено, так как используется в /refund
} = require('../database');

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

/**
 * POST /api/sales/refund
 * Возврат товара
 */
router.post('/refund', verifyToken, requireRole('admin'), async (req, res) => {
    try {
        const { productId, quantity, price, cost, date, saleId, description } = req.body;

        // Валидация
        if (!productId || !quantity || quantity <= 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'productId и положительное quantity обязательны' 
            });
        }

        // Получаем продукт
        const product = await getProductById(productId);
        if (!product) {
            return res.status(404).json({ 
                success: false, 
                message: 'Продукт не найден' 
            });
        }

        // Простая проверка, что можно вернуть не больше, чем продано
        const allSales = await getSales();
        const totalSold = allSales
            .filter(s => s.productId === productId && s.quantity > 0)
            .reduce((sum, s) => sum + s.quantity, 0);
        const totalReturned = allSales
            .filter(s => s.productId === productId && s.quantity < 0)
            .reduce((sum, s) => sum + Math.abs(s.quantity), 0);
        const availableForReturn = totalSold - totalReturned;

        if (quantity > availableForReturn) {
            return res.status(400).json({
                success: false,
                message: `Нельзя вернуть больше, чем продано. Продано: ${totalSold}, возвращено: ${totalReturned}, доступно: ${availableForReturn}`
            });
        }

        // Используем переданные цены или берём из продукта
        const refundPrice = price || product.price;
        const refundCost = cost || product.cost;

        const refundData = {
            productId,
            productName: product.name,
            productArticle: product.article,
            productType: product.type,
            quantity,
            price: refundPrice,
            cost: refundCost,
            date: date || new Date().toISOString(),
            userId: req.user.id,
            saleId,
            description: description || ''
        };

        // ИСПРАВЛЕНО: используем импортированную функцию refundSale, не database.refundSale
        const refund = await refundSale(refundData);

        // Логируем действие
        await addUserLog({
            userId: req.user.id,
            action: 'refund_create',
            details: `Возврат товара: ${product.name}, ${quantity} шт., сумма ${quantity * refundPrice} UZS`,
            entityId: refund.id,
            entityType: 'refund',
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || '',
            timestamp: new Date().toISOString()
        });

        // Обновляем данные для клиента
        const updatedProducts = await getProducts();
        const updatedSales = await getSales();

        res.json({
            success: true,
            refund,
            products: updatedProducts,
            sales: updatedSales
        });

    } catch (err) {
        console.error('POST /sales/refund error:', err);
        res.status(500).json({ 
            success: false, 
            message: 'Server error: ' + err.message 
        });
    }
});

// Остальные маршруты (POST /, GET /, GET /profit, GET /fix-types, GET /check-product-types, GET /today, DELETE /:id)
// остаются без изменений (как в вашем исходном файле)

/**
 * POST /api/sales
 * Создать продажу
 */
router.post('/', verifyToken, requireRole('seller'), async (req, res) => {
    try {
        const body = req.body || {};
        
        if (!body.productId || !body.quantity || !body.price) {
            return res.status(400).json({ 
                success: false, 
                message: 'productId, quantity va price kerak' 
            });
        }
        
        const product = await getProductById(body.productId);
        if (!product) {
            return res.status(404).json({ 
                success: false, 
                message: 'Mahsulot topilmadi' 
            });
        }
        const isSuperAdmin = req.user.role === 'superadmin';
        if (!isSuperAdmin && (product.stock || 0) < body.quantity) {
            return res.status(400).json({ 
                success: false, 
                message: `Yetarli stock yo'q. Omborda: ${product.stock || 0} dona` 
            });
        }

        const cost = product.cost || 0;
        const price = Number(body.price);
        const quantity = Number(body.quantity);
        const total = price * quantity;
        const profit = (price - cost) * quantity;
        
        const sale = {
            productId: body.productId,
            productName: product.name,
            productArticle: product.article,
            productType: product.type || 'akitoy',
            type: product.type || 'akitoy',
            quantity: quantity,
            price: price,
            cost: cost,
            total: total,
            profit: profit,
            date: body.date || new Date().toISOString(),
            userId: req.user.id
        };
        
        const savedSale = await addSale(sale);
        
        await addUserLog({
            userId: req.user.id,
            action: 'sale_create',
            details: `Sotuv yaratildi: ${product.name} (${product.type}), ${quantity} dona, ${total} UZS`,
            entityId: savedSale.id,
            entityType: 'sale',
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });
        
        res.json({ 
            success: true, 
            sale: savedSale,
            message: `Sotuv yaratildi: ${product.name} (${product.type})`
        });
    } catch (err) {
        console.error('POST /sales error:', err);
        res.status(500).json({ 
            success: false, 
            message: 'Server error: ' + err.message 
        });
    }
});

/**
 * GET /api/sales
 * Получить список продаж с фильтрацией
 */
router.get('/', verifyToken, requireRole('seller'), async (req, res) => {
    try {
        const { month, year, type, limit = 10000 } = req.query;
        
        const sales = await getSales();
        
        let filteredSales = sales || [];
        
        if (type && ['akitoy', 'makplast'].includes(type)) {
            filteredSales = filteredSales.filter(sale => 
                sale.type === type || sale.productType === type
            );
        }
        
        if (month !== undefined && year !== undefined) {
            const filterMonth = parseInt(month);
            const filterYear = parseInt(year);
            
            filteredSales = filteredSales.filter(sale => {
                if (!sale.date) return false;
                const saleDate = new Date(sale.date);
                return saleDate.getMonth() === filterMonth && 
                       saleDate.getFullYear() === filterYear;
            });
        }
        
        filteredSales.sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt));
        
        
        
        filteredSales = filteredSales.map(sale => {
            if (!sale.productType && sale.type) {
                sale.productType = sale.type;
            }
            return sale;
        });
        
        const totalRevenue = filteredSales.reduce((sum, sale) => sum + (sale.total || 0), 0);
        const totalProfit = filteredSales.reduce((sum, sale) => sum + (sale.profit || 0), 0);
        const totalQuantity = filteredSales.reduce((sum, sale) => sum + (sale.quantity || 0), 0);
        
        const byType = filteredSales.reduce((acc, sale) => {
            const type = sale.productType || sale.type || 'unknown';
            if (!acc[type]) {
                acc[type] = {
                    revenue: 0,
                    profit: 0,
                    quantity: 0,
                    count: 0
                };
            }
            acc[type].revenue += sale.total || 0;
            acc[type].profit += sale.profit || 0;
            acc[type].quantity += sale.quantity || 0;
            acc[type].count += 1;
            return acc;
        }, {});
        
        res.json({
            success: true,
            sales: filteredSales,
            stats: {
                totalRevenue,
                totalProfit,
                totalQuantity,
                count: filteredSales.length
            },
            byType
        });
    } catch (err) {
        console.error('GET /sales error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

/**
 * GET /api/sales/profit
 * Получить данные по прибыли
 */
router.get('/profit', verifyToken, requireRole('seller'), async (req, res) => {
    try {
        const { month, year } = req.query;
        
        if (!month || !year) {
            return res.status(400).json({
                success: false,
                message: 'month va year kerak'
            });
        }
        
        const filterMonth = parseInt(month);
        const filterYear = parseInt(year);
        
        const sales = await getSales();
        
        const filteredSales = (sales || []).filter(sale => {
            if (!sale.date) return false;
            const saleDate = new Date(sale.date);
            return saleDate.getMonth() === filterMonth && 
                   saleDate.getFullYear() === filterYear;
        });
        
        filteredSales.forEach(sale => {
            if (!sale.productType && sale.type) {
                sale.productType = sale.type;
            }
        });
        
        const byType = filteredSales.reduce((acc, sale) => {
            const type = sale.productType || sale.type || 'unknown';
            if (!acc[type]) {
                acc[type] = {
                    revenue: 0,
                    profit: 0,
                    cost: 0,
                    quantity: 0,
                    count: 0
                };
            }
            acc[type].revenue += sale.total || 0;
            acc[type].profit += sale.profit || 0;
            acc[type].cost += (sale.cost || 0) * (sale.quantity || 0);
            acc[type].quantity += sale.quantity || 0;
            acc[type].count += 1;
            return acc;
        }, {});
        
        const totalRevenue = filteredSales.reduce((sum, sale) => sum + (sale.total || 0), 0);
        const totalProfit = filteredSales.reduce((sum, sale) => sum + (sale.profit || 0), 0);
        const totalCost = filteredSales.reduce((sum, sale) => sum + ((sale.cost || 0) * (sale.quantity || 0)), 0);
        
        res.json({
            success: true,
            totalRevenue,
            totalProfit,
            totalCost,
            byType,
            sales: filteredSales,
            count: filteredSales.length
        });
    } catch (err) {
        console.error('GET /sales/profit error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

/**
 * GET /api/sales/fix-types
 * Исправить типы в существующих продажах
 * (одноразовый эндпоинт для миграции)
 */
router.get('/fix-types', verifyToken, requireRole('admin'), async (req, res) => {
    try {
        // Для MongoDB эта операция не нужна
        res.json({
            success: true,
            message: 'В MongoDB типы продаж автоматически синхронизируются с продуктами',
            fixed: 0,
            errors: 0
        });
    } catch (err) {
        console.error('GET /sales/fix-types error:', err);
        res.status(500).json({ 
            success: false, 
            message: 'Server error: ' + err.message 
        });
    }
});

/**
 * GET /api/sales/check-product-types
 * Проверить типы продуктов в продажах
 */
router.get('/check-product-types', verifyToken, requireRole('admin'), async (req, res) => {
    try {
        res.json({
            success: true,
            summary: {
                message: 'В MongoDB типы продаж всегда соответствуют типам продуктов',
                totalSales: 'auto-synced',
                mismatched: 0
            }
        });
    } catch (err) {
        console.error('GET /sales/check-product-types error:', err);
        res.status(500).json({ 
            success: false, 
            message: 'Server error: ' + err.message 
        });
    }
});

/**
 * GET /api/sales/today
 * Получить продажи за сегодня
 */
router.get('/today', verifyToken, requireRole('seller'), async (req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        const sales = await getSales();
        
        const todaySales = sales.filter(sale => {
            const saleDate = new Date(sale.date || sale.createdAt);
            return saleDate >= today && saleDate < tomorrow;
        });
        
        const totalRevenue = todaySales.reduce((sum, sale) => sum + (sale.total || 0), 0);
        const totalProfit = todaySales.reduce((sum, sale) => sum + (sale.profit || 0), 0);
        const totalQuantity = todaySales.reduce((sum, sale) => sum + (sale.quantity || 0), 0);
        
        res.json({
            success: true,
            sales: todaySales,
            stats: {
                totalRevenue,
                totalProfit,
                totalQuantity,
                count: todaySales.length
            },
            date: today.toISOString()
        });
    } catch (err) {
        console.error('GET /sales/today error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

/**
 * DELETE /api/sales/:id
 * Удалить продажу (только админ)
 */
router.delete('/:id', verifyToken, requireRole('admin'), async (req, res) => {
    try {
        const result = await deleteSale(req.params.id);
        
        if (!result) {
            return res.status(404).json({
                success: false,
                message: 'Sotuv topilmadi'
            });
        }
        
        await addUserLog({
            userId: req.user.id,
            action: 'sale_delete',
            details: `Sotuv o'chirildi: ID = ${req.params.id}`,
            entityId: req.params.id,
            entityType: 'sale',
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });
        
        res.json({
            success: true,
            message: 'Sotuv muvaffaqiyatli o\'chirildi'
        });
    } catch (err) {
        console.error('DELETE /sales/:id error:', err);
        res.status(500).json({ 
            success: false, 
            message: 'Server error' 
        });
    }
});

module.exports = router;