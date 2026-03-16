// app-init.js - Инициализация приложения

document.addEventListener('DOMContentLoaded', function() {
    const token = localStorage.getItem('dokon_token');
    const userData = localStorage.getItem('dokon_user');
    
    if (!token || !userData) {
        window.location.href = 'login.html';
        return;
    }
    
    // Загружаем сохраненный период
    const savedPeriod = localStorage.getItem('dokon_period');
    if (savedPeriod) {
        try {
            DokonApp.currentPeriod = JSON.parse(savedPeriod);
        } catch (e) {
            console.error('Davr ma\'lumotlarini olishda xatolik:', e);
        }
    }
    
    // Инициализируем обработчики событий
    document.getElementById('saleQuantity')?.addEventListener('input', updateSaleTotal);
    document.getElementById('salePrice')?.addEventListener('input', updateSaleTotal);
    
    document.getElementById('warehouseAkitoyQuantity')?.addEventListener('input', calculateWarehouseTotal);
    document.getElementById('warehouseAkitoyCost')?.addEventListener('input', calculateWarehouseTotal);
    document.getElementById('warehouseMakplastQuantity')?.addEventListener('input', calculateWarehouseTotal);
    document.getElementById('warehouseMakplastCost')?.addEventListener('input', calculateWarehouseTotal);
    
    document.getElementById('paymentType')?.addEventListener('change', updatePaymentDebtInfo);
    document.getElementById('invoicePaymentType')?.addEventListener('change', toggleCreditFields);
    document.getElementById('invoiceProductType')?.addEventListener('change', updateInvoiceProductList);
    document.getElementById('invoiceProduct')?.addEventListener('change', updateInvoiceProductPrice);
    
    document.getElementById('initialPayment')?.addEventListener('input', calculateCredit);
    document.getElementById('creditTerm')?.addEventListener('input', calculateCredit);
    
    document.getElementById('productImage')?.addEventListener('change', function() {
        previewImage(this);
    });
    
    document.getElementById('searchAkil')?.addEventListener('input', function() {
        searchProducts('akitoy');
    });
    
    document.getElementById('searchMakplast')?.addEventListener('input', function() {
        searchProducts('makplast');
    });
    
    document.getElementById('searchNasiya')?.addEventListener('input', searchNasiyaCustomers);
    
    // Устанавливаем сегодняшнюю дату по умолчанию
    const today = new Date().toISOString().split('T')[0];
    ['warehouseAkitoyDate', 'warehouseMakplastDate', 'saleDate', 'invoiceDate', 'paymentDate', 
     'nasiyaPaymentDate'].forEach(id => {
        const el = document.getElementById(id);
        if (el && el.type === 'date') el.value = today;
    });
    
    // Инициализация приложения
    if (window.location.pathname.includes('dokon.html') || 
        window.location.pathname === '/' || 
        window.location.pathname.endsWith('/')) {
        initializeApp();
    }
    
    // Защита от инструментов разработчика
    document.addEventListener('keydown', function(e) {
        if (
            e.keyCode === 123 ||
            (e.ctrlKey && e.shiftKey && ['I','J','C'].includes(e.key)) ||
            (e.ctrlKey && e.key === 'U')
        ) {
            e.preventDefault();
            return false;
        }
    });
});