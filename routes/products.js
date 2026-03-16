// routes/products.js - ИСПРАВЛЕННАЯ ВЕРСИЯ
const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const { verifyToken, requireRole } = require('../middleware/auth');
const { uploadSingle } = require('../middleware/upload');
const {
  getProducts,
  addProduct,
  updateProduct,
  deleteProduct,
  getProductById,
  addUserLog
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

/* ============================
   GET /api/products
============================ */
router.get('/', verifyToken, async (req, res) => {
  try {
    const products = await getProducts();
    res.json({ success: true, products });
  } catch (err) {
    console.error('GET products error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/* ============================
   GET /api/products/:id
============================ */
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const product = await getProductById(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Mahsulot topilmadi'
      });
    }

    res.json({ success: true, product });
  } catch (err) {
    console.error('GET product by id error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/* ============================
   POST /api/products
   (admin)
============================ */
router.post(
  '/',
  verifyToken,
  requireRole('admin'),
  uploadSingle,
  async (req, res) => {
    try {
      const body = req.body;

      if (!body.name) {
        return res.status(400).json({
          success: false,
          message: 'Mahsulot nomi majburiy'
        });
      }

      const imagePath = req.file
        ? `/uploads/${req.file.filename}`
        : null;

      const product = {
        name: body.name,
        article: body.article || '',
        category: body.category || '',
        type: body.type || 'akitoy',

        stock: Number(body.stock) || 0,
        cost: Number(body.cost) || 0,
        price: Number(body.price) || 0,

        description: body.description || '',
        minStock: Number(body.minStock) || 5,
        image: imagePath
      };

      const saved = await addProduct(product);

      // Логируем создание товара
      await addUserLog({
        userId: req.user.id,
        action: 'product_create',
        details: `Yangi mahsulot: ${saved.name} (${saved.type}), Art: ${saved.article}, Narx: ${saved.price} UZS`,
        entityId: saved.id,
        entityType: 'product',
        ipAddress: getClientIp(req),
        userAgent: req.headers['user-agent'] || ''
      });

      res.json({ 
        success: true, 
        product: saved,
        message: 'Mahsulot muvaffaqiyatli qo\'shildi'
      });
    } catch (err) {
      console.error('POST product error:', err);
      res.status(500).json({ 
        success: false, 
        message: 'Server error' 
      });
    }
  }
);

/* ============================
   PUT /api/products/:id
   (admin)
============================ */
router.put(
  '/:id',
  verifyToken,
  requireRole('admin'),
  uploadSingle,
  async (req, res) => {
    try {
      const productId = req.params.id;
      const body = req.body;

      // Получаем текущий продукт для логирования
      const oldProduct = await getProductById(productId);
      
      if (!oldProduct) {
        return res.status(404).json({
          success: false,
          message: 'Mahsulot topilmadi'
        });
      }

      const updateData = {
        name: body.name ?? oldProduct.name,
        article: body.article ?? oldProduct.article,
        category: body.category ?? oldProduct.category,
        type: body.type ?? oldProduct.type,

        stock: body.stock !== undefined ? Number(body.stock) : oldProduct.stock,
        cost: body.cost !== undefined ? Number(body.cost) : oldProduct.cost,
        price: body.price !== undefined ? Number(body.price) : oldProduct.price,

        description: body.description ?? oldProduct.description,
        minStock: body.minStock !== undefined ? Number(body.minStock) : oldProduct.minStock
      };

      // Если есть новая картинка
      if (req.file) {
        updateData.image = `/uploads/${req.file.filename}`;
      }

      const updated = await updateProduct(productId, updateData); // ← здесь переменная называется updated

      // Логируем обновление товара
      const changes = [];
      if (oldProduct.name !== updated.name) changes.push(`Nomi: ${oldProduct.name} -> ${updated.name}`);
      if (oldProduct.stock !== updated.stock) changes.push(`Ombordagi: ${oldProduct.stock} -> ${updated.stock}`);
      if (oldProduct.cost !== updated.cost) changes.push(`Narxi: ${oldProduct.cost} -> ${updated.cost}`);
      if (oldProduct.price !== updated.price) changes.push(`Sotuv narxi: ${oldProduct.price} -> ${updated.price}`);
      if (oldProduct.type !== updated.type) changes.push(`Turi: ${oldProduct.type} -> ${updated.type}`);

      await addUserLog({
        userId: req.user.id,
        action: 'product_update',
        details: `Mahsulot yangilandi: ${oldProduct.name}. O'zgarishlar: ${changes.join(', ') || 'Hech narsa'}`,
        entityId: productId,
        entityType: 'product',
        ipAddress: getClientIp(req),
        userAgent: req.headers['user-agent'] || ''
      });

      res.json({ 
        success: true, 
        product: updated,
        message: 'Mahsulot muvaffaqiyatli yangilandi'
      });
    } catch (err) {
      console.error('PUT product error:', err);
      res.status(500).json({
        success: false,
        message: err.message || 'Server error'
      });
    }
  }
);

/* ============================
   DELETE /api/products/:id
   (admin)
============================ */
router.delete(
  '/:id',
  verifyToken,
  requireRole('admin'),
  async (req, res) => {
    try {
      const product = await getProductById(req.params.id);
      
      if (!product) {
        return res.status(404).json({
          success: false,
          message: 'Mahsulot topilmadi'
        });
      }

      // Логируем удаление товара
      await addUserLog({
        userId: req.user.id,
        action: 'product_delete',
        details: `Mahsulot o'chirildi: ${product.name} (${product.type}), Art: ${product.article}, Qoldiq: ${product.stock} dona`,
        entityId: product.id,
        entityType: 'product',
        ipAddress: getClientIp(req),
        userAgent: req.headers['user-agent'] || ''
      });

      await deleteProduct(req.params.id);
      
      res.json({ 
        success: true,
        message: 'Mahsulot muvaffaqiyatli o\'chirildi'
      });
    } catch (err) {
      console.error('DELETE product error:', err);
      res.status(500).json({
        success: false,
        message: err.message || 'Server error'
      });
    }
  }
);

module.exports = router;