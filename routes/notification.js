const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../database');

// Получить все уведомления
router.get('/', async (req, res) => {
  try {
    const notifications = await db.getNotifications();
    
    res.json({
      success: true,
      notifications: notifications.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Создать новое уведомление
router.post('/', async (req, res) => {
  try {
    const { 
      title, 
      message, 
      type = 'system', 
      priority = 'low', 
      action = null, 
      entityId = null, 
      entityType = null,
      productId = null,
      productName = null,
      amount = 0 
    } = req.body;

    const newNotification = {
      title,
      message,
      type,
      priority,
      action,
      entityId,
      entityType,
      productId,
      productName,
      amount,
      read: false,
      createdBy: req.user?.id || 'system'
    };

    const savedNotification = await db.addNotification(newNotification);

    res.json({
      success: true,
      notification: savedNotification
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Пометить уведомление как прочитанное
router.put('/:id/read', async (req, res) => {
  try {
    const updatedNotification = await db.markNotificationAsRead(req.params.id);
    
    if (!updatedNotification) {
      return res.status(404).json({ success: false, message: 'Уведомление не найдено' });
    }
    
    res.json({
      success: true,
      notification: updatedNotification
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Пометить все уведомления как прочитанные
router.put('/read-all', async (req, res) => {
  try {
    await db.markAllNotificationsAsRead(req.user?.id);
    
    res.json({
      success: true,
      message: 'Все уведомления помечены как прочитанные'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Удалить уведомление
router.delete('/:id', async (req, res) => {
  try {
    const result = await db.deleteNotification(req.params.id);
    
    if (!result) {
      return res.status(404).json({ success: false, message: 'Уведомление не найдено' });
    }
    
    res.json({
      success: true,
      message: 'Уведомление удалено'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Удалить все уведомления
router.delete('/', async (req, res) => {
  try {
    const userId = req.user?.id;
    
    if (userId) {
      await db.deleteUserNotifications(userId);
    } else {
      await db.deleteAllNotifications();
    }
    
    res.json({
      success: true,
      message: userId ? 'Уведомления пользователя удалены' : 'Все уведомления удалены'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Получить количество непрочитанных уведомлений
router.get('/unread-count', async (req, res) => {
  try {
    const unreadCount = await db.getUnreadNotificationsCount();
    
    res.json({
      success: true,
      count: unreadCount
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Создать тестовое уведомление
router.post('/test', async (req, res) => {
  try {
    const { type = 'system', title = 'Test Notification', message = 'This is a test notification' } = req.body;
    
    const testNotification = {
      title,
      message,
      type,
      priority: 'low',
      read: false,
      createdBy: req.user?.id || 'system'
    };

    const savedNotification = await db.addNotification(testNotification);

    res.json({
      success: true,
      notification: savedNotification,
      message: 'Тестовое уведомление создано'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;