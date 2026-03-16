const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../database');

// Foydalanuvchi IP manzilini olish funktsiyasi
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

async function logUserAction(req, logData) {
  try {
    await db.addUserLog({
      userId: req.user?.id || 'system',
      action: logData.action,
      details: logData.details || '',
      entityId: logData.entityId || null,
      entityType: logData.entityType || null,
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'] || '',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error logging user action:', error);
  }
}

// Функция createNotification:
async function createNotification(notificationData) {
  try {
    await db.addNotification({
      title: notificationData.title,
      message: notificationData.message,
      type: notificationData.type || 'system',
      priority: notificationData.priority || 'low',
      action: notificationData.action || null,
      entityId: notificationData.entityId || null,
      entityType: notificationData.entityType || null,
      productId: notificationData.productId || null,
      productName: notificationData.productName || null,
      amount: notificationData.amount || 0,
      read: false,
      createdBy: notificationData.createdBy || 'system'
    });
  } catch (error) {
    console.error('Error creating notification:', error);
  }
}

// Barcha nasiya mijozlarini olish
router.get('/clients', async (req, res) => {
  try {
    const { search } = req.query;
    
    const clients = await db.getNasiyaClients(search);
    
    // НЕ РАССЧИТЫВАЕМ АВТОМАТИЧЕСКИ - используем только ручные даты из базы
    await logUserAction(req, {
      action: 'nasiya_clients_view',
      details: 'Barcha nasiya mijozlarini ko\'rish',
      entityType: 'nasiya_client'
    });
    
    res.json({
      success: true,
      clients: clients
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Yangi nasiya mijozini yaratish
router.post('/clients', async (req, res) => {
  try {
    const { name, phone, address, description } = req.body;
    
    const newClient = {
      name,
      phone,
      address: address || '',
      description: description || '',
      totalDebt: 0,
      paidAmount: 0,
      remainingDebt: 0,
      status: 'active',
      nextPaymentDate: null, // Начальное значение - нет следующей даты
      nextPaymentAmount: 0
    };
    
    const savedClient = await db.addNasiyaClient(newClient);
    
    // Harakatni log qilish
    await logUserAction(req, {
      action: 'nasiya_client_create',
      details: `Yangi nasiya mijoz yaratildi: ${name}, telefon: ${phone}`,
      entityId: savedClient.id || savedClient._id,
      entityType: 'nasiya_client'
    });
    
    // Yangi mijoz haqida xabarnoma yaratish
    await createNotification({
      title: 'Yangi nasiya mijoz',
      message: `Yangi nasiya mijoz qo'shildi: ${name}. Telefon: ${phone}`,
      type: 'nasiya',
      priority: 'medium',
      entityId: savedClient.id || savedClient._id,
      entityType: 'nasiya_client'
    });
    
    res.json({
      success: true,
      client: savedClient
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Mijozni yangilash
router.put('/clients/:id', async (req, res) => {
  try {
    const { name, phone, address, description, status, nextPaymentDate, nextPaymentAmount } = req.body;
    
    const updateData = {
      name,
      phone,
      address,
      description,
      status,
      updatedAt: new Date().toISOString()
    };
    
    // Обновляем следующую дату платежа если предоставлена
    if (nextPaymentDate !== undefined) {
      updateData.nextPaymentDate = nextPaymentDate;
    }
    
    if (nextPaymentAmount !== undefined) {
      updateData.nextPaymentAmount = nextPaymentAmount;
    }
    
    const updatedClient = await db.updateNasiyaClient(req.params.id, updateData);
    
    if (!updatedClient) {
      return res.status(404).json({ success: false, message: 'Mijoz topilmadi' });
    }
    
    // Harakatni log qilish
    await logUserAction(req, {
      action: 'nasiya_client_update',
      details: `Nasiya mijoz yangilandi: ${updatedClient.name}`,
      entityId: req.params.id,
      entityType: 'nasiya_client'
    });
    
    res.json({
      success: true,
      client: updatedClient
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Mijozni o'chirish (va uning barcha ma'lumotlarini)
router.delete('/clients/:id', async (req, res) => {
  try {
    await db.deleteNasiyaClient(req.params.id);
    
    // Логируем
    await logUserAction(req, {
      action: 'nasiya_client_delete',
      details: `Nasiya mijoz o'chirildi: ID = ${req.params.id}`,
      entityId: req.params.id,
      entityType: 'nasiya_client'
    });
    
    res.json({
      success: true,
      message: 'Mijoz va uning barcha ma\'lumotlari o\'chirildi'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Barcha nasiya sotishlarini olish
router.get('/sales', async (req, res) => {
  try {
    const sales = await db.getNasiyaSales();
    
    // Harakatni log qilish
    await logUserAction(req, {
      action: 'nasiya_sales_view',
      details: 'Barcha nasiya sotishlarini ko\'rish',
      entityType: 'nasiya_sale'
    });
    
    res.json({
      success: true,
      sales
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Nasiya sotishini yaratish (С ИЗМЕНЕНИЯМИ ДЛЯ РУЧНОГО УПРАВЛЕНИЯ)
router.post('/sales', async (req, res) => {
  try {
    const { clientId, items, totalAmount, payments, description, status, nextPaymentDate, nextPaymentAmount } = req.body;
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
    const newSale = {
      clientId,
      items: items || [],
      totalAmount,
      paidAmount: 0,
      remainingDebt: totalAmount,
      payments: payments || [], // Сохраняем график платежей
      status: status || 'pending',
      description: description || '',
      nextPaymentDate: nextPaymentDate || null, // Ручная дата следующего платежа
      nextPaymentAmount: nextPaymentAmount || 0, // Ручная сумма следующего платежа
      createdBy: req.user?.id || 'system'
    };
    
    const savedSale = await db.addNasiyaSale(newSale);
    
    // Mijozni yangilash
    const client = await db.getNasiyaClientById(clientId);
    if (client) {
      await db.updateNasiyaClient(clientId, {
        totalDebt: (client.totalDebt || 0) + totalAmount,
        remainingDebt: (client.remainingDebt || 0) + totalAmount,
        nextPaymentDate: nextPaymentDate || null, // Обновляем следующую дату у клиента
        nextPaymentAmount: nextPaymentAmount || 0,
        updatedAt: new Date().toISOString()
      });
    }
    
    // Harakatni log qilish
    await logUserAction(req, {
      action: 'nasiya_sale_create',
      details: `Yangi nasiya sotish yaratildi: Miqdor - ${totalAmount}, Mijoz - ${client?.name || clientId}`,
      entityId: savedSale.id || savedSale._id,
      entityType: 'nasiya_sale'
    });
    
    // Yangi sotish haqida xabarnoma yaratish
    await createNotification({
      title: 'Yangi nasiya sotish',
      message: `Yangi nasiya sotish yaratildi. Miqdor: ${totalAmount} so'm, Mijoz: ${client?.name || clientId}`,
      type: 'nasiya',
      priority: 'high',
      entityId: savedSale.id || savedSale._id,
      entityType: 'nasiya_sale'
    });
    
    res.json({
      success: true,
      sale: savedSale
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Barcha nasiya to'lovlarini olish
router.get('/payments', async (req, res) => {
  try {
    const payments = await db.getNasiyaPayments();
    
    // Harakatni log qilish
    await logUserAction(req, {
      action: 'nasiya_payments_view',
      details: 'Barcha nasiya to\'lovlarini ko\'rish',
      entityType: 'nasiya_payment'
    });
    
    res.json({
      success: true,
      payments
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Nasiya to'lovini kiritish (С ИЗМЕНЕНИЯМИ ДЛЯ РУЧНОГО УПРАВЛЕНИЯ)
router.post('/payments', async (req, res) => {
  try {
    const { clientId, saleId, amount, paymentDate, paymentMethod, description, nextPaymentDate, nextPaymentAmount } = req.body;
    
    const newPayment = {
      clientId,
      saleId,
      amount,
      paymentDate,
      paymentMethod: paymentMethod || 'cash',
      description: description || '',
      createdBy: req.user?.id || 'system'
    };
    
    const savedPayment = await db.addNasiyaPayment(newPayment);
    
    // Sotishni yangilash
    const sale = await db.getNasiyaSaleById(saleId);
    if (sale) {
      const updatedPaidAmount = (sale.paidAmount || 0) + amount;
      const updatedRemainingDebt = (sale.remainingDebt || 0) - amount;
      
      const updateData = {
        paidAmount: updatedPaidAmount,
        remainingDebt: updatedRemainingDebt,
        status: updatedRemainingDebt <= 0 ? 'completed' : 'pending'
      };
      
      // Если указана следующая дата платежа - обновляем
      if (nextPaymentDate !== undefined) {
        updateData.nextPaymentDate = nextPaymentDate;
        updateData.nextPaymentAmount = nextPaymentAmount || 0;
      } else if (updatedRemainingDebt <= 0) {
        // Если долг погашен - очищаем следующую дату
        updateData.nextPaymentDate = null;
        updateData.nextPaymentAmount = 0;
      }
      
      await db.updateNasiyaSale(saleId, updateData);
    }
    
    // Mijozni yangilash
    const client = await db.getNasiyaClientById(clientId);
    if (client) {
      const updateClientData = {
        paidAmount: (client.paidAmount || 0) + amount,
        remainingDebt: (client.remainingDebt || 0) - amount,
        updatedAt: new Date().toISOString()
      };
      
      // Если указана следующая дата - обновляем у клиента
      if (nextPaymentDate !== undefined) {
        updateClientData.nextPaymentDate = nextPaymentDate;
        updateClientData.nextPaymentAmount = nextPaymentAmount || 0;
      } else if (updateClientData.remainingDebt <= 0) {
        // Если долг погашен - очищаем
        updateClientData.nextPaymentDate = null;
        updateClientData.nextPaymentAmount = 0;
      }
      
      await db.updateNasiyaClient(clientId, updateClientData);
    }
    
    // Harakatni log qilish
    await logUserAction(req, {
      action: 'nasiya_payment_create',
      details: `Yangi nasiya to\'lov kiritildi: Miqdor - ${amount}, Mijoz - ${client?.name || clientId}`,
      entityId: savedPayment.id || savedPayment._id,
      entityType: 'nasiya_payment'
    });
    
    // To'lov haqida xabarnoma yaratish
    await createNotification({
      title: 'Yangi nasiya to\'lov',
      message: `Yangi nasiya to\'lov kiritildi. Miqdor: ${amount} so'm, Mijoz: ${client?.name || clientId}`,
      type: 'nasiya',
      priority: 'medium',
      entityId: savedPayment.id || savedPayment._id,
      entityType: 'nasiya_payment'
    });
    
    res.json({
      success: true,
      payment: savedPayment
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Eslatmalarni olish
router.get('/reminders', async (req, res) => {
  try {
    const reminders = await db.getUpcomingNasiyaReminders();
    
    // Harakatni log qilish
    await logUserAction(req, {
      action: 'nasiya_reminders_view',
      details: 'Kelajakdagi to\'lov eslatmalarini ko\'rish',
      entityType: 'nasiya_reminder'
    });
    
    res.json({
      success: true,
      reminders
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Eslatma yaratish
router.post('/reminders', async (req, res) => {
  try {
    const { clientId, saleId, reminderDate, amount, description } = req.body;
    
    const newReminder = {
      clientId,
      saleId,
      reminderDate,
      amount,
      description: description || '',
      completed: false,
      sent: false,
      createdBy: req.user?.id || 'system'
    };
    
    const savedReminder = await db.addNasiyaReminder(newReminder);
    
    // Harakatni log qilish
    const client = await db.getNasiyaClientById(clientId);
    await logUserAction(req, {
      action: 'nasiya_reminder_create',
      details: `Yangi to\'lov eslatmasi yaratildi: Sana - ${reminderDate}, Miqdor - ${amount}, Mijoz - ${client?.name || clientId}`,
      entityId: savedReminder.id || savedReminder._id,
      entityType: 'nasiya_reminder'
    });
    
    res.json({
      success: true,
      reminder: savedReminder
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Mijoz tafsilotlarini olish
router.get('/clients/:id', async (req, res) => {
  try {
    const client = await db.getNasiyaClientById(req.params.id);
    
    if (!client) {
      return res.status(404).json({ success: false, message: 'Mijoz topilmadi' });
    }
    
    // Mijoz sotishlari
    const clientSales = await db.getNasiyaSalesByClientId(req.params.id);
    
    // Mijoz to'lovlari
    const clientPayments = await db.getNasiyaPaymentsByClientId(req.params.id);
    
    // Mijoz eslatmalari
    const clientReminders = await db.getNasiyaRemindersByClientId(req.params.id);
    
    // Harakatni log qilish
    await logUserAction(req, {
      action: 'nasiya_client_details_view',
      details: `Mijoz tafsilotlarini ko'rish: ${client.name}`,
      entityId: req.params.id,
      entityType: 'nasiya_client'
    });
    
    res.json({
      success: true,
      client,
      sales: clientSales,
      payments: clientPayments,
      reminders: clientReminders
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Mijoz sotishlarini olish
router.get('/clients/:id/sales', async (req, res) => {
  try {
    const clientSales = await db.getNasiyaSalesByClientId(req.params.id);
    
    // Harakatni log qilish
    await logUserAction(req, {
      action: 'nasiya_client_sales_view',
      details: 'Mijoz sotishlarini ko\'rish',
      entityId: req.params.id,
      entityType: 'nasiya_client'
    });
    
    res.json({
      success: true,
      sales: clientSales
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Mijoz to'lovlarini olish
router.get('/clients/:id/payments', async (req, res) => {
  try {
    const clientPayments = await db.getNasiyaPaymentsByClientId(req.params.id);
    
    // Harakatni log qilish
    await logUserAction(req, {
      action: 'nasiya_client_payments_view',
      details: 'Mijoz to\'lovlarini ko\'rish',
      entityId: req.params.id,
      entityType: 'nasiya_client'
    });
    
    res.json({
      success: true,
      payments: clientPayments
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Mavjud sotishga mahsulot qo'shish
router.post('/sales/:id/add-item', async (req, res) => {
  try {
    const { productId, productName, quantity, price } = req.body;
    
    const sale = await db.getNasiyaSaleById(req.params.id);
    if (!sale) {
      return res.status(404).json({ success: false, message: 'Sotish topilmadi' });
    }
    
    const newItem = {
      productId,
      productName,
      quantity,
      price,
      total: quantity * price
    };
    
    const updatedItems = [...(sale.items || []), newItem];
    const updatedTotal = updatedItems.reduce((sum, item) => sum + (item.total || 0), 0);
    
    const updatedSale = await db.updateNasiyaSale(req.params.id, {
      items: updatedItems,
      totalAmount: updatedTotal,
      remainingDebt: updatedTotal - (sale.paidAmount || 0)
    });
    
    // Mijozni yangilash
    const client = await db.getNasiyaClientById(sale.clientId);
    if (client) {
      await db.updateNasiyaClient(sale.clientId, {
        totalDebt: (client.totalDebt || 0) + newItem.total,
        remainingDebt: (client.remainingDebt || 0) + newItem.total,
        updatedAt: new Date().toISOString()
      });
    }
    
    // Harakatni log qilish
    await logUserAction(req, {
      action: 'nasiya_sale_add_item',
      details: `Sotishga yangi mahsulot qo'shildi: ${productName}, Miqdor: ${quantity}, Narx: ${price}`,
      entityId: req.params.id,
      entityType: 'nasiya_sale'
    });
    
    res.json({
      success: true,
      sale: updatedSale
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Eslatma statusini belgilash
router.put('/reminders/:id/complete', async (req, res) => {
  try {
    const updatedReminder = await db.updateNasiyaReminder(req.params.id, {
      completed: true,
      completedAt: new Date().toISOString()
    });
    
    if (!updatedReminder) {
      return res.status(404).json({ success: false, message: 'Eslatma topilmadi' });
    }
    
    // Harakatni log qilish
    await logUserAction(req, {
      action: 'nasiya_reminder_complete',
      details: `To'lov eslatmasi bajarildi deb belgilandi: ${updatedReminder.description}`,
      entityId: req.params.id,
      entityType: 'nasiya_reminder'
    });
    
    res.json({
      success: true,
      reminder: updatedReminder
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Eslatma yuborish
router.post('/reminders/:id/send', async (req, res) => {
  try {
    const reminderId = req.params.id;
    const reminder = await db.getNasiyaReminderById(reminderId);
    
    if (!reminder) {
      return res.status(404).json({ success: false, message: 'Eslatma topilmadi' });
    }

    const client = await db.getNasiyaClientById(reminder.clientId);
    if (!client) {
      return res.status(404).json({ success: false, message: 'Mijoz topilmadi' });
    }

    // Bu yerda SMS yuborish logikasi bo'lishi kerak
    // Misol uchun: await sendSmsToClient(client.phone, reminder);
    
    // Eslatmani yuborilgan deb belgilash
    const updatedReminder = await db.updateNasiyaReminder(reminderId, {
      sent: true,
      sentAt: new Date().toISOString(),
      sentBy: req.user?.id || 'system'
    });

    // Harakatni log qilish
    await logUserAction(req, {
      action: 'nasiya_reminder_send',
      details: `To'lov eslatmasi yuborildi: ${client.name}, Telefon: ${client.phone}`,
      entityId: reminderId,
      entityType: 'nasiya_reminder'
    });

    // Xabarnoma yaratish
    await createNotification({
      title: 'Eslatma yuborildi',
      message: `To'lov eslatmasi yuborildi: ${client.name}, Telefon: ${client.phone}`,
      type: 'nasiya_reminder',
      priority: 'medium',
      entityId: reminderId,
      entityType: 'nasiya_reminder'
    });

    res.json({
      success: true,
      message: 'Eslatma mijozga yuborildi',
      reminder: updatedReminder
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Получить следующую дату платежа для клиента
router.get('/clients/:id/next-payment', async (req, res) => {
  try {
    const client = await db.getNasiyaClientById(req.params.id);
    
    if (!client) {
      return res.status(404).json({ success: false, message: 'Mijoz topilmadi' });
    }
    
    // Просто возвращаем дату из базы данных (установленную вручную)
    res.json({
      success: true,
      nextPaymentDate: client.nextPaymentDate || null,
      nextPaymentAmount: client.nextPaymentAmount || 0
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Получить одно напоминание по ID
router.get('/reminders/:id', async (req, res) => {
  try {
    const reminderId = req.params.id;
    
    // Получаем все напоминания и находим нужное
    const reminders = await db.getNasiyaReminders();
    const reminder = reminders.find(r => 
      r.id === reminderId || 
      (r._id && r._id.toString() === reminderId)
    );
    
    if (!reminder) {
      return res.status(404).json({ 
        success: false, 
        message: 'Eslatma topilmadi' 
      });
    }
    
    // Получаем информацию о клиенте
    const client = await db.getNasiyaClientById(reminder.clientId);
    
    // Логируем
    await logUserAction(req, {
      action: 'nasiya_reminder_view',
      details: `To'lov eslatmasi ko'rish: ${reminder.description || 'Noma\'lum'}`,
      entityId: reminderId,
      entityType: 'nasiya_reminder'
    });
    
    res.json({
      success: true,
      reminder: {
        ...reminder,
        clientName: client?.name || 'Noma\'lum mijoz',
        clientPhone: client?.phone || ''
      }
    });
  } catch (error) {
    console.error('GET /reminders/:id error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

// Удалить напоминание
router.delete('/reminders/:id', async (req, res) => {
  try {
    const reminderId = req.params.id;
    
    // Получаем напоминание перед удалением (для логирования)
    const reminders = await db.getNasiyaReminders();
    const reminder = reminders.find(r => 
      r.id === reminderId || 
      (r._id && r._id.toString() === reminderId)
    );
    
    if (!reminder) {
      return res.status(404).json({ 
        success: false, 
        message: 'Eslatma topilmadi' 
      });
    }
    
    // Получаем информацию о клиенте
    const client = await db.getNasiyaClientById(reminder.clientId);
    
    // Удаляем напоминание
    const result = await db.deleteNasiyaReminderById(reminderId);
    
    if (!result) {
      // Если нет специальной функции для удаления, удалим через обновление коллекции
      const database = await db.getDatabaseData();
      const updatedReminders = database.nasiyaReminders.filter(r => 
        r.id !== reminderId && 
        (!r._id || r._id.toString() !== reminderId)
      );
      
      // Сохраняем обновленные данные
      await db.writeDB({
        ...database,
        nasiyaReminders: updatedReminders
      });
    }
    
    // Логируем удаление
    await logUserAction(req, {
      action: 'nasiya_reminder_delete',
      details: `To'lov eslatmasi o'chirildi: ${reminder.description || 'Noma\'lum'}, Mijoz: ${client?.name || 'Noma\'lum'}`,
      entityId: reminderId,
      entityType: 'nasiya_reminder'
    });
    
    // Создаем уведомление
    await createNotification({
      title: 'Eslatma o\'chirildi',
      message: `To'lov eslatmasi o'chirildi: ${reminder.description || 'Noma\'lum'}, Mijoz: ${client?.name || 'Noma\'lum'}`,
      type: 'nasiya_reminder',
      priority: 'medium',
      entityId: reminderId,
      entityType: 'nasiya_reminder'
    });
    
    res.json({
      success: true,
      message: 'Eslatma muvaffaqiyatli o\'chirildi'
    });
  } catch (error) {
    console.error('DELETE /reminders/:id error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

// Пометить все напоминания как отправленные
router.post('/reminders/mark-all-sent', async (req, res) => {
  try {
    // Получаем все непомеченные напоминания
    const reminders = await db.getNasiyaReminders();
    const unmarkedReminders = reminders.filter(r => !r.sent || r.sent === false);
    
    let markedCount = 0;
    
    // Помечаем каждое напоминание как отправленное
    for (const reminder of unmarkedReminders) {
      const updatedReminder = await db.updateNasiyaReminder(
        reminder.id || reminder._id, 
        {
          sent: true,
          sentAt: new Date().toISOString(),
          sentBy: req.user?.id || 'system',
          updatedAt: new Date().toISOString()
        }
      );
      
      if (updatedReminder) {
        markedCount++;
      }
    }
    
    // Логируем действие
    await logUserAction(req, {
      action: 'nasiya_reminders_mark_all_sent',
      details: `Barcha eslatmalar yuborilgan deb belgilandi. ${markedCount} ta eslatma yangilandi.`,
      entityType: 'nasiya_reminder'
    });
    
    // Создаем уведомление
    await createNotification({
      title: 'Barcha eslatmalar yuborildi',
      message: `${markedCount} ta eslatma yuborilgan deb belgilandi.`,
      type: 'nasiya_reminder',
      priority: 'medium',
      entityType: 'nasiya_reminder'
    });
    
    res.json({
      success: true,
      message: `${markedCount} ta eslatma yuborilgan deb belgilandi`,
      count: markedCount,
      total: unmarkedReminders.length
    });
  } catch (error) {
    console.error('POST /reminders/mark-all-sent error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

// Обновить продажу (для ручного управления датами)
router.put('/sales/:id', async (req, res) => {
  try {
    const { nextPaymentDate, nextPaymentAmount, status } = req.body;
    
    const updateData = {};
    
    if (nextPaymentDate !== undefined) {
      updateData.nextPaymentDate = nextPaymentDate;
    }
    
    if (nextPaymentAmount !== undefined) {
      updateData.nextPaymentAmount = nextPaymentAmount;
    }
    
    if (status !== undefined) {
      updateData.status = status;
    }
    
    const updatedSale = await db.updateNasiyaSale(req.params.id, updateData);
    
    if (!updatedSale) {
      return res.status(404).json({ success: false, message: 'Sotish topilmadi' });
    }
    
    // Если обновляем следующую дату платежа, обновляем и у клиента
    if (nextPaymentDate !== undefined) {
      const client = await db.getNasiyaClientById(updatedSale.clientId);
      if (client) {
        await db.updateNasiyaClient(updatedSale.clientId, {
          nextPaymentDate: nextPaymentDate,
          nextPaymentAmount: nextPaymentAmount || 0,
          updatedAt: new Date().toISOString()
        });
      }
    }
    
    res.json({
      success: true,
      sale: updatedSale
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Test uchun to'lov eslatmasi yaratish
router.post('/test-reminder', async (req, res) => {
  try {
    const { clientId, saleId, reminderDate, amount, description } = req.body;
    
    // Test uchun eslatma yaratish
    const testReminder = {
      clientId: clientId || 'test-mijoz-id',
      saleId: saleId || 'test-sotish-id',
      reminderDate: reminderDate || new Date().toISOString().split('T')[0],
      amount: amount || 100000,
      description: description || 'To\'lovni eslatish uchun test',
      completed: false,
      sent: false,
      createdBy: req.user?.id || 'system'
    };
    
    const savedReminder = await db.addNasiyaReminder(testReminder);
    
    // Test xabarnomasi yaratish
    await createNotification({
      title: 'To\'lov eslatmasi (test)',
      message: `To'lov eslatmasi yaratildi (test). Miqdor: ${amount || 100000} so'm, Sana: ${reminderDate || 'bugun'}`,
      type: 'nasiya_reminder',
      priority: 'high',
      entityId: savedReminder.id || savedReminder._id,
      entityType: 'nasiya_reminder'
    });
    
    // Harakatni log qilish
    await logUserAction(req, {
      action: 'test_reminder_created',
      details: 'Test uchun to\'lov eslatmasi yaratildi',
      entityId: savedReminder.id || savedReminder._id,
      entityType: 'nasiya_reminder'
    });
    
    res.json({
      success: true,
      reminder: savedReminder,
      message: 'Test eslatmasi yaratildi'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;