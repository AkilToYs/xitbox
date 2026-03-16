const rateLimit = require('express-rate-limit');

// Лимит для входа (5 попыток за 15 минут)
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: { success: false, message: 'Ko\'p urinishlar. Iltimos, 15 daqiqadan keyin qayta urinib ko\'ring' }
});

// Лимит для смены пароля (3 попытки за 15 минут)
const changePasswordLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 3,
    message: { success: false, message: 'Ko\'p urinishlar. Iltimos, keyinroq qayta urinib ko\'ring' }
});

// Лимит для регистрации (3 попытки за час)
const registerLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 3,
    message: { success: false, message: 'Ko\'p urinishlar. Iltimos, 1 soatdan keyin qayta urinib ko\'ring' }
});

// Глобальный лимит для всех запросов (100 запросов в минуту)
const globalLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 100,
    message: { success: false, message: 'Juda ko\'p so\'rovlar. Iltimos, biroz kuting' }
});

module.exports = {
    loginLimiter,
    changePasswordLimiter,
    registerLimiter,
    globalLimiter
};