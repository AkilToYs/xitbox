// Dokonapp.js - полная версия со всеми исправлениями и адаптивными таблицами (добавлены data-label)
const API_URL = window.location.origin;
const API_BASE = API_URL + '/api';

const DokonApp = {
    currentUser: null,
    products: [],
    sales: [],
    warehouseLogs: [],
    users: [],
    userLogs: [],
    currentPeriod: { month: new Date().getMonth(), year: new Date().getFullYear() },
    warehousePayments: [],
    warehouseData: {
        totalPurchases: 0,
        totalPayments: 0,
        currentDebt: 0,
        currentStockValue: 0
    }
};
let bulkWarehouseItems = [];
let currentBulkType = 'akitoy'; // всегда 'akitoy'
let nasiyaCart = [];
let nasiyaSearchTerm = '';

// Основные API функции
async function apiFetch(endpoint, options = {}) {
    const token = localStorage.getItem('dokon_token');
    const headers = options.headers || {};
    const csrfToken = localStorage.getItem('csrfToken');
    if (csrfToken && !['GET', 'HEAD'].includes(options.method || 'GET')) {
        headers['X-CSRF-Token'] = csrfToken;
    }
    if (!(options.body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
    }
    
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    
    if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
        options.body = JSON.stringify(options.body);
    }
    
    try {
        const response = await fetch(`${API_BASE}${endpoint}`, {
            ...options,
            headers
        });
        
        if (response.status === 401) {
            localStorage.removeItem('dokon_token');
            localStorage.removeItem('dokon_user');
            window.location.href = 'login.html';
            return null;
        }
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.message || `HTTP ${response.status}`);
        }
        
        return data;
    } catch (error) {
        console.error(`API Error (${endpoint}):`, error);
        showServerError('Server xatosi', error.message);
        throw error;
    }
}

// Инициализация приложения
async function initializeApp() {
    console.log('Инициализация приложения...');
    
    const token = localStorage.getItem('dokon_token');
    const userData = localStorage.getItem('dokon_user');
    if (!token || !userData) {
        window.location.href = 'login.html';
        return;
    }
    
    try {
        DokonApp.currentUser = JSON.parse(userData);
        
        await apiFetch('/auth/verify');
        
        // Сбрасываем графики
        if (window.salesChart) {
            window.salesChart.destroy();
            window.salesChart = null;
        }
        
        if (window.profitAndDebtChart) {
            window.profitAndDebtChart.destroy();
            window.profitAndDebtChart = null;
        }
        
        // Загружаем все необходимые данные
        await Promise.all([
            loadProducts(),
            loadSales(),
            loadWarehouseLogs(),
            loadUsers(),
            loadWarehouseDebt(),
            loadWarehousePayments(),
            loadUserLogs(),
            loadNotifications(),
            loadNasiyaData()
        ]);

        // Инициализация дополнительных компонентов
        setupNasiyaClientAutocomplete();
        setupNasiyaProductAutocomplete();
        destroyAllCharts();
        updateUI();
        setupInvoiceProductAutocomplete();
        renderAllTables();
        updateStatistics();
        updatePeriodDisplay();
        renderUserLogsTable();
        updateWarehouseDebtDisplay();
        updateBrandStats('akitoy');
        updateNotificationUI();
        initializeNotifications();

        // Обработчики переключения вкладок
        document.querySelectorAll('a[data-bs-toggle="tab"]').forEach(tab => {
            tab.addEventListener('shown.bs.tab', function(event) {
                const targetId = event.target.getAttribute('href');
                
                if (targetId === '#nasiya') {
                    resetNasiyaSearch();
                    updateNasiyaStatistics();
                    renderNasiyaClientsTable();
                    renderNasiyaRemindersTable();
                }
                
                if (targetId === '#refund') {
                    if (typeof initRefundTab === 'function') {
                        initRefundTab();
                    }
                }

                if (targetId === '#bulk-warehouse') {
                    if (typeof changeBulkWarehouseType === 'function') {
                        if (!currentBulkType) currentBulkType = 'akitoy';
                        changeBulkWarehouseType(currentBulkType);
                    }
                }

                if (targetId === '#warehouse') {
                    if (typeof initWarehouseAutocomplete === 'function') {
                        initWarehouseAutocomplete('warehouseAkitoyProductSearch', 'warehouseAkitoyProductId', 'warehouseAkitoySuggestions', 'akitoy');
                    }
                }

                if (targetId === '#invoice') {
                    if (typeof setupInvoiceProductAutocomplete === 'function') {
                        setupInvoiceProductAutocomplete();
                    }
                    if (document.querySelectorAll('#invoiceItemsBody tr').length === 0) {
                        addInvoiceRow();
                    }
                }
            });
        });

        // Устанавливаем сегодняшнюю дату для полей
        const today = new Date().toISOString().split('T')[0];
        const dateFields = [
            'warehouseAkitoyDate', 'saleDate', 'invoiceDate', 'paymentDate', 
            'refundDate', 'bulkWarehouseDate'
        ];
        dateFields.forEach(id => {
            const el = document.getElementById(id);
            if (el && !el.value) el.value = today;
        });

        const nasiyaDate = document.getElementById('nasiyaPaymentDate');
        if (nasiyaDate && !nasiyaDate.value) {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            nasiyaDate.value = tomorrow.toISOString().split('T')[0];
        }

        if (document.querySelector('#refund.active')) {
            if (typeof initRefundTab === 'function') initRefundTab();
        }

        console.log('Приложение успешно инициализировано');
    } catch (error) {
        console.error('Ошибка загрузки данных:', error);
        showError('Ошибка загрузки данных: ' + error.message);
    }
}

// Функции загрузки данных
async function loadProducts() {
    try {
        const data = await apiFetch('/products');
        if (data.success) {
            DokonApp.products = data.products || [];
        }
    } catch (error) {
        console.error('Ошибка загрузки продуктов:', error);
        DokonApp.products = [];
    }
}

async function loadSales() {
    try {
        const data = await apiFetch('/sales');
        if (data.success) {
            DokonApp.sales = data.sales || [];
        }
    } catch (error) {
        console.error('Ошибка загрузки продаж:', error);
        DokonApp.sales = [];
    }
}

async function loadWarehouseLogs() {
    try {
        const data = await apiFetch('/warehouse/logs');
        if (data.success) {
            DokonApp.warehouseLogs = data.logs || [];
        }
    } catch (error) {
        console.error('Ошибка загрузки логов склада:', error);
        DokonApp.warehouseLogs = [];
    }
}

async function loadUsers() {
    try {
        if (!DokonApp.currentUser || !['admin', 'superadmin'].includes(DokonApp.currentUser.role)) {
            DokonApp.users = [];
            return;
        }
        
        const data = await apiFetch('/users');
        if (data.success) {
            DokonApp.users = data.users || [];
        }
    } catch (error) {
        console.error('Ошибка загрузки пользователей:', error);
        DokonApp.users = [];
    }
}

async function loadWarehouseDebt() {
    try {
        const data = await apiFetch('/warehouse/debt');
        if (data.success) {
            // Предполагаем, что сервер вернул только данные для akitoy
            DokonApp.warehouseData = {
                totalPurchases: data.totalPurchases?.akitoy || 0,
                totalPayments: data.totalPayments?.akitoy || 0,
                currentDebt: data.currentDebt?.akitoy || 0,
                currentStockValue: data.currentStockValue?.akitoy || 0
            };
        }
    } catch (error) {
        console.error('Ошибка загрузки долга склада:', error);
    }
}

async function loadWarehousePayments() {
    try {
        const data = await apiFetch('/warehouse/payments');
        if (data.success) {
            DokonApp.warehousePayments = data.payments || [];
        }
    } catch (error) {
        console.error('Ошибка загрузки выплат:', error);
        DokonApp.warehousePayments = [];
    }
}

async function loadUserLogs() {
    try {
        if (!DokonApp.currentUser || !['admin', 'superadmin'].includes(DokonApp.currentUser.role)) {
            DokonApp.userLogs = [];
            return;
        }
        
        const data = await apiFetch('/users/logs?limit=100000');
        if (data && data.success) {
            DokonApp.userLogs = data.logs || [];
            updateUserLogsFilter();
        } else {
            DokonApp.userLogs = [];
        }
    } catch (error) {
        console.error('Ошибка загрузки логов пользователей:', error);
        DokonApp.userLogs = [];
    }
}

// Обновление UI
function updateUI() {
    const userNameElement = document.getElementById('userName');
    const userRoleBadge = document.getElementById('userRoleBadge');
    
    if (DokonApp.currentUser) {
        if (userNameElement) {
            userNameElement.textContent = DokonApp.currentUser.fullName || DokonApp.currentUser.username;
        }
        
        if (userRoleBadge) {
            const roleText = getRoleText(DokonApp.currentUser.role);
            const roleClass = getRoleClass(DokonApp.currentUser.role);
            userRoleBadge.textContent = roleText;
            userRoleBadge.className = `role-badge ${roleClass}`;
        }
        
        updateUIByRole(DokonApp.currentUser.role);
    }
}

function updateWarehouseDebtDisplay() {
    const akitoyDebt = DokonApp.warehouseData.currentDebt || 0;
    
    const akDebtEl = document.getElementById('akitoyCurrentDebt');
    
    if (akDebtEl) {
        akDebtEl.textContent = akitoyDebt.toLocaleString('uz-UZ') + ' UZS';
        akDebtEl.className = akitoyDebt > 0 ? 'fw-bold text-danger' : 'fw-bold text-success';
    }
}

// Функции для продуктов
async function saveProduct() {
    const id = document.getElementById('editProductId')?.value || '';
    const type = 'akitoy'; // всегда akitoy
    const name = document.getElementById('productName')?.value?.trim() || '';
    const article = document.getElementById('productArticle')?.value?.trim() || '';
    const cost = Number(document.getElementById('productCost')?.value || 0);
    const price = Number(document.getElementById('productPrice')?.value || 0);
    const stock = Number(document.getElementById('productStock')?.value || 0);
    const category = document.getElementById('productCategory')?.value?.trim() || '';
    const description = document.getElementById('productDescription')?.value?.trim() || '';
    const minStock = Number(document.getElementById('productMinStock')?.value || 5);
    const imageFile = document.getElementById('productImage')?.files[0];
    
    if (!name) {
        showError('Mahsulot nomini kiriting');
        return;
    }
    
    const formData = new FormData();
    formData.append('name', name);
    formData.append('article', article);
    formData.append('cost', cost);
    formData.append('price', price);
    formData.append('stock', stock);
    formData.append('category', category);
    formData.append('description', description);
    formData.append('minStock', minStock);
    formData.append('type', type);
    
    if (imageFile) {
        formData.append('image', imageFile);
    }
    
    try {
        if (id) {
            await apiFetch(`/products/${id}`, {
                method: 'PUT',
                body: formData
            });
            showSuccess('Mahsulot yangilandi');
        } else {
            await apiFetch('/products', {
                method: 'POST',
                body: formData
            });
            showSuccess('Mahsulot yaratildi');
        }
        
        await loadProducts();
        renderAllTables();
        updateStatistics();
        updateBrandStats('akitoy');
        
        bootstrap.Modal.getInstance(document.getElementById('productModal')).hide();
    } catch (error) {
        showError('Saqlashda xatolik: ' + error.message);
    }
}

async function deleteProduct(type, id) {
    if (!confirm('Mahsulotni o\'chirishni tasdiqlaysizmi?')) return;
    
    try {
        await apiFetch(`/products/${id}`, {
            method: 'DELETE'
        });
        
        showSuccess('Mahsulot o\'chirildi');
        await loadProducts();
        renderAllTables();
        updateStatistics();
        updateBrandStats('akitoy');
    } catch (error) {
        showError('O\'chirishda xatolik: ' + error.message);
    }
}

// Функции для продаж
function showSaleModal(type, id) {
    const product = DokonApp.products.find(p => p.id === id);
    if (!product) return;
    
    document.getElementById('saleProductId').value = id;
    document.getElementById('saleProductType').value = type;
    document.getElementById('saleProductCost').value = product.cost || 0;
    document.getElementById('saleProductName').value = product.name || '';
    document.getElementById('salePrice').value = product.price || 0;
    document.getElementById('saleQuantity').value = 1;
    document.getElementById('saleDate').value = new Date().toISOString().split('T')[0];
    
    updateSaleTotal();
    new bootstrap.Modal(document.getElementById('saleModal')).show();
}

let _saleProcessing = false;

async function confirmSaleAction() {
    if (_saleProcessing) return;
    _saleProcessing = true;

    const modalEl = document.getElementById('saleModal');
    const confirmBtn = modalEl ? modalEl.querySelector('.btn-success') : null;
    if (confirmBtn) confirmBtn.disabled = true;

    try {
        const productId = document.getElementById('saleProductId').value;
        const type = document.getElementById('saleProductType').value;
        const quantity = Number(document.getElementById('saleQuantity').value || 0);
        const price = Number(document.getElementById('salePrice').value || 0);
        const date = document.getElementById('saleDate').value;
        const cost = Number(document.getElementById('saleProductCost').value || 0);

        if (!productId || !quantity || !price) {
            showError('Barcha maydonlarni to\'ldiring');
            return;
        }

        const product = DokonApp.products.find(p => p.id === productId);
        if (!product) {
            showError('Mahsulot topilmadi');
            return;
        }

        if ((product.stock || 0) - quantity < 0) {
            showError('Omborda yetarli mahsulot yo\'q');
            return;
        }

        const saleData = {
            productId,
            productName: product.name,
            productType: product.type || type,
            quantity,
            price,
            cost: product.cost || cost,
            date,
            total: quantity * price,
            profit: (price - (product.cost || cost)) * quantity
        };

        const saleResp = await apiFetch('/sales', {
            method: 'POST',
            body: saleData
        });
        console.log('Sale response:', saleResp);
        if (!saleResp || !saleResp.success) {
            throw new Error((saleResp && saleResp.message) ? saleResp.message : 'Sale creation failed');
        }

        showSuccess('Sotish muvaffaqiyatli amalga oshirildi');

        await Promise.all([
            loadProducts(),
            loadSales(),
            loadWarehouseDebt()
        ]);

        renderAllTables();
        updateStatistics();
        updateBrandStats('akitoy');
        updateWarehouseDebtDisplay();

        if (modalEl) {
            const modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
            const onHidden = () => {
                modalEl.removeEventListener('hidden.bs.modal', onHidden);
                if (confirmBtn) confirmBtn.disabled = false;
                _saleProcessing = false;
            };
            modalEl.addEventListener('hidden.bs.modal', onHidden, { once: true });
            modal.hide();
        } else {
            if (confirmBtn) confirmBtn.disabled = false;
            _saleProcessing = false;
        }
    } catch (error) {
        console.error('Sotishda xatolik:', error);
        showError('Sotishda xatolik: ' + (error.message || error));
        if (confirmBtn) confirmBtn.disabled = false;
        _saleProcessing = false;
    }
}

function updateSaleTotal() {
    const quantity = Number(document.getElementById('saleQuantity').value || 0);
    const price = Number(document.getElementById('salePrice').value || 0);
    const cost = Number(document.getElementById('saleProductCost').value || 0);
    const total = quantity * price;
    const profit = (price - cost) * quantity;
    
    document.getElementById('saleTotal').textContent = total.toLocaleString('uz-UZ') + ' UZS';
    document.getElementById('profitAmount').textContent = profit.toLocaleString('uz-UZ') + ' UZS';
    
    const profitContainer = document.getElementById('profitCalculation');
    profitContainer.classList.toggle('d-none', profit <= 0);
}

function calculateWarehouseTotal() {
    const aQty = Number(document.getElementById('warehouseAkitoyQuantity')?.value || 0);
    const aCost = Number(document.getElementById('warehouseAkitoyCost')?.value || 0);
    const aTotalEl = document.getElementById('akitoyWarehouseTotal');
    
    if (aTotalEl) {
        aTotalEl.textContent = (aQty * aCost).toLocaleString('uz-UZ') + ' UZS';
    }
}

// Функция поиска клиентов nasiya
function searchNasiyaClients() {
    nasiyaSearchTerm = document.getElementById('nasiyaSearchInput').value.toLowerCase();
    renderNasiyaClientsTable();
}

// Функция удаления клиента nasiya
async function deleteNasiyaClient(clientId) {
    if (!confirm('Mijozni o\'chirishni tasdiqlaysizmi? Bu amalni qaytarib bo\'lmaydi.')) {
        return;
    }

    try {
        await apiFetch(`/nasiya/clients/${clientId}`, {
            method: 'DELETE'
        });

        showSuccess('Mijoz o\'chirildi');
        
        createNotification(
            'Nasiya mijoz o\'chirildi',
            'Mijoz va uning barcha ma\'lumotlari o\'chirildi',
            'nasiya',
            'medium',
            'goto_nasiya',
            clientId
        );
        
        await loadNasiyaData();
        
    } catch (error) {
        showError('Mijozni o\'chirishda xatolik: ' + error.message);
    }
}

function renderNasiyaClientsTable() {
    const container = document.getElementById('nasiyaClientsTable');
    if (!container) return;
    
    let clients = DokonApp.nasiyaData.clients;

    if (nasiyaSearchTerm) {
        clients = clients.filter(client => 
            client.name.toLowerCase().includes(nasiyaSearchTerm) ||
            (client.phone && client.phone.toLowerCase().includes(nasiyaSearchTerm)) ||
            (client.address && client.address.toLowerCase().includes(nasiyaSearchTerm))
        );
    }

    clients.sort((a, b) => {
        if (a.remainingDebt <= 0 && b.remainingDebt > 0) return 1;
        if (a.remainingDebt > 0 && b.remainingDebt <= 0) return -1;
        if (!a.nextPaymentDate && b.nextPaymentDate) return 1;
        if (a.nextPaymentDate && !b.nextPaymentDate) return -1;
        if (a.nextPaymentDate && b.nextPaymentDate) {
            const dateA = new Date(a.nextPaymentDate);
            const dateB = new Date(b.nextPaymentDate);
            return dateA - dateB;
        }
        return 0;
    });

    if (clients.length === 0) {
        container.innerHTML = `
            <tr>
                <td colspan="10" class="text-center py-4 text-muted">
                    <i class="fas fa-users fa-2x mb-3 d-block"></i>
                    ${nasiyaSearchTerm ? 'Qidiruv bo\'yicha mijoz topilmadi' : 'Hozircha mijozlar yo\'q'}
                </td>
            </tr>
        `;
        return;
    }

    const rows = clients.map((client, index) => {
        const clientSales = DokonApp.nasiyaData.sales.filter(s => s.clientId === client.id);
        const productsCount = clientSales.reduce((count, sale) => count + (sale.items?.length || 0), 0);
        
        const lastPayment = DokonApp.nasiyaData.payments
            .filter(p => p.clientId === client.id)
            .sort((a, b) => new Date(b.paymentDate) - new Date(a.paymentDate))[0];
        
        const lastPaymentDate = lastPayment ? new Date(lastPayment.paymentDate).toLocaleDateString('uz-UZ') : 'Yo\'q';
        
        return `
            <tr ${client.remainingDebt > 0 && client.nextPaymentDate ? `class="${getPaymentRowClass(client.nextPaymentDate, client.remainingDebt)}"` : ''}>
                <td data-label="#">${index + 1}</td>
                <td data-label="Mijoz">
                    <strong>${escapeHtml(client.name)}</strong>
                    ${client.phone ? `<br><small class="text-muted">${escapeHtml(client.phone)}</small>` : ''}
                    ${productsCount > 0 ? `<br><small class="text-info">${productsCount} ta mahsulot</small>` : ''}
                </td>
                <td data-label="Telefon">${escapeHtml(client.phone || '-')}</td>
                <td data-label="Jami qarz" class="text-danger fw-bold">${(client.totalDebt || 0).toLocaleString('uz-UZ')} UZS</td>
                <td data-label="To'langan" class="text-success">${(client.paidAmount || 0).toLocaleString('uz-UZ')} UZS</td>
                <td data-label="Qoldiq">
                    <span class="badge ${client.remainingDebt > 0 ? 'bg-danger' : 'bg-success'}">
                        ${(client.remainingDebt || 0).toLocaleString('uz-UZ')} UZS
                    </span>
                </td>
                <td data-label="Holati">
                    <span class="badge ${client.status === 'active' ? 'bg-success' : 'bg-danger'}">
                        ${client.status === 'active' ? 'Faol' : 'Nofaol'}
                    </span>
                </td>
                <td data-label="Oxirgi to'lov">${lastPaymentDate}</td>
                <td data-label="Harakatlar">
                    <button class="btn btn-sm btn-info me-1 mb-1" onclick="showNasiyaClientDetails('${client.id}')" title="Mahsulotlar tarixi bilan ko'rish">
                        <i class="fas fa-history"></i>
                    </button>
                    <button class="btn btn-sm btn-success me-1 mb-1" onclick="showNasiyaPaymentModal('${client.id}')">
                        <i class="fas fa-money-bill-wave"></i>
                    </button>
                    <button class="btn btn-sm btn-warning me-1 mb-1" onclick="showCreateNasiyaSaleModalForClient('${client.id}')">
                        <i class="fas fa-plus"></i>
                    </button>
                    <button class="btn btn-sm btn-danger mb-1" onclick="deleteNasiyaClient('${client.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
    
    container.innerHTML = rows;
}

function resetNasiyaSearch() {
    nasiyaSearchTerm = '';
    const searchInput = document.getElementById('nasiyaSearchInput');
    if (searchInput) searchInput.value = '';
    renderNasiyaClientsTable();
}

// Функция добавления на склад (только Akil Box)
async function addToWarehouse(type) {
    const hiddenId = 'warehouseAkitoyProductId';
    const quantityId = 'warehouseAkitoyQuantity';
    const costId = 'warehouseAkitoyCost';
    const dateId = 'warehouseAkitoyDate';
    
    const productId = document.getElementById(hiddenId).value;
    const quantity = Number(document.getElementById(quantityId).value || 0);
    const cost = Number(document.getElementById(costId).value || 0);
    const date = document.getElementById(dateId).value || new Date().toISOString().split('T')[0];

    if (!productId) {
        showError('Iltimos, mahsulotni tanlang!');
        return;
    }

    if (!quantity || quantity <= 0) {
        showError('Miqdorni to\'g\'ri kiriting!');
        return;
    }

    if (!cost || cost <= 0) {
        showError('Xarajat narxini kiriting!');
        return;
    }

    const product = DokonApp.products.find(p => p.id === productId);
    if (!product) {
        showError('Mahsulot topilmadi!');
        return;
    }

    try {
        const warehouseData = {
            productId,
            productType: type,
            productName: product?.name || '',
            quantity,
            cost,
            totalCost: quantity * cost,
            date,
            description: ''
        };

        await apiFetch('/warehouse/receive', {
            method: 'POST',
            body: warehouseData
        });

        showSuccess('Mahsulot omborga qabul qilindi');

        await Promise.all([
            loadProducts(),
            loadWarehouseLogs(),
            loadWarehouseDebt()
        ]);

        renderAllTables();
        updateStatistics();
        updateBrandStats(type);
        updateWarehouseDebtDisplay();

        document.getElementById(hiddenId).value = '';
        document.getElementById(quantityId).value = '1';
        document.getElementById(costId).value = '';
        const searchId = 'warehouseAkitoyProductSearch';
        if (document.getElementById(searchId)) {
            document.getElementById(searchId).value = '';
        }
        calculateWarehouseTotal();

    } catch (error) {
        showError('Ombor operatsiyasida xatolik: ' + error.message);
    }
}

// Функции для платежей (только Akil Box)
async function addWarehousePayment() {
    const type = document.getElementById('paymentType').value;
    const amount = parseFloat(document.getElementById('paymentAmount').value);
    const date = document.getElementById('paymentDate').value;
    const description = document.getElementById('paymentDescription').value.trim();
    
    if (!amount || amount <= 0) {
        showError('To\'g\'ri miqdorni kiriting');
        return;
    }
    
    try {
        const paymentData = {
            type,
            amount,
            date,
            description
        };
        
        const response = await apiFetch('/warehouse/payment', {
            method: 'POST',
            body: paymentData
        });
        
        if (response.success) {
            showSuccess('To\'lov qo\'shildi');
            
            await apiFetch('/users/logs', {
                method: 'POST',
                body: {
                    action: 'payment_create',
                    details: `Akil Box uchun to'lov: ${amount} UZS`,
                    entityId: response.payment.id,
                    entityType: 'payment'
                }
            });
            
            await loadWarehouseDebt();
            await loadWarehousePayments();
            await loadUserLogs();
            
            updateWarehouseDebtDisplay();
            updateBrandStats('akitoy');
            renderUserLogsTable();
            
            const modal = bootstrap.Modal.getInstance(document.getElementById('paymentModal'));
            modal.hide();
        }
    } catch (error) {
        showError('To\'lov qo\'shishda xatolik: ' + error.message);
    }
}

// Функции для пользователей
async function saveUser() {
    const id = document.getElementById('editUserId')?.value || '';
    const username = document.getElementById('userUsername').value.trim();
    const fullName = document.getElementById('userFullName').value.trim();
    const password = document.getElementById('userPassword').value;
    const roleNum = parseInt(document.getElementById('userRole').value);
    const email = document.getElementById('userEmail').value || '';
    const phone = document.getElementById('userPhone').value || '';
    const status = document.getElementById('userStatus').value || 'active';
    
    if (!username || !fullName) {
        showError('Foydalanuvchi nomi va to\'liq ismini kiriting');
        return;
    }
    
    const roleMap = {
        1: 'seller',
        2: 'warehouse',
        3: 'admin',
        4: 'superadmin'
    };
    
    const userData = {
        username,
        fullName,
        role: roleMap[roleNum] || 'seller',
        email,
        phone,
        status
    };
    
    if (password) {
        userData.password = password;
    }
    
    try {
        if (id) {
            await apiFetch(`/users/${id}`, {
                method: 'PUT',
                body: userData
            });
            showSuccess('Foydalanuvchi yangilandi');
        } else {
            await apiFetch('/users', {
                method: 'POST',
                body: userData
            });
            showSuccess('Foydalanuvchi yaratildi');
        }
        
        await loadUsers();
        renderUsersTable();
        
        bootstrap.Modal.getInstance(document.getElementById('userModal')).hide();
    } catch (error) {
        showError('Foydalanuvchini saqlashda xatolik: ' + error.message);
    }
}

async function deleteUser(id) {
    if (!confirm('Foydalanuvchini o\'chirishni tasdiqlaysizmi?')) return;
    
    try {
        await apiFetch(`/users/${id}`, {
            method: 'DELETE'
        });
        
        showSuccess('Foydalanuvchi o\'chirildi');
        await loadUsers();
        renderUsersTable();
    } catch (error) {
        showError('O\'chirishda xatolik: ' + error.message);
    }
}

// ==================== INVOICE DINAMIK JADVAL ====================
let invoiceType = 'akitoy';

function changeInvoiceType(type) {
    invoiceType = type;
    document.getElementById('invoiceItemsBody').innerHTML = '';
    addInvoiceRow();
    updateInvoiceTotal();
}

function addInvoiceRow() {
    const tbody = document.getElementById('invoiceItemsBody');
    const rowId = 'inv_row_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

    const rowHtml = `
        <tr id="${rowId}">
            <td>
                <div class="position-relative">
                    <input type="text"
                           class="form-control invoice-product-search"
                           placeholder="Mahsulot nomini yozing..."
                           autocomplete="off"
                           data-row="${rowId}"
                           data-type="${invoiceType}">
                    <input type="hidden" class="invoice-product-id" data-row="${rowId}" value="">
                    <div class="autocomplete-suggestions"
                         style="display: none; position: absolute; width: 100%; z-index: 1000; background: white; border: 1px solid #ddd; max-height: 200px; overflow-y: auto;"
                         data-row="${rowId}"></div>
                </div>
            </td>
            <td>
                <input type="number" class="form-control invoice-quantity" min="1" value="1" data-row="${rowId}">
            </td>
            <td>
                <input type="number" class="form-control invoice-price" min="0" step="1000" value="0" data-row="${rowId}">
            </td>
            <td class="invoice-row-total" data-row="${rowId}">0 UZS</td>
            <td>
                <button class="btn btn-sm btn-danger" onclick="removeInvoiceRow('${rowId}')">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `;
    tbody.insertAdjacentHTML('beforeend', rowHtml);
    attachInvoiceRowEvents(rowId);
}

function attachInvoiceRowEvents(rowId) {
    const row = document.getElementById(rowId);
    if (!row) return;

    const searchInput = row.querySelector('.invoice-product-search');
    const suggestionsDiv = row.querySelector('.autocomplete-suggestions');
    const hiddenId = row.querySelector('.invoice-product-id');
    const quantityInput = row.querySelector('.invoice-quantity');
    const priceInput = row.querySelector('.invoice-price');

    let selectedIndex = -1;
    let currentItems = [];

    function highlightItem(index) {
        const items = suggestionsDiv.querySelectorAll('.suggestion-item');
        items.forEach((item, i) => {
            if (i === index) item.classList.add('selected');
            else item.classList.remove('selected');
        });
    }

    function closeSuggestions() {
        suggestionsDiv.style.display = 'none';
        selectedIndex = -1;
    }

    searchInput.addEventListener('input', function () {
        const query = this.value.trim().toLowerCase();
        const type = this.dataset.type;
        const products = DokonApp.products.filter(p => p.type === type);

        if (query.length < 1) {
            closeSuggestions();
            return;
        }

        const matches = products.filter(p =>
            p.name.toLowerCase().includes(query) ||
            (p.article && p.article.toLowerCase().includes(query))
        ).slice(0, 10);

        if (matches.length === 0) {
            closeSuggestions();
            return;
        }

        currentItems = matches;

        suggestionsDiv.innerHTML = matches.map(p =>
            `<div class="suggestion-item p-2 border-bottom" data-id="${p.id}" data-name="${p.name}" data-price="${p.price || 0}">
                ${p.name} (${p.article || 'artikulsiz'}) – ${(p.stock || 0)} dona
            </div>`
        ).join('');

        suggestionsDiv.style.display = 'block';
        selectedIndex = -1;
    });

    searchInput.addEventListener('keydown', function (e) {
        if (suggestionsDiv.style.display !== 'block') return;

        const items = suggestionsDiv.querySelectorAll('.suggestion-item');
        if (items.length === 0) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            selectedIndex = (selectedIndex + 1) % items.length;
            highlightItem(selectedIndex);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            selectedIndex = (selectedIndex - 1 + items.length) % items.length;
            highlightItem(selectedIndex);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (selectedIndex >= 0) {
                const selected = items[selectedIndex];
                hiddenId.value = selected.dataset.id;
                searchInput.value = selected.dataset.name;
                priceInput.value = selected.dataset.price;
                closeSuggestions();
                updateInvoiceRowTotal(rowId);
            }
        } else if (e.key === 'Tab') {
            closeSuggestions();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            closeSuggestions();
        }
    });

    document.addEventListener('click', function (e) {
        if (!searchInput.contains(e.target) && !suggestionsDiv.contains(e.target)) {
            closeSuggestions();
        }
    });

    suggestionsDiv.addEventListener('click', function (e) {
        const target = e.target.closest('.suggestion-item');
        if (!target) return;
        hiddenId.value = target.dataset.id;
        searchInput.value = target.dataset.name;
        priceInput.value = target.dataset.price;
        closeSuggestions();
        updateInvoiceRowTotal(rowId);
    });

    quantityInput.addEventListener('input', () => updateInvoiceRowTotal(rowId));
    priceInput.addEventListener('input', () => updateInvoiceRowTotal(rowId));

    const inputs = [searchInput, quantityInput, priceInput];
    inputs.forEach((input, colIndex) => {
        input.addEventListener('keydown', function (e) {
            if (input === searchInput && suggestionsDiv.style.display === 'block') return;

            const key = e.key;
            const isArrow = key.startsWith('Arrow');
            if (!isArrow && key !== 'Enter' && key !== 'Tab') return;

            e.preventDefault();

            if (key === 'ArrowLeft' && colIndex > 0) {
                inputs[colIndex - 1].focus();
            } else if (key === 'ArrowRight' && colIndex < 2) {
                inputs[colIndex + 1].focus();
            } else if (key === 'ArrowUp') {
                const prevRow = row.previousElementSibling;
                if (prevRow && prevRow.id && prevRow.id.startsWith('inv_row_')) {
                    const prevInput = prevRow.querySelectorAll('.invoice-product-search, .invoice-quantity, .invoice-price')[colIndex];
                    if (prevInput) prevInput.focus();
                }
            } else if (key === 'ArrowDown') {
                const nextRow = row.nextElementSibling;
                if (nextRow && nextRow.id && nextRow.id.startsWith('inv_row_')) {
                    const nextInput = nextRow.querySelectorAll('.invoice-product-search, .invoice-quantity, .invoice-price')[colIndex];
                    if (nextInput) nextInput.focus();
                } else {
                    addInvoiceRow();
                    const newRow = document.querySelector('#invoiceItemsBody tr:last-child');
                    if (newRow) {
                        const newInput = newRow.querySelectorAll('.invoice-product-search, .invoice-quantity, .invoice-price')[colIndex];
                        if (newInput) newInput.focus();
                    }
                }
            } else if (key === 'Enter') {
                if (colIndex < 2) {
                    inputs[colIndex + 1].focus();
                } else {
                    const nextRow = row.nextElementSibling;
                    if (nextRow && nextRow.id && nextRow.id.startsWith('inv_row_')) {
                        const firstInput = nextRow.querySelector('.invoice-product-search');
                        if (firstInput) firstInput.focus();
                    } else {
                        addInvoiceRow();
                        const newRow = document.querySelector('#invoiceItemsBody tr:last-child');
                        if (newRow) {
                            const firstInput = newRow.querySelector('.invoice-product-search');
                            if (firstInput) firstInput.focus();
                        }
                    }
                }
            } else if (key === 'Tab') {
                if (e.shiftKey) {
                    if (colIndex > 0) inputs[colIndex - 1].focus();
                    else {
                        const prevRow = row.previousElementSibling;
                        if (prevRow && prevRow.id && prevRow.id.startsWith('inv_row_')) {
                            const lastInput = prevRow.querySelector('.invoice-price');
                            if (lastInput) lastInput.focus();
                        }
                    }
                } else {
                    if (colIndex < 2) inputs[colIndex + 1].focus();
                    else {
                        const nextRow = row.nextElementSibling;
                        if (nextRow && nextRow.id && nextRow.id.startsWith('inv_row_')) {
                            const firstInput = nextRow.querySelector('.invoice-product-search');
                            if (firstInput) firstInput.focus();
                        } else {
                            addInvoiceRow();
                            const newRow = document.querySelector('#invoiceItemsBody tr:last-child');
                            if (newRow) {
                                const firstInput = newRow.querySelector('.invoice-product-search');
                                if (firstInput) firstInput.focus();
                            }
                        }
                    }
                }
            }
        });
    });
}

function updateInvoiceRowTotal(rowId) {
    const row = document.getElementById(rowId);
    if (!row) return;
    const qty = parseFloat(row.querySelector('.invoice-quantity').value) || 0;
    const price = parseFloat(row.querySelector('.invoice-price').value) || 0;
    row.querySelector('.invoice-row-total').textContent = (qty * price).toLocaleString('uz-UZ') + ' UZS';
    updateInvoiceTotal();
}

function updateInvoiceTotal() {
    let grandTotal = 0;
    document.querySelectorAll('#invoiceItemsBody tr').forEach(row => {
        const qty = parseFloat(row.querySelector('.invoice-quantity')?.value) || 0;
        const price = parseFloat(row.querySelector('.invoice-price')?.value) || 0;
        grandTotal += qty * price;
    });
    document.getElementById('invoiceTotalAmount').textContent = grandTotal.toLocaleString('uz-UZ') + ' UZS';
}

function removeInvoiceRow(rowId) {
    document.getElementById(rowId)?.remove();
    updateInvoiceTotal();
    if (document.querySelectorAll('#invoiceItemsBody tr').length === 0) {
        addInvoiceRow();
    }
}

function clearInvoiceTable() {
    if (!confirm('Hisob-fakturani tozalashni tasdiqlaysizmi?')) return;
    document.getElementById('invoiceItemsBody').innerHTML = '';
    addInvoiceRow();
    document.getElementById('invoiceCustomer').value = '';
    document.getElementById('invoicePhone').value = '';
    document.getElementById('invoiceDate').value = new Date().toISOString().split('T')[0];
    updateInvoiceTotal();
}

function addMultipleInvoiceRows() {
    const countInput = document.getElementById('invoiceRowsCount');
    if (!countInput) return;
    let count = parseInt(countInput.value, 10);
    if (isNaN(count) || count < 1) count = 1;
    const MAX_ROWS = 50;
    if (count > MAX_ROWS) {
        if (!confirm(`${count} ta qator qo'shish juda ko'p. Maksimal ${MAX_ROWS} ta. Davom ettirilsinmi?`)) return;
        count = MAX_ROWS;
    }
    for (let i = 0; i < count; i++) {
        addInvoiceRow();
    }
}

function collectInvoiceItems() {
    const items = [];
    const errors = [];
    let hasAny = false;

    document.querySelectorAll('#invoiceItemsBody tr').forEach(row => {
        const productId = row.querySelector('.invoice-product-id')?.value;
        const quantity = parseFloat(row.querySelector('.invoice-quantity')?.value) || 0;
        const price = parseFloat(row.querySelector('.invoice-price')?.value) || 0;

        if (!productId && quantity === 0 && price === 0) return;

        if (!productId) {
            errors.push('Mahsulot tanlanmagan qator');
            return;
        }
        if (quantity <= 0) {
            errors.push('Miqdor 1 dan kam bo‘lmasligi kerak');
            return;
        }
        if (price <= 0) {
            errors.push('Narx 0 dan katta bo‘lishi kerak');
            return;
        }

        const product = DokonApp.products.find(p => p.id === productId);
        if (!product) {
            errors.push('Mahsulot topilmadi');
            return;
        }
        if ((product.stock || 0) < quantity) {
            errors.push(`${product.name}: yetarli qoldiq yo‘q (so‘ralgan ${quantity}, mavjud ${product.stock})`);
            return;
        }

        hasAny = true;
        items.push({
            productId,
            productName: product.name,
            type: product.type,
            quantity,
            price,
            total: quantity * price,
            cost: product.cost || 0
        });
    });

    if (errors.length > 0) {
        showError(errors.join('<br>'));
        return null;
    }
    if (!hasAny) {
        showError('Hech qanday mahsulot kiritilmagan');
        return null;
    }
    return items;
}

async function generateInvoice() {
    if (!confirm('Hisob-fakturani yaratishni tasdiqlaysizmi?')) return;

    const customer = document.getElementById('invoiceCustomer').value.trim();
    const phone = document.getElementById('invoicePhone').value.trim();
    const date = document.getElementById('invoiceDate').value || new Date().toISOString().split('T')[0];

    if (!customer) {
        showError('Mijoz nomini kiriting');
        return;
    }

    const items = collectInvoiceItems();
    if (!items) return;

    const total = items.reduce((sum, it) => sum + it.total, 0);
    const totalProfit = items.reduce((sum, it) => sum + ((it.price - it.cost) * it.quantity), 0);

    const invoiceData = { customer, phone, date, items, total, totalProfit };

    try {
        const response = await apiFetch('/invoices', {
            method: 'POST',
            body: invoiceData
        });

        if (!response || !response.success) {
            throw new Error(response?.message || 'Hisob-faktura yaratishda xatolik');
        }

        const createdInvoiceId = response.invoice?.id || null;
        const saleErrors = [];

        for (const item of items) {
            try {
                await apiFetch('/sales', {
                    method: 'POST',
                    body: {
                        productId: item.productId,
                        productName: item.productName,
                        productType: item.type,
                        quantity: item.quantity,
                        price: item.price,
                        cost: item.cost,
                        date,
                        total: item.total,
                        profit: (item.price - item.cost) * item.quantity
                    }
                });
            } catch (e) {
                console.error('Sotuv yozishda xatolik:', e);
                saleErrors.push(`${item.productName}: ${e.message || e}`);
            }
        }

        if (saleErrors.length === 0) {
            showSuccess('Hisob-faktura yaratildi va sotuvlar qayd etildi');
        } else {
            showError('Qisman xatoliklar: ' + saleErrors.join('; '));
        }

        generateInvoicePDF(customer, phone, date, items);

        try {
            await apiFetch('/users/logs', {
                method: 'POST',
                body: {
                    action: 'invoice_create',
                    details: `Hisob-faktura yaratildi: ${customer}, ${total} UZS`,
                    entityId: createdInvoiceId,
                    entityType: 'invoice'
                }
            });
        } catch (e) {
            console.warn('Log yozilmadi:', e);
        }

        clearInvoiceTable();

        await Promise.all([
            loadProducts(),
            loadSales(),
            loadUserLogs(),
            loadWarehouseDebt()
        ]);

        renderAllTables();
        updateStatistics();
        updateBrandStats('akitoy');
        updateWarehouseDebtDisplay();

    } catch (error) {
        console.error('Hisob-faktura yaratishda xatolik:', error);
        showError('Hisob-faktura yaratishda xatolik: ' + (error.message || error));
    }
}

async function generateInvoicePDF(customer, phone, date, items) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    try {
        const logoUrl = '/Akiltoys.png';
        const logoImg = await loadImage(logoUrl);
        doc.addImage(logoImg, 'PNG', 15, 10, 30, 30);
    } catch (e) {
        console.warn('Logo yuklanmadi – davom etiladi');
    }

    doc.setFontSize(22);
    doc.setTextColor(40, 167, 69);
    doc.text('Akil Box', 55, 25);

    doc.setFontSize(18);
    doc.setTextColor(0, 0, 0);
    doc.text('HISOB-FAKTURA', 55, 35);

    const parts = date.split('-');
    const formattedDate = `${parts[2]}.${parts[1]}.${parts[0]}`;
    const invoiceNumber = `INV-${Date.now().toString().slice(-6)}`;
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`№: ${invoiceNumber} | Sana: ${formattedDate}`, 55, 45);

    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    let yPos = 70;
    doc.text(`Mijoz: ${customer}`, 15, yPos);
    yPos += 7;
    if (phone && phone.trim() !== '') {
        doc.text(`Telefon: ${phone}`, 15, yPos);
        yPos += 7;
    }
    doc.text(`Sana: ${formattedDate}`, 15, yPos);
    yPos += 10;

    const tableHeaders = [['№', 'Mahsulot', 'Miqdor', 'Narx (UZS)', 'Jami (UZS)']];
    const tableData = items.map((item, index) => [
        (index + 1).toString(),
        item.productName,
        item.quantity.toString(),
        item.price.toLocaleString('uz-UZ'),
        item.total.toLocaleString('uz-UZ')
    ]);

    doc.autoTable({
        startY: yPos,
        head: tableHeaders,
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [40, 167, 69], textColor: 255, fontStyle: 'bold' },
        styles: { fontSize: 10, cellPadding: 3, overflow: 'linebreak' },
        columnStyles: {
            0: { cellWidth: 10 },
            1: { cellWidth: 'auto' },
            2: { cellWidth: 20 },
            3: { cellWidth: 35 },
            4: { cellWidth: 35 }
        },
        margin: { left: 15, right: 15 }
    });

    const finalY = doc.lastAutoTable.finalY || 150;

    const total = items.reduce((sum, it) => sum + it.total, 0);
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text(`Umumiy summa: ${total.toLocaleString('uz-UZ')} UZS`, 140, finalY + 15);

    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text('Akil Box - O\'yinchoqlar do\'koni', 15, 280);
    doc.text('Tel1: +998 98 302 77 76 | Tel2: +998 77 302 77 66', 15, 285);
    doc.text(new Date().toLocaleDateString('uz-UZ'), 15, 290);

    const safeCustomer = customer.replace(/[^a-zA-Z0-9а-яА-ЯёЁ]/g, '_').substring(0, 30);
    const dateForFilename = date.replace(/-/g, '.');
    const filename = `Invoice_${safeCustomer}_${dateForFilename}.pdf`;
    doc.save(filename);
}

function loadImage(url) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = url;
    });
}

// Функции для отчетов (исправлены)
function showFullReport() {
    destroyAllCharts();
    
    const month = DokonApp.currentPeriod.month;
    const year = DokonApp.currentPeriod.year;
    const monthName = getMonthName(month);
    
    const monthSales = DokonApp.sales.filter(sale => {
        if (!sale.date) return false;
        const saleDate = new Date(sale.date);
        return saleDate.getMonth() === month && 
               saleDate.getFullYear() === year;
    });
    
    const totalRevenue = monthSales.reduce((sum, sale) => sum + (sale.total || 0), 0);
    const totalProfit = monthSales.reduce((sum, sale) => sum + (sale.profit || 0), 0);
    const totalQuantity = monthSales.reduce((sum, sale) => sum + (sale.quantity || 0), 0);
    
    const reportHTML = `
        <div class="report-stats-container">
            <h4 class="mb-4"><i class="fas fa-chart-bar me-2"></i>${monthName} ${year} oyi hisoboti</h4>
            
            <div class="report-stat-grid">
                <div class="report-stat-item">
                    <div class="stat-label">Umumiy daromad</div>
                    <div class="stat-value text-primary">${totalRevenue.toLocaleString('uz-UZ')} UZS</div>
                    <small class="text-muted">${monthSales.length} ta sotuv</small>
                </div>
                
                <div class="report-stat-item success">
                    <div class="stat-label">Umumiy foyda</div>
                    <div class="stat-value text-success">${totalProfit.toLocaleString('uz-UZ')} UZS</div>
                    <small class="text-muted">Foyda darajasi: ${totalRevenue > 0 ? ((totalProfit/totalRevenue)*100).toFixed(1) : 0}%</small>
                </div>
                
                <div class="report-stat-item warning">
                    <div class="stat-label">Sotilgan mahsulotlar</div>
                    <div class="stat-value text-warning">${totalQuantity} dona</div>
                    <small class="text-muted">O'rtacha miqdor: ${monthSales.length > 0 ? (totalQuantity/monthSales.length).toFixed(1) : 0} dona</small>
                </div>
            </div>
            
            <div class="mt-4">
                <h6 class="mb-3">Sotuvlar ro'yxati (${monthSales.length} ta):</h6>
                <div class="report-table-container">
                    <table class="table table-hover table-striped">
                        <thead class="table-primary">
                            <tr>
                                <th width="100">Sana</th>
                                <th>Mahsulot</th>
                                <th width="80">Miqdor</th>
                                <th width="120">Narx (UZS)</th>
                                <th width="150">Jami (UZS)</th>
                                <th width="150">Foyda (UZS)</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${monthSales.length > 0 ? monthSales.map(sale => {
                                const saleDate = sale.date ? new Date(sale.date) : null;
                                const dateStr = saleDate ? saleDate.toLocaleDateString('uz-UZ') : '';
                                
                                return `
                                    <tr>
                                        <td><small>${dateStr}</small></td>
                                        <td>
                                            <div class="fw-semibold">${sale.productName}</div>
                                            <small class="text-muted">Akil Box</small>
                                        </td>
                                        <td class="text-center">${sale.quantity}</td>
                                        <td class="report-number">${(sale.price || 0).toLocaleString('uz-UZ')}</td>
                                        <td class="report-number fw-bold">${(sale.total || 0).toLocaleString('uz-UZ')}</td>
                                        <td class="report-number ${sale.profit > 0 ? 'text-success' : 'text-danger'} fw-bold">
                                            ${(sale.profit || 0).toLocaleString('uz-UZ')}
                                        </td>
                                    </tr>
                                `;
                            }).join('') : `
                                <tr>
                                    <td colspan="6" class="text-center py-4 text-muted">
                                        <i class="fas fa-chart-line fa-2x mb-2 d-block"></i>
                                        Sotuvlar yo'q
                                    </td>
                                </tr>
                            `}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
    
    const reportModal = new bootstrap.Modal(document.getElementById('reportModal'));
    
    document.getElementById('reportModalTitle').textContent = `${monthName} ${year} - To'liq hisobot`;
    document.getElementById('reportStats').innerHTML = reportHTML;
    
    reportModal.show();
    
    setTimeout(() => {
        const chartCanvas = document.getElementById('reportChart');
        if (chartCanvas) {
            chartCanvas.style.display = 'block';
            createSalesChart(monthSales);
        }
    }, 100);
}

function showProfitReport() {
    destroyAllCharts();
    
    const month = DokonApp.currentPeriod.month;
    const year = DokonApp.currentPeriod.year;
    const monthName = getMonthName(month);
    
    const monthSales = DokonApp.sales.filter(sale => {
        if (!sale.date) return false;
        const saleDate = new Date(sale.date);
        return saleDate.getMonth() === month && 
               saleDate.getFullYear() === year;
    });
    
    const totalRevenue = monthSales.reduce((sum, sale) => sum + (sale.total || 0), 0);
    const totalProfit = monthSales.reduce((sum, sale) => sum + (sale.profit || 0), 0);
    
    const akitoyDebt = DokonApp.warehouseData.currentDebt || 0;
    
    const reportHTML = `
        <div class="report-stats-container">
            <h4 class="mb-4"><i class="fas fa-coins me-2"></i>${monthName} ${year} foyda hisoboti</h4>
            
            <div class="report-stat-grid">
                <div class="report-stat-item" style="border-left-color: #4361ee;">
                    <div class="stat-label text-primary fw-bold">
                        <i class="fas fa-robot me-2"></i>Akil Box
                    </div>
                    <div class="mt-3">
                        <div class="d-flex justify-content-between mb-2">
                            <span>Daromad:</span>
                            <span class="report-number text-primary">${totalRevenue.toLocaleString('uz-UZ')} UZS</span>
                        </div>
                        <div class="d-flex justify-content-between mb-2">
                            <span>Foyda:</span>
                            <span class="report-number text-success fw-bold">${totalProfit.toLocaleString('uz-UZ')} UZS</span>
                        </div>
                        <div class="d-flex justify-content-between">
                            <span>Foyda %:</span>
                            <span class="report-number ${totalProfit > 0 ? 'text-success' : 'text-danger'}">
                                ${totalRevenue > 0 ? ((totalProfit/totalRevenue)*100).toFixed(1) : 0}%
                            </span>
                        </div>
                        <hr class="my-2">
                        <div class="d-flex justify-content-between mb-2">
                            <span>Qarzdorlik:</span>
                            <span class="report-number ${akitoyDebt > 0 ? 'text-danger' : 'text-success'}">
                                ${akitoyDebt.toLocaleString('uz-UZ')} UZS
                            </span>
                        </div>
                        <div class="d-flex justify-content-between">
                            <span>Sotuvlar:</span>
                            <span class="badge bg-primary">${monthSales.length} ta</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    const reportModal = new bootstrap.Modal(document.getElementById('reportModal'));
    document.getElementById('reportModalTitle').textContent = `${monthName} ${year} - Foyda va qarzdorlik hisoboti`;
    document.getElementById('reportStats').innerHTML = reportHTML;
    
    reportModal.show();
    
    setTimeout(() => {
        const chartCanvas = document.getElementById('reportChart');
        if (chartCanvas) {
            chartCanvas.style.display = 'block';
            createProfitAndDebtChart(totalProfit, akitoyDebt);
        }
    }, 100);
}

// Инициализация автодополнения для склада
function initWarehouseAutocomplete(inputId, hiddenId, suggestionsId, type) {
    const input = document.getElementById(inputId);
    const hidden = document.getElementById(hiddenId);
    const suggestions = document.getElementById(suggestionsId);
    const costInputId = 'warehouseAkitoyCost';
    const costInput = document.getElementById(costInputId);

    if (!input || !hidden || !suggestions || !costInput) {
        console.warn(`Autocomplete init failed: missing elements for ${type}`);
        return;
    }

    document.addEventListener('click', function(e) {
        if (!input.contains(e.target) && !suggestions.contains(e.target)) {
            suggestions.style.display = 'none';
        }
    });

    input.addEventListener('input', function() {
        const searchTerm = this.value.trim().toLowerCase();
        if (searchTerm.length < 1) {
            suggestions.style.display = 'none';
            hidden.value = '';
            return;
        }

        const filtered = DokonApp.products
            .filter(p => p.type === type)
            .filter(p => 
                p.name.toLowerCase().includes(searchTerm) ||
                (p.article && p.article.toLowerCase().includes(searchTerm)) ||
                (p.category && p.category.toLowerCase().includes(searchTerm))
            )
            .slice(0, 10);

        renderAutocompleteSuggestions(filtered, suggestions, input, hidden, costInput);
    });

    input.addEventListener('blur', function() {
        setTimeout(() => {
            if (this.value.trim() === '') {
                hidden.value = '';
            }
        }, 200);
    });
}

function renderAutocompleteSuggestions(products, suggestionsEl, inputEl, hiddenEl, costInputEl) {
    if (!products.length) {
        suggestionsEl.style.display = 'none';
        return;
    }

    let html = '';
    products.forEach(p => {
        const safeName = p.name.replace(/'/g, "\\'");
        html += `<div onclick="selectWarehouseProduct('${p.id}', '${safeName}', ${p.cost || 0}, '${hiddenEl.id}', '${costInputEl.id}', '${inputEl.id}', '${suggestionsEl.id}')">
                    <strong>${p.name}</strong>
                    <small class="text-muted"> (Art: ${p.article || '—'})</small><br>
                    <small>Qoldiq: ${p.stock || 0} dona | Narx: ${(p.cost || 0).toLocaleString('uz-UZ')} UZS</small>
                 </div>`;
    });
    suggestionsEl.innerHTML = html;
    suggestionsEl.style.display = 'block';
}

window.selectWarehouseProduct = function(productId, productName, cost, hiddenId, costInputId, inputId, suggestionsId) {
    document.getElementById(hiddenId).value = productId;
    document.getElementById(costInputId).value = cost;
    document.getElementById(inputId).value = productName;
    document.getElementById(suggestionsId).style.display = 'none';
    calculateWarehouseTotal();
};

function showWarehouseReport() {
    destroyAllCharts();
    const monthName = getMonthName(DokonApp.currentPeriod.month);
    const year = DokonApp.currentPeriod.year;
    
    const akitoyPurchases = DokonApp.warehouseData.totalPurchases || 0;
    const akitoyPayments = DokonApp.warehouseData.totalPayments || 0;
    const akitoyDebt = DokonApp.warehouseData.currentDebt || 0;
    
    const month = DokonApp.currentPeriod.month;
    const currentYear = DokonApp.currentPeriod.year;
    
    const monthSales = DokonApp.sales.filter(sale => {
        if (!sale.date) return false;
        const saleDate = new Date(sale.date);
        return saleDate.getMonth() === month && 
               saleDate.getFullYear() === currentYear;
    });
    
    const akitoySales = monthSales;
    const akitoyQuantity = akitoySales.reduce((sum, sale) => sum + (sale.quantity || 0), 0);
    const totalQuantity = akitoyQuantity;
    
    const totalRevenue = monthSales.reduce((sum, sale) => sum + (sale.total || 0), 0);
    const totalProfit = monthSales.reduce((sum, sale) => sum + (sale.profit || 0), 0);
    
    const reportHTML = `
        <div class="report-stats-container">
            <h4 class="mb-4"><i class="fas fa-warehouse me-2"></i>${monthName} ${year} ombor hisoboti</h4>
            
            <div class="report-stat-grid">
                <div class="report-stat-item">
                    <div class="stat-label text-primary fw-bold">
                        <i class="fas fa-robot me-2"></i>Akil Box
                    </div>
                    <div class="mt-3">
                        <div class="d-flex justify-content-between mb-2">
                            <span>Umumiy xaridlar:</span>
                            <span class="report-number">${akitoyPurchases.toLocaleString('uz-UZ')} UZS</span>
                        </div>
                        <div class="d-flex justify-content-between mb-2">
                            <span>To'langan:</span>
                            <span class="report-number text-success">${akitoyPayments.toLocaleString('uz-UZ')} UZS</span>
                        </div>
                        <div class="d-flex justify-content-between mb-2">
                            <span>Qarzdorlik:</span>
                            <span class="report-number ${akitoyDebt > 0 ? 'text-danger' : 'text-success'}">
                                ${akitoyDebt.toLocaleString('uz-UZ')} UZS
                            </span>
                        </div>
                        <div class="d-flex justify-content-between">
                            <span>Mahsulotlar soni:</span>
                            <span class="badge bg-primary">${DokonApp.products.filter(p => p.type === 'akitoy').length} ta</span>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="mt-4">
                <h5 class="mb-3"><i class="fas fa-chart-line me-2"></i>${monthName} ${year} oyi sotuvlar</h5>
                <div class="row">
                    <div class="col-md-12">
                        <div class="card">
                            <div class="card-header bg-info text-white">
                                <i class="fas fa-boxes me-2"></i>Sotilgan mahsulotlar (${totalQuantity} dona)
                            </div>
                            <div class="card-body">
                                <div class="text-center mt-3">
                                    <small class="text-muted">
                                        Jami daromad: ${totalRevenue.toLocaleString('uz-UZ')} UZS &nbsp;|&nbsp;
                                        Jami foyda: ${totalProfit.toLocaleString('uz-UZ')} UZS &nbsp;|&nbsp;
                                        O'rtacha foyda: ${totalQuantity > 0 ? (totalProfit/totalQuantity).toFixed(0) : 0} UZS/dona
                                    </small>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    if (window.salesChart) {
        window.salesChart.destroy();
        window.salesChart = null;
    }
    if (window.profitAndDebtChart) {
        window.profitAndDebtChart.destroy();
        window.profitAndDebtChart = null;
    }
    if (window.warehouseChart) {
        window.warehouseChart.destroy();
        window.warehouseChart = null;
    }
    
    const reportModal = new bootstrap.Modal(document.getElementById('reportModal'));
    document.getElementById('reportModalTitle').textContent = `${monthName} ${year} - Ombor va sotuv hisoboti`;
    document.getElementById('reportStats').innerHTML = reportHTML;
    reportModal.show();
    
    setTimeout(() => {
        const chartCanvas = document.getElementById('reportChart');
        if (chartCanvas) {
            chartCanvas.style.display = 'block';
            const ctx = chartCanvas.getContext('2d');
            
            window.warehouseChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: ['Akil Box'],
                    datasets: [
                        {
                            label: 'Xaridlar (UZS)',
                            data: [akitoyPurchases],
                            backgroundColor: 'rgba(67, 97, 238, 0.7)',
                            borderColor: 'rgba(67, 97, 238, 1)',
                            borderWidth: 1
                        },
                        {
                            label: 'Toʻlovlar (UZS)',
                            data: [akitoyPayments],
                            backgroundColor: 'rgba(40, 167, 69, 0.7)',
                            borderColor: 'rgba(40, 167, 69, 1)',
                            borderWidth: 1
                        },
                        {
                            label: 'Qarzdorlik (UZS)',
                            data: [akitoyDebt],
                            backgroundColor: 'rgba(220, 53, 69, 0.7)',
                            borderColor: 'rgba(220, 53, 69, 1)',
                            borderWidth: 1
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        title: {
                            display: true,
                            text: 'Ombor holati – xaridlar, toʻlovlar va qarzdorlik'
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    let label = context.dataset.label || '';
                                    if (label) label += ': ';
                                    label += context.parsed.y.toLocaleString('uz-UZ') + ' UZS';
                                    return label;
                                }
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                callback: function(value) {
                                    return value.toLocaleString('uz-UZ') + ' UZS';
                                }
                            }
                        }
                    }
                }
            });
        }
    }, 150);
}

function destroyAllCharts() {
    const chartNames = [
        'salesChart',
        'profitAndDebtChart',
        'warehouseChart',
        'warehouseRevenueChart',
        'warehouseProfitChart',
        'warehouseSalesChart',
        'warehouseDailyChart'
    ];
    
    chartNames.forEach(name => {
        if (window[name]) {
            try {
                if (window[name] instanceof Chart) {
                    window[name].destroy();
                }
            } catch (e) {
                console.warn(`Ошибка при уничтожении диаграммы ${name}:`, e);
            } finally {
                window[name] = null;
            }
        }
    });
}

function renderAllTables() {
    renderProductCards('akitoy');
    renderWarehouseLogs();
    renderSalesTable();
    renderUsersTable();
}

function renderProductCards(type) {
    const container = document.getElementById('akitoyProducts');
    if (!container) return;
    
    const products = DokonApp.products.filter(p => p.type === type);
    
    if (products.length === 0) {
        container.innerHTML = '<p class="text-center py-4 text-muted">Mahsulotlar yo\'q</p>';
        return;
    }
    
    const cards = products.map(product => `
        <div class="product-card">
            <div class="product-image-container">
                <img src="${product.image ? API_URL + product.image : 'https://via.placeholder.com/150?text=No+Image'}" 
                     alt="${product.name}" 
                     class="product-image">
            </div>
            <div class="product-info">
                <div class="product-name">${product.name}</div>
                <div class="product-article">${product.article || '-'}</div>
                <div class="product-price-row">
                    <span class="product-label">Xarajat:</span>
                    <span class="product-cost">${(product.cost || 0).toLocaleString('uz-UZ')} UZS</span>
                </div>
                <div class="product-price-row">
                    <span class="product-label">Sotish:</span>
                    <span class="product-price">${(product.price || 0).toLocaleString('uz-UZ')} UZS</span>
                </div>
                <div class="product-stock-row">
                    <span class="product-label">Qoldiq:</span>
                    <span class="badge ${(product.stock || 0) <= (product.minStock || 5) ? 'bg-danger' : 'bg-success'} product-stock-badge">
                        ${product.stock || 0} dona
                    </span>
                </div>
                <div class="product-value">
                    Qiymati: ${((product.cost || 0) * (product.stock || 0)).toLocaleString('uz-UZ')} UZS
                </div>
                <div class="product-actions">
                    <button class="btn btn-sm btn-success" onclick="showSaleModal('${type}', '${product.id}')">
                        <i class="fas fa-cash-register"></i> Sotish
                    </button>
                    <button class="btn btn-sm btn-primary" onclick="showEditProductModal('${type}', '${product.id}')">
                        <i class="fas fa-edit"></i> Tahrirlash
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="deleteProduct('${type}', '${product.id}')">
                        <i class="fas fa-trash"></i> O'chirish
                    </button>
                </div>
            </div>
        </div>
    `).join('');
    
    container.innerHTML = cards;
}

function renderWarehouseLogs() {
    const akContainer = document.getElementById('warehouseAkitoyLogs');
    if (!akContainer) return;
    
    const logs = DokonApp.warehouseLogs || [];
    
    const currentMonth = DokonApp.currentPeriod.month;
    const currentYear = DokonApp.currentPeriod.year;
    
    const filteredLogs = logs.filter(log => {
        if (!log.date) return false;
        const logDate = new Date(log.date);
        return logDate.getMonth() === currentMonth && 
               logDate.getFullYear() === currentYear;
    });
    
    const akLogs = filteredLogs.filter(log => log.productType === 'akitoy');
    
    akLogs.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    const displayAkLogs = akLogs.slice(0, 10);
    
    const akHTML = displayAkLogs.length > 0 ? 
        displayAkLogs.map(log => `
            <div class="log-item warehouse mb-2">
                <div class="d-flex justify-content-between align-items-start">
                    <div class="flex-grow-1">
                        <strong>${log.productName || 'Noma\'lum mahsulot'}</strong>
                        <div class="d-flex justify-content-between mt-1">
                            <small class="text-muted">${log.date ? new Date(log.date).toLocaleDateString('uz-UZ') : ''}</small>
                        </div>
                    </div>
                    <div class="text-end ms-2">
                        <span class="badge bg-primary d-block mb-1">+${log.quantity || 0} dona</span>
                        <small class="text-success">${(log.totalCost || 0).toLocaleString('uz-UZ')} UZS</small>
                    </div>
                </div>
            </div>
        `).join('') : 
        '<p class="text-muted text-center py-3">Hozircha operatsiyalar yo\'q</p>';
    
    akContainer.innerHTML = akHTML;
}

function renderSalesTable() {
    const container = document.getElementById('recentOperations');
    if (!container) return;

    const allSales = DokonApp.sales || [];
    allSales.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

    if (allSales.length === 0) {
        container.innerHTML = `
            <tr>
                <td colspan="7" class="text-center py-5 text-muted">
                    <i class="fas fa-history fa-2x mb-3 d-block"></i>
                    Hozircha sotuvlar yo'q
                </td>
            </tr>
        `;
        return;
    }

    const rows = allSales.map(sale => {
        const saleDate = sale.date ? new Date(sale.date) : null;
        const dateStr = saleDate ? saleDate.toLocaleDateString('uz-UZ') : '';

        return `
            <tr>
                <td data-label="Sana"><small>${dateStr}</small></td>
                <td data-label="Mahsulot"><strong>${escapeHtml(sale.productName || 'Noma\'lum')}</strong></td>
                <td data-label="Turi"><span class="badge bg-primary">Akil Box</span></td>
                <td data-label="Miqdor"><span class="badge bg-secondary">${sale.quantity || 0} dona</span></td>
                <td data-label="Narx">${(sale.price || 0).toLocaleString('uz-UZ')} UZS</td>
                <td data-label="Jami"><strong>${(sale.total || 0).toLocaleString('uz-UZ')} UZS</strong></td>
                <td data-label="Foyda" class="${sale.profit > 0 ? 'text-success' : 'text-danger'}"><strong>${(sale.profit || 0).toLocaleString('uz-UZ')} UZS</strong></td>
            </tr>
        `;
    }).join('');

    container.innerHTML = rows;
}

function renderUsersTable() {
    const container = document.getElementById('usersTable');
    if (!container) return;
    
    const users = DokonApp.users || [];
    
    if (users.length === 0) {
        container.innerHTML = '<tr><td colspan="9" class="text-center py-4 text-muted">Foydalanuvchilar yo\'q</td></tr>';
        return;
    }
    
    const rows = users.map(user => `
        <tr>
            <td data-label="ID">${user.id?.substring(0, 8) || 'N/A'}...</td>
            <td data-label="Foydalanuvchi nomi">${escapeHtml(user.username)}</td>
            <td data-label="To'liq ismi">${escapeHtml(user.fullName || '-')}</td>
            <td data-label="Roli"><span class="role-badge ${getRoleClass(user.role)}">${getRoleText(user.role)}</span></td>
            <td data-label="Email">${escapeHtml(user.email || '-')}</td>
            <td data-label="Telefon">${escapeHtml(user.phone || '-')}</td>
            <td data-label="Holati"><span class="badge ${user.status === 'active' ? 'bg-success' : 'bg-danger'}">${user.status === 'active' ? 'Faol' : 'Nofaol'}</span></td>
            <td data-label="Yaratilgan">${user.createdAt ? new Date(user.createdAt).toLocaleDateString('uz-UZ') : '-'}</td>
            <td data-label="Amallar">
                <button class="btn btn-sm btn-primary" onclick="editUser('${user.id}')"><i class="fas fa-edit"></i></button>
                <button class="btn btn-sm btn-danger" onclick="deleteUser('${user.id}')"><i class="fas fa-trash"></i></button>
            </td>
        </tr>
    `).join('');
    
    container.innerHTML = rows;
}

async function createNewNasiyaClient() {
    const name = prompt("Yangi mijoz ismini kiriting:");
    if (!name) return null;
    
    const phone = prompt("Telefon raqamini kiriting:");
    if (!phone) return null;
    
    try {
        const response = await apiFetch('/nasiya/clients', {
            method: 'POST',
            body: {
                name: name.trim(),
                phone: phone.trim(),
                status: 'active',
                totalDebt: 0,
                paidAmount: 0,
                remainingDebt: 0
            }
        });
        
        if (response && response.success) {
            showSuccess('Yangi mijoz yaratildi');
            await loadNasiyaData();
            return response.client;
        }
    } catch (error) {
        showError('Mijoz yaratishda xatolik: ' + error.message);
    }
    return null;
}

function renderUserLogsTable() {
    const container = document.getElementById('userLogsTable');
    if (!container) return;
    
    const logs = DokonApp.userLogs || [];
    const filterUserId = document.getElementById('userLogsFilter')?.value;
    
    let filteredLogs = logs;
    if (filterUserId && filterUserId !== 'all') {
        filteredLogs = logs.filter(log => log.userId === filterUserId);
    }
    
    filteredLogs.sort((a, b) => new Date(b.timestamp || b.createdAt || 0) - new Date(a.timestamp || a.createdAt || 0));
    
    const displayLogs = filteredLogs;
    
    if (displayLogs.length === 0) {
        container.innerHTML = `
            <tr>
                <td colspan="5" class="text-center py-5 text-muted">
                    <i class="fas fa-clipboard-list fa-2x mb-3 d-block"></i>
                    Hozircha harakatlar yo'q
                </td>
            </tr>
        `;
        return;
    }
    
    const rows = displayLogs.map(log => {
        const logDate = log.timestamp || log.createdAt;
        const dateObj = logDate ? new Date(logDate) : null;
        const dateStr = dateObj ? dateObj.toLocaleDateString('uz-UZ') : '';
        const timeStr = dateObj ? dateObj.toLocaleTimeString('uz-UZ', { 
            hour: '2-digit', 
            minute: '2-digit' 
        }) : '';
        
        const user = DokonApp.users.find(u => u.id === log.userId) || {};
        
        return `
            <tr>
                <td>
                    <small>${dateStr}</small><br>
                    <small class="text-muted">${timeStr}</small>
                </td>
                <td>
                    <strong>${user.username || 'Noma\'lum'}</strong>
                    ${user.fullName ? `<br><small class="text-muted">${user.fullName}</small>` : ''}
                </td>
                <td>
                    <span class="badge ${getLogActionClass(log.action)}">
                        ${getLogActionText(log.action)}
                    </span>
                </td>
                <td>
                    <div class="log-details">
                        <strong>${log.details || log.description || 'Tafsilotsiz'}</strong>
                        ${log.productName ? `<br><small>Mahsulot: ${log.productName}</small>` : ''}
                        ${log.quantity ? `<br><small>Miqdor: ${log.quantity}</small>` : ''}
                        ${log.amount ? `<br><small>Summa: ${log.amount?.toLocaleString('uz-UZ') || 0} UZS</small>` : ''}
                    </div>
                </td>
                <td>
                    <small class="text-muted">${log.ipAddress || 'Noma\'lum'}</small>
                </td>
            </tr>
        `;
    }).join('');
    
    container.innerHTML = rows;
}

function updateUserLogsFilter() {
    const filterSelect = document.getElementById('userLogsFilter');
    if (!filterSelect) return;
    
    const currentValue = filterSelect.value;
    
    filterSelect.innerHTML = '<option value="all">Barcha foydalanuvchilar</option>';
    
    const users = DokonApp.users || [];
    users.forEach(user => {
        const option = document.createElement('option');
        option.value = user.id;
        option.textContent = `${user.username} (${user.fullName || user.username})`;
        filterSelect.appendChild(option);
    });
    
    if (currentValue) {
        filterSelect.value = currentValue;
    }
}

function getLogActionText(action) {
    const actions = {
        'login': 'Kirish',
        'logout': 'Chiqish',
        'product_create': 'Mahsulot yaratish',
        'product_update': 'Mahsulot yangilash',
        'product_delete': 'Mahsulot o\'chirish',
        'sale_create': 'Sotish',
        'warehouse_receive': 'Omborga qabul qilish',
        'user_create': 'Foydalanuvchi yaratish',
        'user_update': 'Foydalanuvchi yangilash',
        'user_delete': 'Foydalanuvchi o\'chirish',
        'payment_create': 'To\'lov qilish',
        'invoice_create': 'Hisob-faktura yaratish'
    };
    
    return actions[action] || action;
}

function getLogActionClass(action) {
    const classes = {
        'login': 'bg-success',
        'logout': 'bg-secondary',
        'product_create': 'bg-primary',
        'product_update': 'bg-info',
        'product_delete': 'bg-danger',
        'sale_create': 'bg-success',
        'warehouse_receive': 'bg-warning',
        'user_create': 'bg-primary',
        'user_update': 'bg-info',
        'user_delete': 'bg-danger',
        'payment_create': 'bg-success',
        'invoice_create': 'bg-info'
    };
    
    return classes[action] || 'bg-secondary';
}

// Вспомогательные функции
function updateStatistics() {
    try {
        const currentMonth = DokonApp.currentPeriod.month;
        const currentYear = DokonApp.currentPeriod.year;
        
        const monthSales = DokonApp.sales.filter(sale => {
            if (!sale.date) return false;
            const saleDate = new Date(sale.date);
            return saleDate.getMonth() === currentMonth && 
                   saleDate.getFullYear() === currentYear;
        });
        
        const totalRevenue = monthSales.reduce((sum, sale) => sum + (sale.total || 0), 0);
        const totalProfit = monthSales.reduce((sum, sale) => sum + (sale.profit || 0), 0);
        
        const akitoyProducts = DokonApp.products.filter(p => p.type === 'akitoy');
        const warehouseValue = akitoyProducts.reduce((sum, product) => 
            sum + ((product.cost || 0) * (product.stock || 0)), 0);
        
        document.getElementById('totalRevenue').textContent = totalRevenue.toLocaleString('uz-UZ') + ' UZS';
        document.getElementById('totalProfit').textContent = totalProfit.toLocaleString('uz-UZ') + ' UZS';
        document.getElementById('totalWarehouseValue').textContent = warehouseValue.toLocaleString('uz-UZ') + ' UZS';
        
        updateBrandStats('akitoy');
        
    } catch (error) {
        console.error('Statistikani yangilashda xatolik:', error);
    }
}

function updateBrandStats(brand) {
    const sales = DokonApp.sales || [];
    const products = DokonApp.products || [];
    
    const currentMonth = DokonApp.currentPeriod.month;
    const currentYear = DokonApp.currentPeriod.year;
    
    const brandSales = sales.filter(s => {
        if (!s.date) return false;
        const saleDate = new Date(s.date);
        return s.productType === brand && 
               saleDate.getMonth() === currentMonth && 
               saleDate.getFullYear() === currentYear;
    });
    
    const revenue = brandSales.reduce((sum, s) => sum + (s.total || 0), 0);
    const profit = brandSales.reduce((sum, s) => sum + (s.profit || 0), 0);
    
    const warehouseValue = products
        .filter(p => p.type === brand)
        .reduce((sum, p) => sum + ((p.stock || 0) * (p.cost || 0)), 0);
    
    const revenueElement = document.getElementById(`${brand}Revenue`);
    const profitElement = document.getElementById(`${brand}Profit`);
    const warehouseValueElement = document.getElementById(`${brand}WarehouseValue`);
    
    if (revenueElement) {
        revenueElement.textContent = revenue.toLocaleString('uz-UZ') + ' UZS';
    }
    
    if (profitElement) {
        profitElement.textContent = profit.toLocaleString('uz-UZ') + ' UZS';
    }
    
    if (warehouseValueElement) {
        warehouseValueElement.textContent = warehouseValue.toLocaleString('uz-UZ') + ' UZS';
    }
}

function updatePeriodDisplay() {
    const month = DokonApp.currentPeriod.month;
    const year = DokonApp.currentPeriod.year;
    
    document.getElementById('monthSelect').value = month;
    document.getElementById('yearSelect').value = year;
    document.getElementById('currentPeriod').textContent = `${getMonthName(month)} ${year}`;
}

function changePeriod() {
    const month = parseInt(document.getElementById('monthSelect').value);
    const year = parseInt(document.getElementById('yearSelect').value);
    
    if (isNaN(month) || isNaN(year)) {
        showError('Iltimos, to\'g\'ri oy va yil kiriting');
        return;
    }
    
    DokonApp.currentPeriod = { month, year };
    localStorage.setItem('dokon_period', JSON.stringify(DokonApp.currentPeriod));
    updatePeriodDisplay();
    updateStatistics();
    
    if (window.salesChart) {
        window.salesChart.destroy();
        window.salesChart = null;
    }
    
    if (window.profitAndDebtChart) {
        window.profitAndDebtChart.destroy();
        window.profitAndDebtChart = null;
    }
    
    if (window.warehouseRevenueChart) {
        window.warehouseRevenueChart.destroy();
        window.warehouseRevenueChart = null;
    }
    
    if (window.warehouseProfitChart) {
        window.warehouseProfitChart.destroy();
        window.warehouseProfitChart = null;
    }
    
    showSuccess(`Davr o'zgartirildi: ${getMonthName(month)} ${year}`);
    renderSalesTable();
}

function getMonthName(month) {
    const months = [
        'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun',
        'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'
    ];
    return months[month] || 'Yanvar';
}

// Функции для модальных окон
function showAddProductModal(type) {
    document.getElementById('editProductId').value = '';
    document.getElementById('editProductType').value = type || 'akitoy';
    document.getElementById('productName').value = '';
    document.getElementById('productArticle').value = '';
    document.getElementById('productCost').value = '';
    document.getElementById('productPrice').value = '';
    document.getElementById('productStock').value = '0';
    document.getElementById('productCategory').value = '';
    document.getElementById('productDescription').value = '';
    document.getElementById('productMinStock').value = '5';
    document.getElementById('productImage').value = '';
    document.getElementById('imagePreview').innerHTML = '';
    
    new bootstrap.Modal(document.getElementById('productModal')).show();
}

function showEditProductModal(type, id) {
    const product = DokonApp.products.find(p => p.id === id);
    if (!product) return;
    
    document.getElementById('editProductId').value = product.id;
    document.getElementById('editProductType').value = type;
    document.getElementById('productName').value = product.name || '';
    document.getElementById('productArticle').value = product.article || '';
    document.getElementById('productCost').value = product.cost || 0;
    document.getElementById('productPrice').value = product.price || 0;
    document.getElementById('productStock').value = product.stock || 0;
    document.getElementById('productCategory').value = product.category || '';
    document.getElementById('productDescription').value = product.description || '';
    document.getElementById('productMinStock').value = product.minStock || 5;
    
    if (product.image) {
        document.getElementById('imagePreview').innerHTML = `
            <img src="${API_URL + product.image}" alt="Current Image" 
                 style="max-width: 100px; max-height: 100px; border-radius: 5px;">
            <p class="small text-muted mt-1">Joriy rasm</p>
        `;
    } else {
        document.getElementById('imagePreview').innerHTML = '';
    }
    
    new bootstrap.Modal(document.getElementById('productModal')).show();
}

function showAddUserModal() {
    document.getElementById('editUserId').value = '';
    document.getElementById('userUsername').value = '';
    document.getElementById('userFullName').value = '';
    document.getElementById('userPassword').value = '';
    document.getElementById('userRole').value = '1';
    document.getElementById('userEmail').value = '';
    document.getElementById('userPhone').value = '';
    document.getElementById('userStatus').value = 'active';
    
    new bootstrap.Modal(document.getElementById('userModal')).show();
}

function editUser(id) {
    const user = DokonApp.users.find(u => u.id === id);
    if (!user) return;
    
    const roleMap = {
        'seller': 1,
        'warehouse': 2,
        'admin': 3,
        'superadmin': 4
    };
    
    document.getElementById('editUserId').value = user.id;
    document.getElementById('userUsername').value = user.username || '';
    document.getElementById('userFullName').value = user.fullName || '';
    document.getElementById('userPassword').value = '';
    document.getElementById('userRole').value = roleMap[user.role] || 1;
    document.getElementById('userEmail').value = user.email || '';
    document.getElementById('userPhone').value = user.phone || '';
    document.getElementById('userStatus').value = user.status || 'active';
    
    new bootstrap.Modal(document.getElementById('userModal')).show();
}

function previewImage(input) {
    const preview = document.getElementById('imagePreview');
    preview.innerHTML = '';
    
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        
        reader.onload = function(e) {
            preview.innerHTML = `
                <img src="${e.target.result}" 
                     alt="Image Preview" 
                     style="max-width: 100px; max-height: 100px; border-radius: 5px;">
                <p class="small text-muted mt-1">Yuklangan rasm</p>
            `;
        }
        
        reader.readAsDataURL(input.files[0]);
    }
}

function searchProducts(type) {
    const searchTerm = document.getElementById('searchAkil').value.toLowerCase();
    const container = document.getElementById('akitoyProducts');
    
    if (!container) return;
    
    const products = DokonApp.products.filter(p => 
        p.type === type &&
        (p.name.toLowerCase().includes(searchTerm) ||
         (p.article && p.article.toLowerCase().includes(searchTerm)) ||
         (p.category && p.category.toLowerCase().includes(searchTerm)) ||
         (p.description && p.description.toLowerCase().includes(searchTerm)))
    );
    
    if (products.length === 0) {
        container.innerHTML = '<p class="text-center py-4 text-muted">Mahsulot topilmadi</p>';
        return;
    }
    
    const cards = products.map(product => `
        <div class="product-card">
            <div class="product-image-container">
                <img src="${product.image ? API_URL + product.image : 'https://via.placeholder.com/150?text=No+Image'}" 
                     alt="${product.name}" 
                     class="product-image">
            </div>
            <div class="product-info">
                <div class="product-name">${product.name}</div>
                <div class="product-article">${product.article || '-'}</div>
                <div class="product-price-row">
                    <span class="product-label">Xarajat:</span>
                    <span class="product-cost">${(product.cost || 0).toLocaleString('uz-UZ')} UZS</span>
                </div>
                <div class="product-price-row">
                    <span class="product-label">Sotish:</span>
                    <span class="product-price">${(product.price || 0).toLocaleString('uz-UZ')} UZS</span>
                </div>
                <div class="product-stock-row">
                    <span class="product-label">Qoldiq:</span>
                    <span class="badge ${(product.stock || 0) <= (product.minStock || 5) ? 'bg-danger' : 'bg-success'} product-stock-badge">
                        ${product.stock || 0} dona
                    </span>
                </div>
                <div class="product-value">
                    Qiymati: ${((product.cost || 0) * (product.stock || 0)).toLocaleString('uz-UZ')} UZS
                </div>
                <div class="product-actions">
                    <button class="btn btn-sm btn-success" onclick="showSaleModal('${type}', '${product.id}')">
                        <i class="fas fa-cash-register"></i> Sotish
                    </button>
                    <button class="btn btn-sm btn-primary" onclick="showEditProductModal('${type}', '${product.id}')">
                        <i class="fas fa-edit"></i> Tahrirlash
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="deleteProduct('${type}', '${product.id}')">
                        <i class="fas fa-trash"></i> O'chirish
                    </button>
                </div>
            </div>
        </div>
    `).join('');
    
    container.innerHTML = cards;
}

function generateReportPDF() {
    const reportTitle = document.getElementById('reportModalTitle').textContent;
    const reportContent = document.getElementById('reportStats').innerHTML;
    
    const printWindow = window.open('', '_blank');
    
    const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>${reportTitle}</title>
            <style>
                @page { margin: 20px; }
                body { 
                    font-family: 'Arial', sans-serif; 
                    margin: 0; 
                    padding: 20px;
                    color: #333;
                }
                .header {
                    text-align: center;
                    margin-bottom: 30px;
                    border-bottom: 2px solid #4361ee;
                    padding-bottom: 20px;
                }
                .logo-container {
                    text-align: center;
                    margin-bottom: 20px;
                }
                .logo {
                    max-width: 150px;
                    height: auto;
                }
                .company-name {
                    font-size: 24px;
                    font-weight: bold;
                    color: #4361ee;
                    margin: 10px 0;
                }
                .report-title {
                    font-size: 20px;
                    color: #333;
                    margin: 10px 0;
                }
                .report-date {
                    color: #666;
                    font-size: 14px;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin: 20px 0;
                }
                th {
                    background-color: #4361ee;
                    color: white;
                    padding: 10px;
                    text-align: left;
                    font-weight: bold;
                }
                td {
                    padding: 8px 10px;
                    border-bottom: 1px solid #ddd;
                }
                tr:nth-child(even) {
                    background-color: #f8f9fa;
                }
                .stat-grid {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 15px;
                    margin: 20px 0;
                }
                .stat-item {
                    border: 1px solid #ddd;
                    border-radius: 8px;
                    padding: 15px;
                    text-align: center;
                }
                .stat-value {
                    font-size: 18px;
                    font-weight: bold;
                    margin: 10px 0;
                }
                .stat-label {
                    font-size: 12px;
                    color: #666;
                    text-transform: uppercase;
                }
                .footer {
                    margin-top: 50px;
                    text-align: center;
                    font-size: 12px;
                    color: #666;
                    border-top: 1px solid #ddd;
                    padding-top: 20px;
                }
                .text-success { color: #28a745; }
                .text-danger { color: #dc3545; }
                .text-primary { color: #4361ee; }
                .text-warning { color: #ffc107; }
            </style>
        </head>
        <body>
            <div class="header">
                <div class="logo-container">
                    <img src="/Akiltoys.png" alt="Akil Box Logo" class="logo">
                    <div class="company-name">Akil Box - O'yinchoqlar do'koni</div>
                </div>
                <div class="report-title">${reportTitle}</div>
                <div class="report-date">
                    Sana: ${new Date().toLocaleDateString('uz-UZ')} | 
                    Vaqt: ${new Date().toLocaleTimeString('uz-UZ', {hour: '2-digit', minute:'2-digit'})}
                </div>
            </div>
            
            <div>${reportContent}</div>
            
            <div class="footer">
                <p>Akil Box - O'yinchoqlar do'koni boshqaruvi</p>
                <p>${new Date().getFullYear()} © Akil Box</p>
            </div>
        </body>
        </html>
    `;
    
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    
    setTimeout(() => {
        printWindow.print();
        printWindow.close();
    }, 1000);
}

// Функции для уведомлений
const DokonNotifications = {
    notifications: [],
    unreadCount: 0
};

DokonApp.nasiyaData = {
    clients: [],
    sales: [],
    payments: [],
    reminders: [],
    cart: []
};

async function loadNasiyaData() {
    try {
        const [clientsRes, salesRes, paymentsRes, remindersRes] = await Promise.all([
            apiFetch('/nasiya/clients'),
            apiFetch('/nasiya/sales'),
            apiFetch('/nasiya/payments'),
            apiFetch('/nasiya/reminders')
        ]);
        
        if (clientsRes && clientsRes.success) DokonApp.nasiyaData.clients = clientsRes.clients;
        if (salesRes && salesRes.success) DokonApp.nasiyaData.sales = salesRes.sales;
        if (paymentsRes && paymentsRes.success) DokonApp.nasiyaData.payments = paymentsRes.payments;
        if (remindersRes && remindersRes.success) DokonApp.nasiyaData.reminders = remindersRes.reminders;
        
        updateNasiyaStatistics();
        renderNasiyaClientsTable();
        renderNasiyaRemindersTable();
    } catch (error) {
        console.error('Nasiya ma\'lumotlarini yuklashda xatolik:', error);
    }
}

function updateNasiyaStatistics() {
    const totalDebt = DokonApp.nasiyaData.clients.reduce((sum, client) => sum + (client.remainingDebt || 0), 0);
    const activeClients = DokonApp.nasiyaData.clients.filter(c => c.status === 'active').length;
    
    const today = new Date().toISOString().split('T')[0];
    const todayPayments = DokonApp.nasiyaData.payments
        .filter(p => p.paymentDate === today)
        .reduce((sum, p) => sum + (p.amount || 0), 0);
    
    const upcomingReminders = DokonApp.nasiyaData.reminders
        .filter(r => !r.completed && new Date(r.reminderDate) >= new Date(today)).length;
    
    const totalDebtEl = document.getElementById('totalNasiyaDebt');
    const activeClientsEl = document.getElementById('activeNasiyaClients');
    const todayPaymentsEl = document.getElementById('todayNasiyaPayments');
    const upcomingRemindersEl = document.getElementById('upcomingReminders');
    
    if (totalDebtEl) totalDebtEl.textContent = totalDebt.toLocaleString('uz-UZ') + ' UZS';
    if (activeClientsEl) activeClientsEl.textContent = activeClients;
    if (todayPaymentsEl) todayPaymentsEl.textContent = todayPayments.toLocaleString('uz-UZ') + ' UZS';
    if (upcomingRemindersEl) upcomingRemindersEl.textContent = upcomingReminders;
}

function renderNasiyaRemindersTable() {
    const container = document.getElementById('nasiyaRemindersTable');
    if (!container) {
        console.warn('Container nasiyaRemindersTable not found');
        return;
    }
  
    if (!DokonApp.nasiyaData || !DokonApp.nasiyaData.reminders) {
        console.error('Nasiya data or reminders not loaded');
        container.innerHTML = `
            <tr>
                <td colspan="9" class="text-center py-4 text-muted">
                    <i class="fas fa-exclamation-triangle fa-2x mb-3 d-block"></i>
                    Ma'lumotlar yuklanmadi
                </td>
            </tr>
        `;
        return;
    }
  
    const reminders = DokonApp.nasiyaData.reminders
        .filter(r => !r.completed)
        .sort((a, b) => new Date(a.reminderDate) - new Date(b.reminderDate));
  
    console.log('Filtered reminders:', reminders.length, reminders);
  
    if (reminders.length === 0) {
        container.innerHTML = `
            <tr>
                <td colspan="9" class="text-center py-4 text-muted">
                    <i class="fas fa-bell-slash fa-2x mb-3 d-block"></i>
                    Hozircha faol eslatmalar yo'q
                    <div class="small mt-2">
                        Jami eslatmalar: ${DokonApp.nasiyaData.reminders.length} ta
                    </div>
                </td>
            </tr>
        `;
        return;
    }
  
    const rows = reminders.map(reminder => {
        const client = DokonApp.nasiyaData.clients.find(c => c.id === reminder.clientId);
        const clientName = client ? client.name : 'Noma\'lum mijoz';
        const clientPhone = client ? (client.phone || 'Noma\'lum') : 'Noma\'lum';
        const remainingDebt = client ? (client.remainingDebt || 0) : 0;
        
        const reminderDate = new Date(reminder.reminderDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        let status = 'Kutilmoqda';
        let statusClass = 'bg-warning';
        
        if (reminderDate < today) {
            status = 'Kechikkan';
            statusClass = 'bg-danger';
        } else if (reminderDate.toDateString() === today.toDateString()) {
            status = 'Bugun';
            statusClass = 'bg-primary';
        }
        
        return `
            <tr>
                <td data-label="Tanlash"><input type="checkbox" class="reminder-checkbox" data-id="${reminder.id}"></td>
                <td data-label="Mijoz">
                    <strong>${escapeHtml(clientName)}</strong>
                    <br><small class="text-muted">${escapeHtml(clientPhone)}</small>
                </td>
                <td data-label="Telefon">${escapeHtml(clientPhone)}</td>
                <td data-label="To'lov sanasi" class="text-primary fw-bold">
                    ${reminderDate.toLocaleDateString('uz-UZ')}
                </td>
                <td data-label="Miqdor" class="fw-bold text-success">
                    ${(reminder.amount || 0).toLocaleString('uz-UZ')} UZS
                </td>
                <td data-label="Qoldiq" class="text-danger">
                    ${remainingDebt.toLocaleString('uz-UZ')} UZS
                </td>
                <td data-label="Holati">
                    <span class="badge ${statusClass}">${status}</span>
                </td>
                <td data-label="Eslatma">${escapeHtml(reminder.description) || 'To\'lov eslatmasi'}</td>
                <td data-label="Harakatlar">
                    <button class="btn btn-sm btn-success me-1" onclick="sendSingleReminder('${reminder.id}')" 
                            title="yuborish">
                        <i class="fas fa-paper-plane"></i>
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="deleteReminder('${reminder.id}')" 
                            title="O'chirish">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
  
    container.innerHTML = rows;
  
    const reminderCount = document.getElementById('reminderCount');
    if (reminderCount) {
        reminderCount.textContent = `${reminders.length} ta eslatma`;
    }
  
    const upcomingRemindersEl = document.getElementById('upcomingReminders');
    if (upcomingRemindersEl) {
        upcomingRemindersEl.textContent = reminders.length;
    }
}

async function sendSingleReminder(reminderId) {
    try {
        await apiFetch(`/nasiya/reminders/${reminderId}/send`, {
            method: 'POST'
        });
        
        showSuccess('Eslatma yuborildi');
        await loadNasiyaData();
    } catch (error) {
        showError('Eslatma yuborishda xatolik: ' + error.message);
    }
}

async function deleteReminder(reminderId) {
    if (!confirm('Bu eslatmani o\'chirishni tasdiqlaysizmi?')) return;
    
    try {
        await apiFetch(`/nasiya/reminders/${reminderId}`, {
            method: 'DELETE'
        });
        
        showSuccess('Eslatma o\'chirildi');
        await loadNasiyaData();
    } catch (error) {
        showError('Eslatmani o\'chirishda xatolik: ' + error.message);
    }
}

function toggleAllReminders() {
    const selectAll = document.getElementById('selectAllReminders');
    const checkboxes = document.querySelectorAll('.reminder-checkbox');
    
    checkboxes.forEach(checkbox => {
        checkbox.checked = selectAll.checked;
    });
}

// Автодополнение для выбора товара (nasiya)
let nasiyaProductAutocompleteInitialized = false;

function setupNasiyaProductAutocomplete() {
    if (nasiyaProductAutocompleteInitialized) return;

    const input = document.getElementById('nasiyaProductSearch');
    const hidden = document.getElementById('nasiyaProductId');
    const suggestions = document.getElementById('nasiyaProductSuggestions');

    if (!input || !hidden || !suggestions) return;

    document.addEventListener('click', function(e) {
        if (!input.contains(e.target) && !suggestions.contains(e.target)) {
            suggestions.style.display = 'none';
        }
    });

    input.addEventListener('input', function() {
        const searchTerm = this.value.trim().toLowerCase();
        const products = DokonApp.products || [];
        const filtered = products.filter(p =>
            (p.name.toLowerCase().includes(searchTerm) ||
             (p.article && p.article.toLowerCase().includes(searchTerm)))
        ).slice(0, 10);

        renderNasiyaProductSuggestions(filtered, suggestions, input, hidden);
    });

    input.addEventListener('blur', function() {
        setTimeout(() => {
            if (this.value.trim() === '') {
                hidden.value = '';
            }
        }, 200);
    });

    nasiyaProductAutocompleteInitialized = true;
}

function renderNasiyaProductSuggestions(products, suggestionsEl, inputEl, hiddenEl) {
    if (!products.length) {
        suggestionsEl.style.display = 'none';
        return;
    }

    let html = '';
    products.forEach(p => {
        const safeName = p.name.replace(/'/g, "\\'");
        const stockInfo = p.stock ? ` (qoldiq: ${p.stock})` : '';
        html += `<div onclick="selectNasiyaProduct('${p.id}', '${safeName}', ${p.price || 0}, '${hiddenEl.id}', '${inputEl.id}', '${suggestionsEl.id}')">
                    <strong>${p.name}</strong>${stockInfo}
                    <small class="text-muted"> ${p.article || ''}</small>
                 </div>`;
    });
    suggestionsEl.innerHTML = html;
    suggestionsEl.style.display = 'block';
}

window.selectNasiyaProduct = function(productId, productName, price, hiddenId, inputId, suggestionsId) {
    document.getElementById(hiddenId).value = productId;
    document.getElementById(inputId).value = productName;
    document.getElementById(suggestionsId).style.display = 'none';
    const priceInput = document.getElementById('nasiyaPrice');
    if (priceInput) priceInput.value = price;
};

function updateNasiyaClientInfo() {
    const clientId = document.getElementById('nasiyaSaleClientId').value;
    const client = DokonApp.nasiyaData.clients.find(c => c.id === clientId);
    const infoContainer = document.getElementById('selectedClientInfo');
    
    if (!client) {
        infoContainer.classList.add('d-none');
        return;
    }
    
    document.getElementById('currentClientDebt').textContent = 
        (client.remainingDebt || 0).toLocaleString('uz-UZ');
    
    const totalPaid = client.paidAmount || 0;
    document.getElementById('clientPreviousPayments').textContent = 
        `Oldingi to'lovlar: ${totalPaid.toLocaleString('uz-UZ')} UZS`;
    
    infoContainer.classList.remove('d-none');
}

function setupNasiyaClientAutocomplete() {
    if (window.nasiyaClientAutocompleteInitialized) return;

    const input = document.getElementById('nasiyaSaleClientSearch');
    const hidden = document.getElementById('nasiyaSaleClientId');
    const suggestions = document.getElementById('nasiyaSaleClientSuggestions');

    if (!input || !hidden || !suggestions) return;

    document.addEventListener('click', function(e) {
        if (!input.contains(e.target) && !suggestions.contains(e.target)) {
            suggestions.style.display = 'none';
        }
    });

    input.addEventListener('input', function() {
        const searchTerm = this.value.trim().toLowerCase();
        if (searchTerm.length < 1) {
            suggestions.style.display = 'none';
            hidden.value = '';
            return;
        }

        const clients = DokonApp.nasiyaData.clients || [];
        const filtered = clients.filter(c => 
            c.name.toLowerCase().includes(searchTerm) ||
            (c.phone && c.phone.toLowerCase().includes(searchTerm))
        ).slice(0, 10);

        renderNasiyaClientSuggestions(filtered, suggestions, input, hidden);
    });

    input.addEventListener('blur', function() {
        setTimeout(() => {
            if (this.value.trim() === '') {
                hidden.value = '';
            }
        }, 200);
    });

    window.nasiyaClientAutocompleteInitialized = true;
}

function renderNasiyaClientSuggestions(clients, suggestionsEl, inputEl, hiddenEl) {
    if (!clients.length) {
        suggestionsEl.style.display = 'none';
        return;
    }

    let html = '';
    clients.forEach(c => {
        const safeName = c.name.replace(/'/g, "\\'");
        html += `<div onclick="selectNasiyaClient('${c.id}', '${safeName}', '${hiddenEl.id}', '${inputEl.id}', '${suggestionsEl.id}')">
                    <strong>${c.name}</strong>
                    <small class="text-muted"> ${c.phone || ''}</small>
                 </div>`;
    });
    suggestionsEl.innerHTML = html;
    suggestionsEl.style.display = 'block';
}

window.selectNasiyaClient = function(clientId, clientName, hiddenId, inputId, suggestionsId) {
    document.getElementById(hiddenId).value = clientId;
    document.getElementById(inputId).value = clientName;
    document.getElementById(suggestionsId).style.display = 'none';
    if (typeof updateNasiyaClientInfo === 'function') {
        updateNasiyaClientInfo();
    }
};

function showAddNasiyaClientModal() {
    document.getElementById('editNasiyaClientId').value = '';
    document.getElementById('nasiyaClientName').value = '';
    document.getElementById('nasiyaClientPhone').value = '';
    document.getElementById('nasiyaClientAddress').value = '';
    document.getElementById('nasiyaClientDescription').value = '';
    
    new bootstrap.Modal(document.getElementById('nasiyaClientModal')).show();
}

function showCreateNasiyaSaleModal() {
    nasiyaCart = [];
    renderNasiyaCart();
    updateNasiyaCartTotal();

    const searchInput = document.getElementById('nasiyaSaleClientSearch');
    const hiddenId = document.getElementById('nasiyaSaleClientId');
    if (searchInput) searchInput.value = '';
    if (hiddenId) hiddenId.value = '';

    const infoContainer = document.getElementById('selectedClientInfo');
    if (infoContainer) infoContainer.classList.add('d-none');

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateInput = document.getElementById('nasiyaPaymentDate');
    if (dateInput) dateInput.value = tomorrow.toISOString().split('T')[0];

    document.getElementById('nasiyaSaleDescription').value = '';

    setupNasiyaClientAutocomplete();

    new bootstrap.Modal(document.getElementById('nasiyaSaleModal')).show();
}

function addToNasiyaCart() {
    const productId = document.getElementById('nasiyaProductId').value;
    const quantity = parseInt(document.getElementById('nasiyaQuantity').value) || 1;
    const price = parseInt(document.getElementById('nasiyaPrice').value) || 0;

    if (!productId || !price) {
        showError('Mahsulot va narxni tanlang');
        return;
    }

    const product = DokonApp.products.find(p => p.id === productId);
    if (!product) {
        showError('Mahsulot topilmadi');
        return;
    }

    if (quantity > (product.stock || 0)) {
        showError(`Omborda faqat ${product.stock || 0} dona mavjud`);
        return;
    }

    const total = quantity * price;
    const item = {
        id: Date.now().toString(),
        productId,
        productName: product.name,
        type: product.type,
        quantity,
        price,
        total,
        cost: product.cost || 0
    };

    nasiyaCart.push(item);
    renderNasiyaCart();
    updateNasiyaCartTotal();

    document.getElementById('nasiyaQuantity').value = 1;
    document.getElementById('nasiyaPrice').value = '';
}

function renderNasiyaCart() {
    const container = document.getElementById('nasiyaCartItems');
    if (!container) return;
    
    const rows = nasiyaCart.map((item, index) => `
        <tr>
            <td>${item.productName}</td>
            <td>${item.quantity}</td>
            <td>${item.price.toLocaleString('uz-UZ')} UZS</td>
            <td>${item.total.toLocaleString('uz-UZ')} UZS</td>
            <td>
                <button class="btn btn-sm btn-danger" onclick="removeFromNasiyaCart('${item.id}')">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
    
    container.innerHTML = rows || '<tr><td colspan="5" class="text-center">Mahsulotlar yo\'q</td></tr>';
}

function removeFromNasiyaCart(id) {
    nasiyaCart = nasiyaCart.filter(item => item.id !== id);
    renderNasiyaCart();
    updateNasiyaCartTotal();
}

function updateNasiyaCartTotal() {
    const total = nasiyaCart.reduce((sum, item) => sum + item.total, 0);
    const totalEl = document.getElementById('nasiyaCartTotal');
    if (totalEl) {
        totalEl.textContent = total.toLocaleString('uz-UZ') + ' UZS';
    }
}

async function confirmNasiyaSale() {
    const clientId = document.getElementById('nasiyaSaleClientId').value;
    const paymentDate = document.getElementById('nasiyaPaymentDate').value;
    const description = document.getElementById('nasiyaSaleDescription').value.trim();

    if (!clientId) {
        showError('Mijozni tanlang');
        return;
    }

    if (!paymentDate) {
        showError('To\'lov sanasini kiriting');
        return;
    }

    if (nasiyaCart.length === 0) {
        showError('Kamida 1 ta mahsulot qo\'shing');
        return;
    }

    const client = DokonApp.nasiyaData.clients.find(c => c.id === clientId);
    if (!client) {
        showError('Mijoz topilmadi');
        return;
    }

    const totalAmount = nasiyaCart.reduce((sum, item) => sum + item.total, 0);

    try {
        const insufficient = [];
        for (const item of nasiyaCart) {
            const product = DokonApp.products.find(p => p.id === item.productId);
            const stock = product ? (product.stock || 0) : 0;
            if (stock < item.quantity) {
                insufficient.push(`${item.productName} (so'rov: ${item.quantity}, mavjud: ${stock})`);
            }
        }

        if (insufficient.length > 0) {
            showError('Omborda yetarli mahsulot yo\'q: ' + insufficient.join('; '));
            return;
        }

        const saleResponse = await apiFetch('/nasiya/sales', {
            method: 'POST',
            body: {
                clientId,
                items: nasiyaCart,
                totalAmount,
                paymentDate,
                description
            }
        });

        if (!saleResponse || !saleResponse.success) {
            throw new Error(saleResponse?.message || 'Nasiya sotishda xatolik');
        }

        await apiFetch('/nasiya/reminders', {
            method: 'POST',
            body: {
                clientId,
                saleId: saleResponse.sale.id,
                reminderDate: paymentDate,
                amount: totalAmount,
                description: description || `Nasiya to'lovi: ${totalAmount.toLocaleString('uz-UZ')} UZS`
            }
        });

        const errors = [];
        for (const item of nasiyaCart) {
            const product = DokonApp.products.find(p => p.id === item.productId);
            
            try {
                await apiFetch('/sales', {
                    method: 'POST',
                    body: {
                        productId: item.productId,
                        productName: item.productName,
                        productType: item.type,
                        quantity: item.quantity,
                        price: item.price,
                        cost: item.cost,
                        date: new Date().toISOString().split('T')[0],
                        total: item.total,
                        profit: (item.price - item.cost) * item.quantity,
                        nasiyaSaleId: saleResponse.sale.id,
                        nasiyaClientId: clientId
                    }
                });
            } catch (e) {
                console.error('Sotish yozishda xatolik:', e);
                errors.push(`${item.productName}: ${e.message || e}`);
            }
        }

        if (errors.length === 0) {
            showSuccess('Nasiya sotish muvaffaqiyatli amalga oshirildi');
            
            createNotification(
                'Yangi nasiya eslatmasi',
                `${client.name} uchun ${paymentDate} sanasida ${totalAmount.toLocaleString('uz-UZ')} UZS miqdorida to'lov eslatmasi qo'shildi`,
                'reminder',
                'medium',
                'goto_nasiya',
                saleResponse.sale.id
            );
            
            const modal = bootstrap.Modal.getInstance(document.getElementById('nasiyaSaleModal'));
            if (modal) modal.hide();
            
            await Promise.all([
                loadProducts(),
                loadSales(),
                loadNasiyaData(),
                loadNotifications()
            ]);
            
            nasiyaCart = [];
            
        } else {
            showError('Qisman xatoliklar: ' + errors.join('; '));
        }

    } catch (error) {
        console.error('Nasiya sotishda xatolik:', error);
        showError('Nasiya sotishda xatolik: ' + error.message);
    }
}

async function saveNasiyaClient() {
    const clientId = document.getElementById('editNasiyaClientId').value;
    const name = document.getElementById('nasiyaClientName').value.trim();
    const phone = document.getElementById('nasiyaClientPhone').value.trim();
    const address = document.getElementById('nasiyaClientAddress').value.trim();
    const description = document.getElementById('nasiyaClientDescription').value.trim();
    
    if (!name || !phone) {
        showError('Ism va telefonni kiriting');
        return;
    }
    
    try {
        const clientData = { name, phone, address, description, status: 'active' };
        
        let response;
        
        if (clientId) {
            response = await apiFetch(`/nasiya/clients/${clientId}`, {
                method: 'PUT',
                body: clientData
            });
        } else {
            response = await apiFetch('/nasiya/clients', {
                method: 'POST',
                body: clientData
            });
        }
        
        if (response && response.success) {
            showSuccess('Mijoz muvaffaqiyatli saqlandi');
            await loadNasiyaData();
            
            const modal = bootstrap.Modal.getInstance(document.getElementById('nasiyaClientModal'));
            if (modal) modal.hide();
        }
    } catch (error) {
        showError('Mijozni saqlashda xatolik: ' + error.message);
    }
}

function addPaymentToClient(clientId) {
    const client = DokonApp.nasiyaData.clients.find(c => c.id === clientId);
    if (!client) return;
    
    document.getElementById('paymentClientId').value = clientId;
    document.getElementById('paymentClientName').value = client.name;
    document.getElementById('paymentRemainingDebt').textContent = client.remainingDebt.toLocaleString('uz-UZ') + ' UZS';
    document.getElementById('paymentAmount').value = '';
    document.getElementById('paymentDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('paymentMethod').value = 'cash';
    document.getElementById('paymentDescription').value = '';
    
    new bootstrap.Modal(document.getElementById('nasiyaPaymentModal')).show();
}

async function processNasiyaPayment() {
    const clientId = document.getElementById('paymentClientId').value;
    const amount = parseFloat(document.getElementById('paymentAmount').value);
    const date = document.getElementById('paymentDate').value;
    const method = document.getElementById('paymentMethod').value;
    const description = document.getElementById('paymentDescription').value.trim();
    
    if (!amount || amount <= 0) {
        showError('To\'g\'ri miqdorni kiriting');
        return;
    }
    
    const client = DokonApp.nasiyaData.clients.find(c => c.id === clientId);
    if (!client) {
        showError('Mijoz topilmadi');
        return;
    }
    
    if (amount > client.remainingDebt) {
        showError('To\'lov miqdori qarzdan katta bo\'lishi mumkin emas');
        return;
    }
    
    try {
        const activeSale = DokonApp.nasiyaData.sales
            .filter(s => s.clientId === clientId && s.status === 'pending')
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
        
        if (!activeSale) {
            showError('Faol nasiya topilmadi');
            return;
        }
        
        const response = await apiFetch('/nasiya/payments', {
            method: 'POST',
            body: {
                clientId,
                saleId: activeSale.id,
                amount,
                paymentDate: date,
                paymentMethod: method,
                description
            }
        });
        
        if (response && response.success) {
            showSuccess('To\'lov muvaffaqiyatli qabul qilindi');
            
            createNotification(
                'Nasiya to\'lovi',
                `${client.name} uchun ${amount.toLocaleString('uz-UZ')} UZS miqdorda to'lov qabul qilindi`,
                'payment',
                'success',
                'goto_nasiya',
                response.payment.id
            );
            
            const modal = bootstrap.Modal.getInstance(document.getElementById('nasiyaPaymentModal'));
            if (modal) modal.hide();
            
            await loadNasiyaData();
        }
    } catch (error) {
        showError('To\'lovni qabul qilishda xatolik: ' + error.message);
    }
}

function updateNasiyaStatistics() {
    const totalDebt = DokonApp.nasiyaData.clients.reduce((sum, client) => sum + (client.remainingDebt || 0), 0);
    const activeClients = DokonApp.nasiyaData.clients.filter(c => c.status === 'active').length;
    
    const today = new Date().toISOString().split('T')[0];
    const todayPayments = DokonApp.nasiyaData.payments
        .filter(p => p.paymentDate === today)
        .reduce((sum, p) => sum + (p.amount || 0), 0);
    
    const upcomingReminders = DokonApp.nasiyaData.reminders
        .filter(r => !r.completed && new Date(r.reminderDate) >= new Date(today)).length;
    
    const totalDebtEl = document.getElementById('totalNasiyaDebt');
    const activeClientsEl = document.getElementById('activeNasiyaClients');
    const todayPaymentsEl = document.getElementById('todayNasiyaPayments');
    const upcomingRemindersEl = document.getElementById('upcomingReminders');
    
    if (totalDebtEl) totalDebtEl.textContent = totalDebt.toLocaleString('uz-UZ') + ' UZS';
    if (activeClientsEl) activeClientsEl.textContent = activeClients;
    if (todayPaymentsEl) todayPaymentsEl.textContent = todayPayments.toLocaleString('uz-UZ') + ' UZS';
    if (upcomingRemindersEl) upcomingRemindersEl.textContent = upcomingReminders;
}

// Загрузка уведомлений
async function loadNotifications() {
    try {
        const data = await apiFetch('/notifications');
        if (data.success) {
            DokonNotifications.notifications = data.notifications || [];
            DokonNotifications.unreadCount = DokonNotifications.notifications.filter(n => !n.read).length;
            updateNotificationUI();
        }
    } catch (error) {
        console.error('Ошибка загрузки уведомлений:', error);
        DokonNotifications.notifications = [];
        DokonNotifications.unreadCount = 0;
    }
}

function updateNotificationUI() {
    const countElement = document.getElementById('notificationCount');
    const listElement = document.getElementById('notificationsList');
    const dropdownElement = document.querySelector('.dropdown-menu.notifications-dropdown');
    
    if (countElement) {
        countElement.textContent = DokonNotifications.unreadCount;
        countElement.style.display = DokonNotifications.unreadCount > 0 ? 'block' : 'none';
    }
    
    if (dropdownElement) {
        dropdownElement.style.maxHeight = '600px';
        dropdownElement.style.width = '500px';
        dropdownElement.style.overflowY = 'auto';
        dropdownElement.style.padding = '10px';
    }
    
    if (listElement) {
        if (DokonNotifications.notifications.length === 0) {
            listElement.innerHTML = `
                <div class="px-3 py-4 text-center text-muted">
                    <i class="fas fa-bell-slash fa-3x mb-3 d-block opacity-50"></i>
                    <h6 class="mb-2">Hozircha bildirishnomalar yo'q</h6>
                    <p class="small">Yangiliklarni birinchi bo'lib bilib olish uchun bu yerda bo'ling</p>
                </div>
            `;
            return;
        }
        
        const recentNotifications = DokonNotifications.notifications.slice(0, 15);
        
        const headerHtml = `
            <div class="notification-header p-3 border-bottom">
                <div class="d-flex justify-content-between align-items-center">
                    <h6 class="mb-0 fw-bold">
                        <i class="fas fa-bell me-2"></i>Bildirishnomalar
                        ${DokonNotifications.unreadCount > 0 ? 
                            `<span class="badge bg-danger ms-2">${DokonNotifications.unreadCount} yangi</span>` : ''
                        }
                    </h6>
                    <div class="btn-group">
                        <button class="btn btn-sm btn-outline-secondary" onclick="markAllNotificationsRead()" title="Barchasini o'qilgan qilish">
                            <i class="fas fa-check-double"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger" onclick="clearAllNotifications()" title="Barchasini tozalash">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        const notificationsHtml = recentNotifications.map(notification => {
            const timeAgo = getTimeAgo(notification.createdAt);
            const iconClass = getNotificationIcon(notification.type);
            const textClass = notification.read ? 'text-muted' : 'text-dark';
            const badgeClass = notification.priority === 'high' ? 'danger' : 
                              notification.priority === 'medium' ? 'warning' : 'info';
            
            return `
                <li>
                    <a class="dropdown-item notification-item ${!notification.read ? 'unread' : ''} p-3" 
                       href="javascript:void(0)" onclick="handleNotificationClick('${notification.id}')">
                        <div class="d-flex">
                            <div class="flex-shrink-0 me-3">
                                <div class="notification-icon ${notification.read ? 'read' : badgeClass}">
                                    <i class="fas ${iconClass}"></i>
                                </div>
                            </div>
                            <div class="flex-grow-1">
                                <div class="d-flex justify-content-between align-items-start mb-1">
                                    <h6 class="mb-0 ${textClass} fw-semibold" style="font-size: 14px;">${notification.title}</h6>
                                </div>
                                <p class="mb-1 ${textClass}" style="font-size: 13px; line-height: 1.4;">${notification.message}</p>
                                <div class="d-flex justify-content-between align-items-center">
                                    <small class="text-muted">${timeAgo}</small>
                                    ${!notification.read ? 
                                        `<span class="badge bg-${badgeClass} badge-dot"></span>` : ''
                                    }
                                </div>
                            </div>
                        </div>
                    </a>
                </li>
            `;
        }).join('');
        
        const footerHtml = `
            <div class="notification-footer p-3 border-top">
                <div class="d-flex justify-content-between align-items-center">
                    <small class="text-muted">${DokonNotifications.notifications.length} ta bildirishnoma</small>
                    <button class="btn btn-sm btn-outline-primary" onclick="showNotificationsModal()">
                        <i class="fas fa-eye me-1"></i>Barchasini ko'rish
                    </button>
                </div>
            </div>
        `;
        
        listElement.innerHTML = headerHtml + notificationsHtml + footerHtml;
    }
}

async function markAllNotificationsRead() {
    try {
        await apiFetch('/notifications/read-all', {
            method: 'PUT'
        });
        
        DokonNotifications.notifications.forEach(n => n.read = true);
        DokonNotifications.unreadCount = 0;
        updateNotificationUI();
        showSuccess('Barcha bildirishnomalar o\'qilgan qilindi');
    } catch (error) {
        showError('Bildirishnomalarni yangilashda xatolik: ' + error.message);
    }
}

function getNotificationIcon(type) {
    const icons = {
        'sale': 'fa-cash-register',
        'warehouse': 'fa-warehouse',
        'stock_low': 'fa-exclamation-triangle',
        'stock_out': 'fa-times-circle',
        'payment': 'fa-money-bill-wave',
        'invoice': 'fa-receipt',
        'system': 'fa-cogs',
        'user': 'fa-user',
        'reminder': 'fa-clock'
    };
    return icons[type] || 'fa-bell';
}

function getTimeAgo(timestamp) {
    if (!timestamp) return 'Noma\'lum vaqt';
    
    const now = new Date();
    const past = new Date(timestamp);
    const diffMs = now - past;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Hozir';
    if (diffMins < 60) return `${diffMins} min oldin`;
    if (diffHours < 24) return `${diffHours} soat oldin`;
    if (diffDays < 7) return `${diffDays} kun oldin`;
    
    return past.toLocaleDateString('uz-UZ', { 
        day: 'numeric', 
        month: 'short' 
    });
}

async function handleNotificationClick(notificationId) {
    try {
        await apiFetch(`/notifications/${notificationId}/read`, {
            method: 'PUT'
        });
        
        const notification = DokonNotifications.notifications.find(n => n.id === notificationId);
        if (notification && !notification.read) {
            notification.read = true;
            DokonNotifications.unreadCount--;
            updateNotificationUI();
        }
        
        const notif = DokonNotifications.notifications.find(n => n.id === notificationId);
        if (notif) {
            switch(notif.action) {
                case 'goto_product':
                    if (notif.productId) {
                        const product = DokonApp.products.find(p => p.id === notif.productId);
                        if (product) {
                            const tab = product.type === 'akitoy' ? 'akilbox' : 'akilbox';
                            document.querySelector(`a[href="#${tab}"]`).click();
                        }
                    }
                    break;
                case 'goto_warehouse':
                    document.querySelector('a[href="#warehouse"]').click();
                    break;
                case 'goto_reports':
                    document.querySelector('a[href="#reports"]').click();
                    break;
                default:
            }
        }
    } catch (error) {
        console.error('Ошибка обработки уведомления:', error);
    }
}

async function clearAllNotifications() {
    if (!confirm('Barcha bildirishnomalarni tozalashni tasdiqlaysizmi?')) return;
    
    try {
        await apiFetch('/notifications', {
            method: 'DELETE'
        });
        
        DokonNotifications.notifications = [];
        DokonNotifications.unreadCount = 0;
        updateNotificationUI();
        showSuccess('Barcha bildirishnomalar tozalandi');
    } catch (error) {
        showError('Bildirishnomalarni tozalashda xatolik: ' + error.message);
    }
}

async function deleteNotification(notificationId) {
    if (!confirm('Bu bildirishnomani o\'chirishni tasdiqlaysizmi?')) return;
    
    try {
        await apiFetch(`/notifications/${notificationId}`, {
            method: 'DELETE'
        });
        
        DokonNotifications.notifications = DokonNotifications.notifications.filter(
            n => n.id !== notificationId
        );
        DokonNotifications.unreadCount = DokonNotifications.notifications.filter(n => !n.read).length;
        updateNotificationUI();
        showSuccess('Bildirishnoma o\'chirildi');
    } catch (error) {
        showError('Bildirishnomani o\'chirishda xatolik: ' + error.message);
    }
}

async function clearReadNotifications() {
    if (!confirm('Barcha o\'qilgan bildirishnomalarni tozalashni tasdiqlaysizmi?')) return;
    
    try {
        await apiFetch('/notifications/read/clear', {
            method: 'DELETE'
        });
        
        DokonNotifications.notifications = DokonNotifications.notifications.filter(n => !n.read);
        DokonNotifications.unreadCount = DokonNotifications.notifications.length;
        updateNotificationUI();
        showSuccess('O\'qilgan bildirishnomalar tozalandi');
    } catch (error) {
        showError('Bildirishnomalarni tozalashda xatolik: ' + error.message);
    }
}

async function createNotification(title, message, type = 'system', priority = 'low', action = null, entityId = null) {
    try {
        const notificationData = {
            title,
            message,
            type,
            priority,
            action,
            entityId,
            entityType: type
        };
        
        const response = await apiFetch('/notifications', {
            method: 'POST',
            body: notificationData
        });
        
        if (response.success) {
            DokonNotifications.notifications.unshift({
                ...notificationData,
                id: response.notification.id,
                read: false,
                createdAt: new Date().toISOString()
            });
            DokonNotifications.unreadCount++;
            updateNotificationUI();
            
            if (priority === 'high' || priority === 'medium') {
                showNotificationToast(title, message, type);
            }
        }
    } catch (error) {
        console.error('Ошибка создания уведомления:', error);
    }
}

function showNotificationsModal() {
    const oldModals = document.querySelectorAll('.modal-backdrop, .modal');
    oldModals.forEach(el => {
        if (el.id !== 'reportModal' && el.id !== 'pdfPreviewModal' && el.id !== 'nasiyaClientDetailsModal') {
            el.remove();
        }
    });
    
    const existingModal = document.getElementById('notificationsModal');
    if (existingModal) {
        existingModal.remove();
    }
    
    const modalHTML = `
        <div class="modal fade" id="notificationsModal" tabindex="-1">
            <div class="modal-dialog modal-xl" style="max-width: 95vw; height: 95vh;">
                <div class="modal-content h-100">
                    <div class="modal-header bg-primary text-white">
                        <h5 class="modal-title">
                            <i class="fas fa-bell me-2"></i>Barcha bildirishnomalar
                            ${DokonNotifications.unreadCount > 0 ? 
                                `<span class="badge bg-danger ms-2">${DokonNotifications.unreadCount} yangi</span>` : ''
                            }
                        </h5>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" 
                                onclick="closeNotificationsModal()"></button>
                    </div>
                    <div class="modal-body p-0" style="overflow-y: auto; height: calc(95vh - 120px);">
                        <div id="allNotificationsList" class="p-3"></div>
                    </div>
                    <div class="modal-footer">
                        <div class="d-flex flex-wrap gap-2">
                            <button class="btn btn-success" onclick="markAllNotificationsRead()">
                                <i class="fas fa-check-double me-2"></i>Barchasini o'qilgan qilish
                            </button>
                            <button class="btn btn-danger" onclick="clearAllNotifications()">
                                <i class="fas fa-trash me-2"></i>Barchasini tozalash
                            </button>
                            <button class="btn btn-secondary" onclick="clearReadNotifications()">
                                <i class="fas fa-eye-slash me-2"></i>O'qilganlarni tozalash
                            </button>
                            <button class="btn btn-info" onclick="loadNotifications(); renderAllNotifications();">
                                <i class="fas fa-sync me-2"></i>Yangilash
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    const modalElement = document.getElementById('notificationsModal');
    const modal = new bootstrap.Modal(modalElement);
    
    modalElement.addEventListener('hidden.bs.modal', function () {
        setTimeout(() => {
            if (modalElement) {
                modalElement.remove();
            }
            const backdrops = document.querySelectorAll('.modal-backdrop');
            backdrops.forEach(backdrop => backdrop.remove());
            document.body.style.overflow = 'auto';
            document.body.style.paddingRight = '0';
        }, 300);
    });
    
    modal.show();
    renderAllNotifications();
}

function closeNotificationsModal() {
    const modalElement = document.getElementById('notificationsModal');
    if (modalElement) {
        const modal = bootstrap.Modal.getInstance(modalElement);
        if (modal) {
            modal.hide();
        } else {
            modalElement.remove();
            const backdrops = document.querySelectorAll('.modal-backdrop');
            backdrops.forEach(backdrop => backdrop.remove());
            document.body.style.overflow = 'auto';
            document.body.style.paddingRight = '0';
        }
    }
}

function renderAllNotifications() {
    const container = document.getElementById('allNotificationsList');
    if (!container) return;
    
    if (!DokonNotifications.notifications || DokonNotifications.notifications.length === 0) {
        container.innerHTML = `
            <div class="text-center py-5 text-muted" style="min-height: 300px;">
                <i class="fas fa-bell-slash fa-4x mb-4 d-block opacity-50"></i>
                <h4 class="mb-3">Hozircha bildirishnomalar yo'q</h4>
                <p class="text-muted">Yangiliklarni birinchi bo'lib bilib olish uchun bu yerda bo'ling</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = DokonNotifications.notifications.map(notification => `
        <div class="card mb-3 ${!notification.read ? 'border-primary' : ''}">
            <div class="card-body">
                <div class="d-flex">
                    <div class="flex-shrink-0 me-3">
                        <div class="notification-icon-large ${notification.read ? 'read' : notification.priority}">
                            <i class="fas ${getNotificationIcon(notification.type)} fa-2x"></i>
                        </div>
                    </div>
                    <div class="flex-grow-1">
                        <div class="d-flex justify-content-between align-items-start mb-2">
                            <h5 class="mb-0 ${!notification.read ? 'fw-bold' : ''}">${escapeHtml(notification.title)}</h5>
                            <div class="btn-group">
                                <button class="btn btn-sm btn-link text-muted" 
                                        onclick="deleteNotification('${notification.id}')"
                                        title="O'chirish">
                                    <i class="fas fa-times"></i>
                                </button>
                            </div>
                        </div>
                        <p class="mb-2 fs-6">${escapeHtml(notification.message)}</p>
                        <div class="d-flex justify-content-between align-items-center mt-3">
                            <div>
                                <small class="text-muted">
                                    <i class="fas fa-clock me-1"></i>${getTimeAgo(notification.createdAt)}
                                    ${notification.productName ? ` • <i class="fas fa-box ms-2 me-1"></i>${escapeHtml(notification.productName)}` : ''}
                                    ${notification.amount > 0 ? ` • <i class="fas fa-money-bill ms-2 me-1"></i>${notification.amount?.toLocaleString('uz-UZ') || 0} UZS` : ''}
                                </small>
                            </div>
                            <div>
                                ${!notification.read ? 
                                    `<span class="badge bg-${notification.priority === 'high' ? 'danger' : notification.priority === 'medium' ? 'warning' : 'info'}">
                                        Yangi
                                    </span>` : ''
                                }
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
}

function checkDebtNotifications() {
    const debt = DokonApp.warehouseData.currentDebt || 0;
    if (debt > 1000000) {
        const notificationExists = DokonNotifications.notifications.some(n => 
            n.entityId === 'akitoy' && n.type === 'payment' && !n.read
        );
        
        if (!notificationExists) {
            createNotification(
                'Katta qarzdorlik!',
                `Akil Box uchun qarzdorlik ${debt.toLocaleString('uz-UZ')} UZS. To'lov qilishni unutmang!`,
                'payment',
                'high',
                'goto_warehouse',
                'akitoy'
            );
        }
    }
}

async function initializeNotifications() {
    await loadNotifications();
    
    addNotificationsButton();
    initWarehouseAutocomplete(
        'warehouseAkitoyProductSearch',
        'warehouseAkitoyProductId',
        'warehouseAkitoySuggestions',
        'akitoy'
    );
    
    setInterval(async () => {
        await loadNotifications();
        checkNasiyaReminders();
    }, 300000);
    
    checkDebtNotifications();
}

async function confirmClearMonthReports() {
    const userData = localStorage.getItem('dokon_user');
    if (!userData) {
        showError('Avtorizatsiya talab qilinadi!');
        return;
    }
    
    const user = JSON.parse(userData);
    if (user.role !== 'superadmin' && user.role !== 'admin') {
        showError('Faqat administrator oy hisobotini tozalashi mumkin!');
        return;
    }
    
    const month = DokonApp.currentPeriod.month;
    const year = DokonApp.currentPeriod.year;
    const monthName = getMonthName(month);
    
    const confirmMsg = `${monthName} ${year} oyi hisobotini tozalashni tasdiqlaysizmi?\n\nBu amal:\n• Barcha sotuvlarni o'chiradi\n• Barcha hisob-fakturalarni o'chiradi\n• Ombordagi qarzdorlikni nolga tushiradi\n\nMahsulotlar ro'yxati saqlanib qoladi.`;
    
    if (!confirm(confirmMsg)) return;
    
    try {
        await apiFetch('/reports/clear-month', {
            method: 'POST',
            body: { month, year }
        });
        
        DokonApp.sales = DokonApp.sales.filter(sale => {
            if (!sale.date) return true;
            const saleDate = new Date(sale.date);
            return !(saleDate.getMonth() === month && saleDate.getFullYear() === year);
        });
        
        DokonApp.warehouseData.currentDebt = 0;
        
        showSuccess(`${monthName} ${year} oyi hisoboti tozalandi`);
        updateStatistics();
        renderAllTables();
        updateWarehouseDebtDisplay();
        
    } catch (error) {
        showError('Hisobotni tozalashda xatolik: ' + error.message);
    }
}

function downloadReport() {
    const modalTitle = document.getElementById('reportModalTitle').textContent;
    const reportContent = document.getElementById('reportStats').innerHTML;
    
    const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>${modalTitle}</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 20px; }
                h1 { color: #333; }
                table { width: 100%; border-collapse: collapse; margin: 20px 0; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                th { background-color: #f2f2f2; }
                .alert { padding: 15px; border-radius: 4px; margin: 10px 0; }
                .alert-primary { background-color: #e3f2fd; border: 1px solid #bbdefb; }
                .stat-card-small { border: 1px solid #ddd; padding: 15px; margin: 10px; border-radius: 5px; }
            </style>
        </head>
        <body>
            <h1>${modalTitle}</h1>
            <p>Sana: ${new Date().toLocaleDateString('uz-UZ')}</p>
            ${reportContent}
        </body>
        </html>
    `;
    
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${modalTitle.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function printReport() {
    const printContent = document.getElementById('reportStats').innerHTML;
    const title = document.getElementById('reportModalTitle').textContent;
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>${title}</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 20px; }
                h1 { color: #333; }
                table { width: 100%; border-collapse: collapse; margin: 20px 0; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                th { background-color: #f2f2f2; }
                @media print {
                    body { margin: 0; }
                    .no-print { display: none; }
                }
            </style>
        </head>
        <body>
            <h1>${title}</h1>
            <p>Sana: ${new Date().toLocaleDateString('uz-UZ')}</p>
            ${printContent}
            <div class="no-print">
                <button onclick="window.print()" style="padding: 10px 20px; margin: 20px;">Chop etish</button>
                <button onclick="window.close()" style="padding: 10px 20px; margin: 20px;">Yopish</button>
            </div>
        </body>
        </html>
    `);
    printWindow.document.close();
}

function printInvoice() {
    window.print();
}

function setupInvoiceProductAutocomplete() {
    if (window.invoiceProductAutocompleteInitialized) return;

    const input = document.getElementById('invoiceProductSearch');
    const hidden = document.getElementById('invoiceProductId');
    const suggestions = document.getElementById('invoiceProductSuggestions');
    const typeSelect = document.getElementById('invoiceProductType');
    const priceInput = document.getElementById('invoicePrice');

    if (!input || !hidden || !suggestions || !typeSelect) return;

    let selectedIndex = -1;
    let currentItems = [];

    function highlightItem(index) {
        const items = suggestions.querySelectorAll('.suggestion-item');
        items.forEach((item, i) => {
            if (i === index) {
                item.classList.add('selected');
                item.scrollIntoView({ block: 'nearest' });
            } else {
                item.classList.remove('selected');
            }
        });
    }

    function closeSuggestions() {
        suggestions.style.display = 'none';
        selectedIndex = -1;
    }

    input.addEventListener('input', function() {
        const searchTerm = this.value.trim().toLowerCase();
        const type = typeSelect.value;

        if (searchTerm.length < 1) {
            closeSuggestions();
            hidden.value = '';
            return;
        }

        const products = DokonApp.products || [];
        const filtered = products.filter(p =>
            p.type === type &&
            (p.name.toLowerCase().includes(searchTerm) ||
             (p.article && p.article.toLowerCase().includes(searchTerm)))
        ).slice(0, 10);

        if (filtered.length === 0) {
            closeSuggestions();
            return;
        }

        currentItems = filtered;

        suggestions.innerHTML = filtered.map(p => {
            const stockInfo = p.stock ? ` (qoldiq: ${p.stock})` : '';
            return `<div class="suggestion-item p-2 border-bottom" data-id="${p.id}" data-name="${p.name}" data-price="${p.price || 0}">${p.name}${stockInfo} <small class="text-muted">${p.article || ''}</small></div>`;
        }).join('');

        suggestions.style.display = 'block';
        selectedIndex = -1;
    });

    input.addEventListener('keydown', function(e) {
        if (suggestions.style.display !== 'block') return;

        const items = suggestions.querySelectorAll('.suggestion-item');
        if (items.length === 0) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (selectedIndex < items.length - 1) {
                selectedIndex++;
            } else {
                selectedIndex = 0;
            }
            highlightItem(selectedIndex);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (selectedIndex > 0) {
                selectedIndex--;
            } else {
                selectedIndex = items.length - 1;
            }
            highlightItem(selectedIndex);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (selectedIndex >= 0 && selectedIndex < items.length) {
                const selected = items[selectedIndex];
                const productId = selected.dataset.id;
                const productName = selected.dataset.name;
                const productPrice = selected.dataset.price;

                input.value = productName;
                hidden.value = productId;
                if (priceInput) priceInput.value = productPrice;
                closeSuggestions();
            }
        } else if (e.key === 'Tab') {
            closeSuggestions();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            closeSuggestions();
        }
    });

    document.addEventListener('click', function(e) {
        if (!input.contains(e.target) && !suggestions.contains(e.target)) {
            closeSuggestions();
        }
    });

    suggestions.addEventListener('click', function(e) {
        const target = e.target.closest('.suggestion-item');
        if (!target) return;

        const productId = target.dataset.id;
        const productName = target.dataset.name;
        const productPrice = target.dataset.price;

        input.value = productName;
        hidden.value = productId;
        if (priceInput) priceInput.value = productPrice;
        closeSuggestions();
    });

    typeSelect.addEventListener('change', function() {
        input.value = '';
        hidden.value = '';
        closeSuggestions();
    });

    window.invoiceProductAutocompleteInitialized = true;
}

function renderInvoiceProductSuggestions(products, suggestionsEl, inputEl, hiddenEl) {
    if (!products.length) {
        suggestionsEl.style.display = 'none';
        return;
    }

    let html = '';
    products.forEach(p => {
        const safeName = p.name.replace(/'/g, "\\'");
        const stockInfo = p.stock ? ` (qoldiq: ${p.stock})` : '';
        html += `<div onclick="selectInvoiceProduct('${p.id}', '${safeName}', ${p.price || 0}, '${hiddenEl.id}', '${inputEl.id}', '${suggestionsEl.id}')">
                    <strong>${p.name}</strong>${stockInfo}
                    <small class="text-muted"> ${p.article || ''}</small>
                 </div>`;
    });
    suggestionsEl.innerHTML = html;
    suggestionsEl.style.display = 'block';
}

window.selectInvoiceProduct = function(productId, productName, price, hiddenId, inputId, suggestionsId) {
    document.getElementById(hiddenId).value = productId;
    document.getElementById(inputId).value = productName;
    document.getElementById(suggestionsId).style.display = 'none';
    const priceInput = document.getElementById('invoicePrice');
    if (priceInput) priceInput.value = price;
};

function showServerError(title, message) {
    document.getElementById('errorTitle').textContent = title;
    document.getElementById('errorMessage').textContent = message;
    document.getElementById('errorDisplay').style.display = 'block';
    
    setTimeout(() => {
        document.getElementById('errorDisplay').style.display = 'none';
    }, 10000);
}

function showNasiyaPaymentModal(clientId) {
    const client = DokonApp.nasiyaData.clients.find(c => c.id === clientId);
    if (!client) return;
    
    document.getElementById('paymentNasiyaClientId').value = clientId;
    document.getElementById('paymentNasiyaClientName').value = client.name;
    document.getElementById('paymentNasiyaRemainingDebt').textContent = 
        (client.remainingDebt || 0).toLocaleString('uz-UZ') + ' UZS';
    document.getElementById('paymentNasiyaAmount').value = '';
    
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('paymentNasiyaDate').value = today;
    
    document.getElementById('paymentNasiyaMethod').value = 'cash';
    document.getElementById('paymentNasiyaDescription').value = '';
    
    new bootstrap.Modal(document.getElementById('nasiyaPaymentModal')).show();
}

async function sendRemindersToAllUsers() {
    const userData = localStorage.getItem('dokon_user');
    if (!userData) {
        showError('Avtorizatsiya talab qilinadi!');
        return;
    }
    
    const currentUser = JSON.parse(userData);
    
    if (currentUser.role === 'warehouse') {
        showError('Faqat sotuvchi, admin va superadmin eslatma yuborishi mumkin!');
        return;
    }
    
    if (!confirm('Barcha foydalanuvchilarga (warehouse dan tashqari) nasiya to\'lov eslatmalarini yuborishni tasdiqlaysizmi?')) {
        return;
    }
    
    try {
        const activeReminders = DokonApp.nasiyaData.reminders
            .filter(r => !r.completed);
        
        if (activeReminders.length === 0) {
            showError('Faol eslatmalar yo\'q');
            return;
        }
        
        const remindersByClient = {};
        activeReminders.forEach(reminder => {
            if (!remindersByClient[reminder.clientId]) {
                remindersByClient[reminder.clientId] = [];
            }
            remindersByClient[reminder.clientId].push(reminder);
        });
        
        let message = `Jami ${activeReminders.length} ta faol to'lov eslatmasi mavjud:\n\n`;
        
        Object.keys(remindersByClient).forEach(clientId => {
            const client = DokonApp.nasiyaData.clients.find(c => c.id === clientId);
            const clientName = client ? client.name : 'Noma\'lum mijoz';
            const reminders = remindersByClient[clientId];
            const totalAmount = reminders.reduce((sum, r) => sum + (r.amount || 0), 0);
            
            message += `${clientName}: ${reminders.length} ta eslatma, Jami: ${totalAmount.toLocaleString('uz-UZ')} UZS\n`;
        });
        
        const usersResponse = await apiFetch('/users');
        
        if (!usersResponse.success) {
            throw new Error(usersResponse.message || 'Foydalanuvchilarni olishda xatolik');
        }
        
        const allUsers = usersResponse.users || [];
        
        const usersToNotify = allUsers.filter(user => 
            user.role !== 'warehouse' && 
            user.status === 'active' &&
            user.id !== currentUser.id
        );
        
        if (usersToNotify.length === 0) {
            showError('Eslatma yuborish uchun foydalanuvchilar topilmadi');
            return;
        }
        
        let sentCount = 0;
        let failedCount = 0;
        
        for (const user of usersToNotify) {
            try {
                await apiFetch('/notifications', {
                    method: 'POST',
                    body: {
                        userId: user.id,
                        title: 'Nasiya to\'lov eslatmalari (barcha)',
                        message: message,
                        type: 'reminder',
                        priority: 'medium',
                        action: 'goto_nasiya'
                    }
                });
                sentCount++;
            } catch (error) {
                console.error(`Foydalanuvchiga eslatma yuborishda xatolik (${user.username}):`, error);
                failedCount++;
            }
        }
        
        createNotification(
            'Eslatmalar yuborildi',
            `${sentCount} ta foydalanuvchiga ${activeReminders.length} ta eslatma haqida xabar yuborildi. ${failedCount > 0 ? `${failedCount} ta xatolik yuz berdi.` : ''}`,
            'system',
            'success',
            null,
            null
        );
        
        showSuccess(`Eslatmalar muvaffaqiyatli yuborildi: ${sentCount} ta foydalanuvchi`);
        
    } catch (error) {
        console.error('Eslatma yuborishda xatolik:', error);
        showError('Eslatma yuborishda xatolik: ' + error.message);
    }
}

async function broadcastNotification(userId, notificationData) {
    try {
        const endpoint = userId ? `/notifications/user/${userId}` : '/notifications/broadcast';
        const method = 'POST';
        
        const response = await apiFetch(endpoint, {
            method: method,
            body: notificationData
        });
        
        return response;
    } catch (error) {
        console.error('Notification broadcast error:', error);
        throw error;
    }
}

async function processNasiyaPayment() {
    const clientId = document.getElementById('paymentNasiyaClientId').value;
    const amount = parseFloat(document.getElementById('paymentNasiyaAmount').value);
    const date = document.getElementById('paymentNasiyaDate').value;
    const method = document.getElementById('paymentNasiyaMethod').value;
    const description = document.getElementById('paymentNasiyaDescription').value.trim();
    
    if (!amount || amount <= 0 || isNaN(amount)) {
        showError('Iltimos, to\'g\'ri miqdorni kiriting');
        return;
    }
    
    const client = DokonApp.nasiyaData.clients.find(c => c.id === clientId);
    if (!client) {
        showError('Mijoz topilmadi');
        return;
    }
    
    if (amount > client.remainingDebt) {
        showError('To\'lov miqdori qarzdan katta bo\'lishi mumkin emas. Qarz: ' + 
                 client.remainingDebt.toLocaleString('uz-UZ') + ' UZS');
        return;
    }
    
    try {
        const activeSale = DokonApp.nasiyaData.sales
            .filter(s => s.clientId === clientId && s.status === 'pending')
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
        
        if (!activeSale) {
            showError('Faol nasiya topilmadi');
            return;
        }
        
        const response = await apiFetch('/nasiya/payments', {
            method: 'POST',
            body: {
                clientId,
                saleId: activeSale.id,
                amount,
                paymentDate: date,
                paymentMethod: method,
                description
            }
        });
        
        if (response && response.success) {
            showSuccess('To\'lov muvaffaqiyatli qabul qilindi');
            
            createNotification(
                'Nasiya to\'lovi',
                `${client.name} uchun ${amount.toLocaleString('uz-UZ')} UZS miqdorda to'lov qabul qilindi`,
                'payment',
                'success',
                'goto_nasiya',
                response.payment.id
            );
            
            const modal = bootstrap.Modal.getInstance(document.getElementById('nasiyaPaymentModal'));
            if (modal) modal.hide();
            
            await loadNasiyaData();
            
            renderNasiyaClientsTable();
            updateNasiyaStatistics();
        }
    } catch (error) {
        console.error('To\'lovni qabul qilishda xatolik:', error);
        showError('To\'lovni qabul qilishda xatolik: ' + error.message);
    }
}

function formatPaymentDate(dateStr, remainingDebt) {
    if (!dateStr) return '';
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const paymentDate = new Date(dateStr);
    paymentDate.setHours(0, 0, 0, 0);
    
    const diffTime = paymentDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (remainingDebt <= 0) {
        return `<span class="badge bg-success">To'langan</span>`;
    }
    
    if (diffDays < 0) {
        return `
            <div class="text-danger">
                <strong>${paymentDate.toLocaleDateString('uz-UZ')}</strong>
                <div class="small">${Math.abs(diffDays)} kun kechikdi!</div>
            </div>
        `;
    } else if (diffDays === 0) {
        return `
            <div class="text-warning">
                <strong>Bugun!</strong>
            </div>
        `;
    } else if (diffDays <= 3) {
        return `
            <div class="text-warning">
                <strong>${paymentDate.toLocaleDateString('uz-UZ')}</strong>
                <div class="small">${diffDays} kun qoldi</div>
            </div>
        `;
    } else if (diffDays <= 7) {
        return `
            <div class="text-info">
                <strong>${paymentDate.toLocaleDateString('uz-UZ')}</strong>
                <div class="small">${diffDays} kun qoldi</div>
            </div>
        `;
    } else {
        return `
            <div class="text-success">
                <strong>${paymentDate.toLocaleDateString('uz-UZ')}</strong>
                <div class="small">${diffDays} kun qoldi</div>
            </div>
        `;
    }
}

function renderNasiyaClientsTable() {
    const container = document.getElementById('nasiyaClientsTable');
    if (!container) return;
    
    let clients = DokonApp.nasiyaData.clients;

    if (nasiyaSearchTerm) {
        clients = clients.filter(client => 
            client.name.toLowerCase().includes(nasiyaSearchTerm) ||
            (client.phone && client.phone.toLowerCase().includes(nasiyaSearchTerm)) ||
            (client.address && client.address.toLowerCase().includes(nasiyaSearchTerm))
        );
    }

    clients.sort((a, b) => {
        if (a.remainingDebt <= 0 && b.remainingDebt > 0) return 1;
        if (a.remainingDebt > 0 && b.remainingDebt <= 0) return -1;
        if (!a.nextPaymentDate && b.nextPaymentDate) return 1;
        if (a.nextPaymentDate && !b.nextPaymentDate) return -1;
        
        if (a.nextPaymentDate && b.nextPaymentDate) {
            const dateA = new Date(a.nextPaymentDate);
            const dateB = new Date(b.nextPaymentDate);
            return dateA - dateB;
        }
        
        return 0;
    });

    if (clients.length === 0) {
        container.innerHTML = `
            <tr>
                <td colspan="10" class="text-center py-4 text-muted">
                    <i class="fas fa-users fa-2x mb-3 d-block"></i>
                    ${nasiyaSearchTerm ? 'Qidiruv bo\'yicha mijoz topilmadi' : 'Hozircha mijozlar yo\'q'}
                </td>
            </tr>
        `;
        return;
    }

    const rows = clients.map((client, index) => {
        const clientSales = DokonApp.nasiyaData.sales.filter(s => s.clientId === client.id);
        const productsCount = clientSales.reduce((count, sale) => count + (sale.items?.length || 0), 0);
        
        const lastPayment = DokonApp.nasiyaData.payments
            .filter(p => p.clientId === client.id)
            .sort((a, b) => new Date(b.paymentDate) - new Date(a.paymentDate))[0];
        
        const lastPaymentDate = lastPayment ? new Date(lastPayment.paymentDate).toLocaleDateString('uz-UZ') : 'Yo\'q';
        
        return `
            <tr ${client.remainingDebt > 0 && client.nextPaymentDate ? `class="${getPaymentRowClass(client.nextPaymentDate, client.remainingDebt)}"` : ''}>
                <td data-label="#">${index + 1}</td>
                <td data-label="Mijoz">
                    <strong>${escapeHtml(client.name)}</strong>
                    ${client.phone ? `<br><small class="text-muted">${escapeHtml(client.phone)}</small>` : ''}
                    ${productsCount > 0 ? `<br><small class="text-info">${productsCount} ta mahsulot</small>` : ''}
                </td>
                <td data-label="Telefon">${escapeHtml(client.phone || '-')}</td>
                <td data-label="Jami qarz" class="text-danger fw-bold">${(client.totalDebt || 0).toLocaleString('uz-UZ')} UZS</td>
                <td data-label="To'langan" class="text-success">${(client.paidAmount || 0).toLocaleString('uz-UZ')} UZS</td>
                <td data-label="Qoldiq">
                    <span class="badge ${client.remainingDebt > 0 ? 'bg-danger' : 'bg-success'}">
                        ${(client.remainingDebt || 0).toLocaleString('uz-UZ')} UZS
                    </span>
                </td>
                <td data-label="Holati">
                    <span class="badge ${client.status === 'active' ? 'bg-success' : 'bg-danger'}">
                        ${client.status === 'active' ? 'Faol' : 'Nofaol'}
                    </span>
                </td>
                <td data-label="Oxirgi to'lov">${lastPaymentDate}</td>
                <td data-label="Harakatlar">
                    <button class="btn btn-sm btn-info me-1 mb-1" onclick="showNasiyaClientDetails('${client.id}')" 
                            title="Mahsulotlar tarixi bilan ko'rish">
                        <i class="fas fa-history"></i>
                    </button>
                    <button class="btn btn-sm btn-success me-1 mb-1" onclick="showNasiyaPaymentModal('${client.id}')">
                        <i class="fas fa-money-bill-wave"></i>
                    </button>
                    <button class="btn btn-sm btn-warning me-1 mb-1" onclick="showCreateNasiyaSaleModalForClient('${client.id}')">
                        <i class="fas fa-plus"></i>
                    </button>
                    <button class="btn btn-sm btn-danger mb-1" onclick="deleteNasiyaClient('${client.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
    
    container.innerHTML = rows;
}

function getPaymentRowClass(nextPaymentDate, remainingDebt) {
    if (remainingDebt <= 0) return '';
    
    if (!nextPaymentDate) return '';
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const paymentDate = new Date(nextPaymentDate);
    paymentDate.setHours(0, 0, 0, 0);
    
    const diffTime = paymentDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
        return 'table-danger';
    } else if (diffDays <= 3) {
        return 'table-warning';
    } else if (diffDays <= 7) {
        return 'table-info';
    }
    
    return '';
}

async function showNasiyaClientDetails(clientId) {
    const client = DokonApp.nasiyaData.clients.find(c => c.id === clientId);
    if (!client) {
        showError('Mijoz topilmadi');
        return;
    }

    try {
        const clientData = await apiFetch(`/nasiya/clients/${clientId}`);
        if (!clientData.success) {
            throw new Error(clientData.message || 'Mijoz maʼlumotlarini olishda xatolik');
        }

        const { 
            client: clientDetails, 
            sales: clientSales, 
            payments: clientPayments,
            reminders: clientReminders
        } = clientData;

        let allProducts = [];
        let totalProductsValue = 0;
        
        if (clientSales && clientSales.length > 0) {
            clientSales.forEach(sale => {
                if (sale.items && sale.items.length > 0) {
                    sale.items.forEach(item => {
                        allProducts.push({
                            ...item,
                            saleDate: sale.createdAt || sale.paymentDate,
                            saleId: sale.id,
                            saleStatus: sale.status
                        });
                        totalProductsValue += item.total || 0;
                    });
                }
            });
        }

        allProducts.sort((a, b) => new Date(b.saleDate) - new Date(a.saleDate));

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const upcomingReminders = (clientReminders || [])
            .filter(r => !r.completed && new Date(r.reminderDate) >= today)
            .sort((a, b) => new Date(a.reminderDate) - new Date(b.reminderDate));

        const detailsHTML = `
            <div class="row">
                <div class="col-md-4">
                    <div class="card mb-3">
                        <div class="card-header bg-primary text-white">
                            <h6 class="mb-0"><i class="fas fa-user me-2"></i>Mijoz ma'lumotlari</h6>
                        </div>
                        <div class="card-body">
                            <table class="table table-sm">
                                <tr><th>Ism:</th><td>${escapeHtml(clientDetails.name)}</td></tr>
                                <tr><th>Telefon:</th><td>${escapeHtml(clientDetails.phone || '-')}</td></tr>
                                <tr><th>Manzil:</th><td>${escapeHtml(clientDetails.address || '-')}</td></tr>
                                <tr><th>Holati:</th><td><span class="badge ${clientDetails.status === 'active' ? 'bg-success' : 'bg-danger'}">${clientDetails.status === 'active' ? 'Faol' : 'Nofaol'}</span></td></tr>
                                <tr><th>Yaratilgan:</th><td>${new Date(clientDetails.createdAt).toLocaleDateString('uz-UZ')}</td></tr>
                            </table>
                        </div>
                    </div>
                </div>
                
                <div class="col-md-8">
                    <div class="row">
                        <div class="col-md-4">
                            <div class="card mb-3">
                                <div class="card-body text-center">
                                    <h6 class="text-muted">Jami qarz</h6>
                                    <h3 class="text-danger">${(clientDetails.totalDebt || 0).toLocaleString('uz-UZ')} UZS</h3>
                                </div>
                            </div>
                        </div>
                        <div class="col-md-4">
                            <div class="card mb-3">
                                <div class="card-body text-center">
                                    <h6 class="text-muted">To'langan</h6>
                                    <h3 class="text-success">${(clientDetails.paidAmount || 0).toLocaleString('uz-UZ')} UZS</h3>
                                </div>
                            </div>
                        </div>
                        <div class="col-md-4">
                            <div class="card mb-3">
                                <div class="card-body text-center">
                                    <h6 class="text-muted">Qolgan qarz</h6>
                                    <h3 class="${clientDetails.remainingDebt > 0 ? 'text-warning' : 'text-success'}">
                                        ${(clientDetails.remainingDebt || 0).toLocaleString('uz-UZ')} UZS
                                    </h3>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            ${upcomingReminders.length > 0 ? `
                <div class="row mt-3">
                    <div class="col-md-12">
                        <div class="card">
                            <div class="card-header bg-warning text-white">
                                <h6 class="mb-0"><i class="fas fa-calendar-day me-2"></i>To'lov eslatmalari</h6>
                            </div>
                            <div class="card-body">
                                <div class="table-responsive">
                                    <table class="table table-sm table-hover">
                                        <thead>
                                            <tr>
                                                <th>Sana</th>
                                                <th>Miqdor (UZS)</th>
                                                <th>Izoh</th>
                                                <th>Holat</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            ${upcomingReminders.map(r => {
                                                const daysLeft = Math.ceil((new Date(r.reminderDate) - new Date()) / (1000 * 60 * 60 * 24));
                                                let statusBadge = '';
                                                if (daysLeft < 0) statusBadge = '<span class="badge bg-danger">Kechikkan</span>';
                                                else if (daysLeft === 0) statusBadge = '<span class="badge bg-warning">Bugun</span>';
                                                else if (daysLeft <= 3) statusBadge = `<span class="badge bg-warning">${daysLeft} kun qoldi</span>`;
                                                else statusBadge = `<span class="badge bg-success">${daysLeft} kun qoldi</span>`;
                                                
                                                return `
                                                    <tr>
                                                        <td>${new Date(r.reminderDate).toLocaleDateString('uz-UZ')}</td>
                                                        <td class="fw-bold text-danger">${(r.amount || 0).toLocaleString('uz-UZ')}</td>
                                                        <td>${escapeHtml(r.description || '-')}</td>
                                                        <td>${statusBadge}</td>
                                                    </tr>
                                                `;
                                            }).join('')}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            ` : clientDetails.remainingDebt > 0 ? `
                <div class="row mt-3">
                    <div class="col-md-12">
                        <div class="alert alert-info">
                            <i class="fas fa-info-circle me-2"></i>Hozircha faol eslatmalar yoʻq.
                        </div>
                    </div>
                </div>
            ` : ''}
            
            <div class="row mt-3">
                <div class="col-md-12">
                    <div class="card">
                        <div class="card-header bg-info text-white d-flex justify-content-between align-items-center">
                            <h6 class="mb-0"><i class="fas fa-shopping-cart me-2"></i>Nasiya olingan mahsulotlar</h6>
                            <span class="badge bg-light text-dark">Jami qiymat: ${totalProductsValue.toLocaleString('uz-UZ')} UZS</span>
                        </div>
                        <div class="card-body">
                            ${allProducts.length > 0 ? `
                                <div class="table-responsive">
                                    <table class="table table-hover table-sm">
                                        <thead>
                                            <tr>
                                                <th>№</th>
                                                <th>Sana</th>
                                                <th>Mahsulot nomi</th>
                                                <th>Miqdor</th>
                                                <th>Narx (UZS)</th>
                                                <th>Jami (UZS)</th>
                                                <th>Holat</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            ${allProducts.map((product, index) => `
                                                <tr>
                                                    <td>${index + 1}</td>
                                                    <td>${new Date(product.saleDate).toLocaleDateString('uz-UZ')}</td>
                                                    <td><strong>${escapeHtml(product.productName)}</strong>${product.type ? `<br><small class="text-muted">${product.type === 'akitoy' ? 'Akil Box' : ''}</small>` : ''}</td>
                                                    <td>${product.quantity}</td>
                                                    <td>${(product.price || 0).toLocaleString('uz-UZ')}</td>
                                                    <td class="fw-bold">${(product.total || 0).toLocaleString('uz-UZ')}</td>
                                                    <td><span class="badge ${product.saleStatus === 'paid' ? 'bg-success' : 'bg-warning'}">${product.saleStatus === 'paid' ? "To'langan" : 'Kutilmoqda'}</span></td>
                                                </tr>
                                            `).join('')}
                                        </tbody>
                                        <tfoot class="table-secondary">
                                            <tr>
                                                <td colspan="5" class="text-end"><strong>Umumiy:</strong></td>
                                                <td><strong>${totalProductsValue.toLocaleString('uz-UZ')} UZS</strong></td>
                                                <td></td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            ` : '<div class="text-center py-4 text-muted"><i class="fas fa-box-open fa-2x mb-3 d-block"></i><p>Nasiya olingan mahsulotlar yoʻq</p></div>'}
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="row mt-3">
                <div class="col-md-12">
                    <div class="card">
                        <div class="card-header bg-success text-white">
                            <h6 class="mb-0"><i class="fas fa-money-bill-wave me-2"></i>To'lov tarixi</h6>
                        </div>
                        <div class="card-body">
                            ${clientPayments && clientPayments.length > 0 ? `
                                <div class="table-responsive">
                                    <table class="table table-sm table-hover">
                                        <thead>
                                            <tr>
                                                <th>Sana</th>
                                                <th>Miqdor</th>
                                                <th>To'lov usuli</th>
                                                <th>Izoh</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            ${clientPayments.map(payment => `
                                                <tr>
                                                    <td>${new Date(payment.paymentDate).toLocaleDateString('uz-UZ')}</td>
                                                    <td class="text-success fw-bold">${(payment.amount || 0).toLocaleString('uz-UZ')} UZS</td>
                                                    <td><span class="badge ${payment.paymentMethod === 'cash' ? 'bg-primary' : payment.paymentMethod === 'card' ? 'bg-info' : 'bg-secondary'}">${payment.paymentMethod === 'cash' ? 'Naqd' : payment.paymentMethod === 'card' ? 'Karta' : "O'tkazma"}</span></td>
                                                    <td>${escapeHtml(payment.description || '-')}</td>
                                                </tr>
                                            `).join('')}
                                        </tbody>
                                        <tfoot>
                                            <tr>
                                                <td class="text-end"><strong>Jami to'langan:</strong></td>
                                                <td class="fw-bold">${(clientDetails.paidAmount || 0).toLocaleString('uz-UZ')} UZS</td>
                                                <td colspan="2"></td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            ` : '<div class="text-center py-4 text-muted"><i class="fas fa-history fa-2x mb-3 d-block"></i><p>Toʻlovlar tarixi yoʻq</p></div>'}
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('nasiyaClientDetailsContent').innerHTML = detailsHTML;
        document.getElementById('nasiyaClientDetailsModal').setAttribute('data-client-id', clientId);
        
        const modal = new bootstrap.Modal(document.getElementById('nasiyaClientDetailsModal'));
        modal.show();

    } catch (error) {
        console.error('Mijoz maʼlumotlarini olishda xatolik:', error);
        showError('Mijoz maʼlumotlarini olishda xatolik: ' + error.message);
    }
}

function getPaymentDateClass(dateStr) {
    if (!dateStr) return 'text-muted';
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const paymentDate = new Date(dateStr);
    paymentDate.setHours(0, 0, 0, 0);
    
    const diffTime = paymentDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
        return 'text-danger';
    } else if (diffDays === 0) {
        return 'text-warning';
    } else if (diffDays <= 3) {
        return 'text-warning';
    } else if (diffDays <= 7) {
        return 'text-info';
    } else {
        return 'text-success';
    }
}

function formatDaysUntil(dateStr) {
    if (!dateStr) return '';
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const paymentDate = new Date(dateStr);
    paymentDate.setHours(0, 0, 0, 0);
    
    const diffTime = paymentDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
        return `<span class="badge bg-danger">${Math.abs(diffDays)} kun kechikdi</span>`;
    } else if (diffDays === 0) {
        return `<span class="badge bg-warning">Bugun</span>`;
    } else if (diffDays === 1) {
        return `<span class="badge bg-warning">Ertaga</span>`;
    } else {
        return `<span class="badge bg-info">${diffDays} kun qoldi</span>`;
    }
}

function generateNasiyaClientPDF() {
    const modal = document.getElementById('nasiyaClientDetailsModal');
    const clientId = modal.getAttribute('data-client-id');
    const client = DokonApp.nasiyaData.clients.find(c => c.id === clientId);
    
    if (!client) {
        showError('Mijoz topilmadi');
        return;
    }

    const clientPayments = DokonApp.nasiyaData.payments.filter(p => p.clientId === clientId);
    
    const printWindow = window.open('', '_blank');
    
    const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>${client.name} - Nasiya hisoboti</title>
            <style>
                @page { margin: 15mm; }
                body { 
                    font-family: 'Arial', sans-serif; 
                    margin: 0; 
                    padding: 0;
                    color: #333;
                    font-size: 12px;
                }
                .header {
                    text-align: center;
                    margin-bottom: 20px;
                    border-bottom: 2px solid #4361ee;
                    padding-bottom: 15px;
                }
                .logo-container {
                    text-align: center;
                    margin-bottom: 15px;
                }
                .logo {
                    max-width: 100px;
                    height: auto;
                }
                .company-name {
                    font-size: 18px;
                    font-weight: bold;
                    color: #4361ee;
                    margin: 5px 0;
                }
                .report-title {
                    font-size: 16px;
                    color: #333;
                    margin: 5px 0;
                }
                .client-info {
                    margin: 15px 0;
                    padding: 10px;
                    background-color: #f8f9fa;
                    border-radius: 5px;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin: 10px 0;
                    font-size: 10px;
                }
                th {
                    background-color: #4361ee;
                    color: white;
                    padding: 8px;
                    text-align: left;
                    font-weight: bold;
                }
                td {
                    padding: 6px 8px;
                    border-bottom: 1px solid #ddd;
                }
                tr:nth-child(even) {
                    background-color: #f8f9fa;
                }
                .summary {
                    margin: 15px 0;
                    padding: 10px;
                    background-color: #e9ecef;
                    border-radius: 5px;
                }
                .footer {
                    margin-top: 30px;
                    text-align: center;
                    font-size: 10px;
                    color: #666;
                    border-top: 1px solid #ddd;
                    padding-top: 15px;
                }
                .text-success { color: #28a745; }
                .text-danger { color: #dc3545; }
                .text-warning { color: #ffc107; }
                .text-center { text-align: center; }
                .mb-1 { margin-bottom: 5px; }
                .mb-2 { margin-bottom: 10px; }
                .mt-2 { margin-top: 10px; }
            </style>
        </head>
        <body>
            <div class="header">
                <div class="logo-container">
                    <img src="/Akiltoys.png" alt="Akil Box Logo" class="logo">
                    <div class="company-name">Akil Box - Nasiya hisoboti</div>
                </div>
                <div class="report-title">${client.name} - Nasiya olingan mahsulotlar hisoboti</div>
                <div class="report-date">
                    Sana: ${new Date().toLocaleDateString('uz-UZ')} | 
                    Vaqt: ${new Date().toLocaleTimeString('uz-UZ', {hour: '2-digit', minute:'2-digit'})}
                </div>
            </div>
            
            <div class="client-info">
                <table>
                    <tr>
                        <th width="100">Ism:</th>
                        <td>${escapeHtml(client.name)}</td>
                    </tr>
                    <tr>
                        <th>Telefon:</th>
                        <td>${escapeHtml(client.phone || '-')}</td>
                    </tr>
                    <tr>
                        <th>Manzil:</th>
                        <td>${escapeHtml(client.address || '-')}</td>
                    </tr>
                    <tr>
                        <th>Holati:</th>
                        <td>${client.status === 'active' ? 'Faol' : 'Nofaol'}</td>
                    </tr>
                </table>
            </div>
            
            <div class="summary">
                <table>
                    <tr>
                        <th width="100">Jami qarz:</th>
                        <td class="text-danger fw-bold">${(client.totalDebt || 0).toLocaleString('uz-UZ')} UZS</td>
                    </tr>
                    <tr>
                        <th>To'langan:</th>
                        <td class="text-success">${(client.paidAmount || 0).toLocaleString('uz-UZ')} UZS</td>
                    </tr>
                    <tr>
                        <th>Qolgan qarz:</th>
                        <td class="fw-bold ${client.remainingDebt > 0 ? 'text-danger' : 'text-success'}">
                            ${(client.remainingDebt || 0).toLocaleString('uz-UZ')} UZS
                        </td>
                    </tr>
                </table>
            </div>
            
            <h4 class="mb-2">Nasiya olingan mahsulotlar:</h4>
            ${allProducts.length > 0 ? `
                <table>
                    <thead>
                        <tr>
                            <th>№</th>
                            <th>Sana</th>
                            <th>Mahsulot</th>
                            <th>Miqdor</th>
                            <th>Narx</th>
                            <th>Jami</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${allProducts.map((product, index) => `
                            <tr>
                                <td>${index + 1}</td>
                                <td>${new Date(product.saleDate).toLocaleDateString('uz-UZ')}</td>
                                <td>${escapeHtml(product.productName)}</td>
                                <td>${product.quantity}</td>
                                <td>${(product.price || 0).toLocaleString('uz-UZ')}</td>
                                <td>${(product.total || 0).toLocaleString('uz-UZ')}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                    <tfoot>
                        <tr>
                            <td colspan="5" class="text-end"><strong>Jami:</strong></td>
                            <td><strong>${allProducts.reduce((sum, p) => sum + (p.total || 0), 0).toLocaleString('uz-UZ')} UZS</strong></td>
                        </tr>
                    </tfoot>
                </table>
            ` : '<p class="text-center">Nasiya olingan mahsulotlar yo\'q</p>'}
            
            <h4 class="mt-2 mb-2">To'lov tarixi:</h4>
            ${clientPayments && clientPayments.length > 0 ? `
                <table>
                    <thead>
                        <tr>
                            <th>Sana</th>
                            <th>Miqdor</th>
                            <th>To'lov usuli</th>
                            <th>Izoh</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${clientPayments.map(payment => `
                            <tr>
                                <td>${new Date(payment.paymentDate).toLocaleDateString('uz-UZ')}</td>
                                <td class="text-success">${(payment.amount || 0).toLocaleString('uz-UZ')} UZS</td>
                                <td>${payment.paymentMethod === 'cash' ? 'Naqd' : 
                                      payment.paymentMethod === 'card' ? 'Karta' : "O'tkazma"}</td>
                                <td>${escapeHtml(payment.description || '-')}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            ` : '<p class="text-center">To\'lovlar tarixi yo\'q</p>'}
            
            <div class="footer">
                <p>Akil Box - O'yinchoqlar do'koni boshqaruvi</p>
                <p>Tel: +998 98 302 77 76 | +998 77 302 77 76</p>
                <p>${new Date().getFullYear()} © Akil Box Do'kon tizimi</p>
            </div>
        </body>
        </html>
    `;
    
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    
    setTimeout(() => {
        printWindow.print();
        printWindow.close();
    }, 500);
}

function renderNasiyaClientsTable() {
    const container = document.getElementById('nasiyaClientsTable');
    if (!container) return;
    
    let clients = DokonApp.nasiyaData.clients;

    if (nasiyaSearchTerm) {
        clients = clients.filter(client => 
            client.name.toLowerCase().includes(nasiyaSearchTerm) ||
            (client.phone && client.phone.toLowerCase().includes(nasiyaSearchTerm)) ||
            (client.address && client.address.toLowerCase().includes(nasiyaSearchTerm))
        );
    }

    clients.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

    if (clients.length === 0) {
        container.innerHTML = `
            <tr>
                <td colspan="9" class="text-center py-4 text-muted">
                    <i class="fas fa-users fa-2x mb-3 d-block"></i>
                    ${nasiyaSearchTerm ? 'Qidiruv bo\'yicha mijoz topilmadi' : 'Hozircha mijozlar yo\'q'}
                </td>
            </tr>
        `;
        return;
    }

    const rows = clients.map((client, index) => {
        const clientSales = DokonApp.nasiyaData.sales.filter(s => s.clientId === client.id);
        const productsCount = clientSales.reduce((count, sale) => count + (sale.items?.length || 0), 0);
        
        const lastPayment = DokonApp.nasiyaData.payments
            .filter(p => p.clientId === client.id)
            .sort((a, b) => new Date(b.paymentDate) - new Date(a.paymentDate))[0];
        
        const lastPaymentDate = lastPayment ? new Date(lastPayment.paymentDate).toLocaleDateString('uz-UZ') : 'Yo\'q';
        
        return `
            <tr>
                <td data-label="#">${index + 1}</td>
                <td data-label="Mijoz">
                    <strong>${escapeHtml(client.name)}</strong>
                    ${client.phone ? `<br><small class="text-muted">${escapeHtml(client.phone)}</small>` : ''}
                    ${productsCount > 0 ? `<br><small class="text-info">${productsCount} ta mahsulot</small>` : ''}
                </td>
                <td data-label="Telefon">${escapeHtml(client.phone || '-')}</td>
                <td data-label="Jami qarz" class="text-danger fw-bold">${(client.totalDebt || 0).toLocaleString('uz-UZ')} UZS</td>
                <td data-label="To'langan" class="text-success">${(client.paidAmount || 0).toLocaleString('uz-UZ')} UZS</td>
                <td data-label="Qoldiq">
                    <span class="badge ${client.remainingDebt > 0 ? 'bg-danger' : 'bg-success'}">
                        ${(client.remainingDebt || 0).toLocaleString('uz-UZ')} UZS
                    </span>
                </td>
                <td data-label="Holati">
                    <span class="badge ${client.status === 'active' ? 'bg-success' : 'bg-danger'}">
                        ${client.status === 'active' ? 'Faol' : 'Nofaol'}
                    </span>
                </td>
                <td data-label="Oxirgi to'lov">${lastPaymentDate}</td>
                <td data-label="Harakatlar">
                    <button class="btn btn-sm btn-info me-1 mb-1" onclick="showNasiyaClientDetails('${client.id}')" 
                            title="Mahsulotlar tarixi bilan ko'rish">
                        <i class="fas fa-history"></i>
                    </button>
                    <button class="btn btn-sm btn-success me-1 mb-1" onclick="showNasiyaPaymentModal('${client.id}')">
                        <i class="fas fa-money-bill-wave"></i>
                    </button>
                    <button class="btn btn-sm btn-warning me-1 mb-1" onclick="showCreateNasiyaSaleModalForClient('${client.id}')">
                        <i class="fas fa-plus"></i>
                    </button>
                    <button class="btn btn-sm btn-danger mb-1" onclick="deleteNasiyaClient('${client.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
    
    container.innerHTML = rows;
}

function showCreateNasiyaSaleModalForClient(clientId) {
    const client = DokonApp.nasiyaData.clients.find(c => c.id === clientId);
    if (!client) return;
    
    showCreateNasiyaSaleModal();
    
    setTimeout(() => {
        document.getElementById('nasiyaSaleClient').value = clientId;
        if (typeof updateNasiyaClientInfo === 'function') {
            updateNasiyaClientInfo();
        }
    }, 500);
    setupNasiyaProductAutocomplete();

    new bootstrap.Modal(document.getElementById('nasiyaSaleModal')).show();
}

function checkNasiyaReminders() {
    const today = new Date().toISOString().split('T')[0];
    const upcomingReminders = DokonApp.nasiyaData.reminders
        .filter(r => !r.completed && r.reminderDate === today);
    
    if (upcomingReminders.length > 0) {
        const clients = upcomingReminders.map(reminder => {
            const client = DokonApp.nasiyaData.clients.find(c => c.id === reminder.clientId);
            return client ? client.name : 'Noma\'lum mijoz';
        }).join(', ');
        
        createNotification(
            'Bugungi nasiya to\'lovlari',
            `${upcomingReminders.length} ta mijoz uchun bugun to'lov kuni: ${clients}`,
            'reminder',
            'high',
            'goto_nasiya',
            null
        );
    }
}

window.logout = function() {
    localStorage.removeItem('dokon_token');
    localStorage.removeItem('dokon_user');
    window.location.href = 'login.html';
};

function filterReminders() {
    const filterValue = document.getElementById('reminderFilter')?.value || 'all';
    const reminders = DokonApp.nasiyaData.reminders || [];
    console.log('Filter applied:', filterValue);
    renderNasiyaRemindersTable();
}

function filterRemindersByDate() {
    const dateValue = document.getElementById('reminderDateFilter')?.value;
    const reminders = DokonApp.nasiyaData.reminders || [];
    
    if (!dateValue) {
        renderNasiyaRemindersTable();
        return;
    }
    
    const filteredReminders = reminders.filter(reminder => {
        if (!reminder.reminderDate) return false;
        return reminder.reminderDate === dateValue;
    });
    
    console.log('Filtered by date:', filteredReminders.length);
    renderNasiyaRemindersTable();
}

function changeReminderPage(direction) {
    console.log('Change page:', direction);
    renderNasiyaRemindersTable();
}

window.showCreateNasiyaSaleModalForClient = function(clientId) {
    showCreateNasiyaSaleModal();
    
    if (clientId) {
        const hidden = document.getElementById('nasiyaSaleClientId');
        const search = document.getElementById('nasiyaSaleClientSearch');
        
        if (!hidden || !search) {
            console.warn('Не найдены элементы nasiyaSaleClientId или nasiyaSaleClientSearch');
            return;
        }
        
        const client = DokonApp.nasiyaData.clients.find(c => c.id === clientId);
        if (!client) {
            console.warn('Клиент не найден:', clientId);
            return;
        }
        
        hidden.value = clientId;
        search.value = client.name;
        
        if (typeof updateNasiyaClientInfo === 'function') {
            updateNasiyaClientInfo();
        }
    }
};

async function markAllRemindersAsSent() {
    if (!confirm('Barcha eslatmalarni yuborilgan deb belgilashni tasdiqlaysizmi?')) return;
    
    try {
        await apiFetch('/nasiya/reminders/mark-all-sent', {
            method: 'PUT'
        });
        
        showSuccess('Barcha eslatmalar yuborilgan deb belgilandi');
        await loadNasiyaData();
    } catch (error) {
        showError('Eslatmalarni belgilashda xatolik: ' + error.message);
    }
}

function showAllReminders() {
    const container = document.getElementById('nasiyaRemindersTable');
    if (!container) return;
    
    const reminders = DokonApp.nasiyaData.reminders || [];
    
    if (reminders.length === 0) {
        container.innerHTML = `
            <tr>
                <td colspan="9" class="text-center py-4 text-muted">
                    <i class="fas fa-bell-slash fa-2x mb-3 d-block"></i>
                    Hozircha eslatmalar yo'q
                </td>
            </tr>
        `;
        return;
    }
    
    const rows = reminders.map(reminder => {
        const client = DokonApp.nasiyaData.clients.find(c => c.id === reminder.clientId);
        const clientName = client ? client.name : 'Noma\'lum mijoz';
        const clientPhone = client ? (client.phone || 'Noma\'lum') : 'Noma\'lum';
        
        return `
            <tr>
                <td data-label="Tanlash"><input type="checkbox" class="reminder-checkbox" data-id="${reminder.id}"></td>
                <td data-label="Mijoz">
                    <strong>${escapeHtml(clientName)}</strong>
                    <br><small class="text-muted">${escapeHtml(clientPhone)}</small>
                </td>
                <td data-label="Telefon">${escapeHtml(clientPhone)}</td>
                <td data-label="To'lov sanasi">${new Date(reminder.reminderDate).toLocaleDateString('uz-UZ')}</td>
                <td data-label="Miqdor" class="fw-bold text-success">${(reminder.amount || 0).toLocaleString('uz-UZ')} UZS</td>
                <td data-label="Qoldiq" class="text-danger">${client ? (client.remainingDebt || 0).toLocaleString('uz-UZ') : 0} UZS</td>
                <td data-label="Holati"><span class="badge ${reminder.completed ? 'bg-success' : 'bg-warning'}">${reminder.completed ? 'Yuborilgan' : 'Kutilmoqda'}</span></td>
                <td data-label="Eslatma">${escapeHtml(reminder.description) || 'To\'lov eslatmasi'}</td>
                <td data-label="Harakatlar">
                    <button class="btn btn-sm btn-success me-1" onclick="sendSingleReminder('${reminder.id}')">
                        <i class="fas fa-paper-plane"></i>
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="deleteReminder('${reminder.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
    
    container.innerHTML = rows;
}

function renderFilteredReminders(reminders) {
    const container = document.getElementById('nasiyaRemindersTable');
    if (!container) return;
    
    if (reminders.length === 0) {
        container.innerHTML = `
            <tr>
                <td colspan="9" class="text-center py-4 text-muted">
                    <i class="fas fa-bell-slash fa-2x mb-3 d-block"></i>
                    Filtr bo'yicha eslatmalar topilmadi
                </td>
            </tr>
        `;
        return;
    }
    
    const rows = reminders.map(reminder => {
        const client = DokonApp.nasiyaData.clients.find(c => c.id === reminder.clientId);
        const clientName = client ? client.name : 'Noma\'lum mijoz';
        const clientPhone = client ? (client.phone || 'Noma\'lum') : 'Noma\'lum';
        
        return `
            <tr>
                <td data-label="Tanlash"><input type="checkbox" class="reminder-checkbox" data-id="${reminder.id}"></td>
                <td data-label="Mijoz">
                    <strong>${escapeHtml(clientName)}</strong>
                    <br><small class="text-muted">${escapeHtml(clientPhone)}</small>
                </td>
                <td data-label="Telefon">${escapeHtml(clientPhone)}</td>
                <td data-label="To'lov sanasi">${new Date(reminder.reminderDate).toLocaleDateString('uz-UZ')}</td>
                <td data-label="Miqdor" class="fw-bold text-success">${(reminder.amount || 0).toLocaleString('uz-UZ')} UZS</td>
                <td data-label="Qoldiq" class="text-danger">${client ? (client.remainingDebt || 0).toLocaleString('uz-UZ') : 0} UZS</td>
                <td data-label="Holati"><span class="badge ${reminder.completed ? 'bg-success' : 'bg-warning'}">${reminder.completed ? 'Yuborilgan' : 'Kutilmoqda'}</span></td>
                <td data-label="Eslatma">${escapeHtml(reminder.description) || 'To\'lov eslatmasi'}</td>
                <td data-label="Harakatlar">
                    <button class="btn btn-sm btn-success me-1" onclick="sendSingleReminder('${reminder.id}')">
                        <i class="fas fa-paper-plane"></i>
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="deleteReminder('${reminder.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
    
    container.innerHTML = rows;
}

function showLoading(message = 'Yuklanmoqda...') {
    let overlay = document.getElementById('loadingOverlay');
    
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'loadingOverlay';
        overlay.style.cssText = `
            position: fixed; inset: 0; background: rgba(0,0,0,0.5);
            display: flex; justify-content: center; align-items: center;
            z-index: 99999; color: white; font-size: 1.2rem;
        `;
        overlay.innerHTML = `
            <div class="text-center">
                <div class="spinner-border text-light mb-2" style="width:3rem;height:3rem;" role="status"></div>
                <div>${message}</div>
            </div>
        `;
        document.body.appendChild(overlay);
    }
    
    overlay.style.display = 'flex';
}

function hideLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.style.display = 'none';
    }
}

function changeBulkWarehouseType(type) {
    currentBulkType = type;
    const title = document.getElementById('bulkWarehouseTypeTitle');
    title.innerHTML = '<i class="fas fa-robot me-2"></i>Akil Box - Ommaviy qabul';
    
    document.getElementById('bulkWarehouseItems').innerHTML = '';
    addBulkWarehouseRow();
    updateBulkWarehouseTotal();
}

function addBulkWarehouseRow() {
    const tbody = document.getElementById('bulkWarehouseItems');
    const rowId = 'bulk_row_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    
    const rowHtml = `
        <tr id="${rowId}">
            <td>
                <div class="position-relative">
                    <input type="text" 
                           class="form-control bulk-product-search" 
                           placeholder="Mahsulot nomini yozing..." 
                           autocomplete="off"
                           data-row="${rowId}"
                           data-type="${currentBulkType}">
                    <input type="hidden" class="bulk-product-id" data-row="${rowId}" value="">
                    <div class="autocomplete-suggestions" 
                         style="display: none; position: absolute; width: 100%; z-index: 1000; background: white; border: 1px solid #ddd; max-height: 200px; overflow-y: auto;"
                         data-row="${rowId}"></div>
                </div>
            </td>
            <td>
                <input type="number" class="form-control bulk-quantity" min="1" value="1" data-row="${rowId}">
            </td>
            <td>
                <input type="number" class="form-control bulk-cost" min="0" step="1000" value="0" data-row="${rowId}">
            </td>
            <td class="bulk-row-total" data-row="${rowId}">0 UZS</td>
            <td>
                <button class="btn btn-sm btn-danger" onclick="removeBulkWarehouseRow('${rowId}')">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `;
    
    tbody.insertAdjacentHTML('beforeend', rowHtml);
    attachBulkRowEvents(rowId);
}

function removeBulkWarehouseRow(rowId) {
    document.getElementById(rowId)?.remove();
    updateBulkWarehouseTotal();
}

function attachBulkRowEvents(rowId) {
    const row = document.getElementById(rowId);
    if (!row) return;

    const searchInput = row.querySelector('.bulk-product-search');
    const suggestionsDiv = row.querySelector('.autocomplete-suggestions');
    const hiddenId = row.querySelector('.bulk-product-id');
    const quantityInput = row.querySelector('.bulk-quantity');
    const costInput = row.querySelector('.bulk-cost');

    let selectedIndex = -1;
    let currentItems = [];

    function highlightItem(index) {
        const items = suggestionsDiv.querySelectorAll('.suggestion-item');
        items.forEach((item, i) => {
            if (i === index) {
                item.classList.add('selected');
                item.scrollIntoView({ block: 'nearest' });
            } else {
                item.classList.remove('selected');
            }
        });
    }

    function closeSuggestions() {
        suggestionsDiv.style.display = 'none';
        selectedIndex = -1;
    }

    searchInput.addEventListener('input', function(e) {
        const query = e.target.value.trim().toLowerCase();
        const type = this.dataset.type;
        const allProducts = window.DokonApp?.products || [];
        const products = allProducts.filter(p => p.type === type);

        if (query.length < 1) {
            closeSuggestions();
            return;
        }

        const matches = products.filter(p =>
            p.name.toLowerCase().includes(query) ||
            (p.article && p.article.toLowerCase().includes(query))
        ).slice(0, 10);

        if (matches.length === 0) {
            closeSuggestions();
            return;
        }

        currentItems = matches;

        suggestionsDiv.innerHTML = matches.map(p =>
            `<div class="suggestion-item p-2 border-bottom" data-id="${p.id}" data-name="${p.name}" data-cost="${p.cost || 0}">${p.name} (${p.article || 'artikulsiz'})</div>`
        ).join('');

        suggestionsDiv.style.display = 'block';
        selectedIndex = -1;
    });

    searchInput.addEventListener('keydown', function(e) {
        if (suggestionsDiv.style.display !== 'block') return;

        const items = suggestionsDiv.querySelectorAll('.suggestion-item');
        if (items.length === 0) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (selectedIndex < items.length - 1) selectedIndex++;
            else selectedIndex = 0;
            highlightItem(selectedIndex);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (selectedIndex > 0) selectedIndex--;
            else selectedIndex = items.length - 1;
            highlightItem(selectedIndex);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (selectedIndex >= 0 && selectedIndex < items.length) {
                const selectedItem = items[selectedIndex];
                const productId = selectedItem.dataset.id;
                const productName = selectedItem.dataset.name;
                const productCost = selectedItem.dataset.cost;

                searchInput.value = productName;
                hiddenId.value = productId;
                costInput.value = productCost;
                closeSuggestions();
                updateBulkRowTotal(rowId);
            }
        } else if (e.key === 'Tab') {
            closeSuggestions();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            closeSuggestions();
        }
    });

    document.addEventListener('click', function(e) {
        if (!searchInput.contains(e.target) && !suggestionsDiv.contains(e.target)) {
            closeSuggestions();
        }
    });

    suggestionsDiv.addEventListener('click', function(e) {
        const target = e.target.closest('.suggestion-item');
        if (!target) return;

        const productId = target.dataset.id;
        const productName = target.dataset.name;
        const productCost = target.dataset.cost;

        searchInput.value = productName;
        hiddenId.value = productId;
        costInput.value = productCost;
        closeSuggestions();
        updateBulkRowTotal(rowId);
    });

    const inputs = [searchInput, quantityInput, costInput];

    inputs.forEach((input, colIndex) => {
        input.addEventListener('keydown', function(e) {
            if (input === searchInput && suggestionsDiv.style.display === 'block') return;

            const key = e.key;
            const isArrow = key.startsWith('Arrow');
            if (!isArrow && key !== 'Enter' && key !== 'Tab') return;

            e.preventDefault();

            let currentCol = colIndex;

            if (key === 'ArrowLeft') {
                if (currentCol > 0) {
                    inputs[currentCol - 1].focus();
                }
            } else if (key === 'ArrowRight') {
                if (currentCol < 2) {
                    inputs[currentCol + 1].focus();
                }
            } else if (key === 'ArrowUp') {
                const prevRow = row.previousElementSibling;
                if (prevRow && prevRow.id && prevRow.id.startsWith('bulk_row_')) {
                    const prevInput = prevRow.querySelectorAll('.bulk-product-search, .bulk-quantity, .bulk-cost')[currentCol];
                    if (prevInput) prevInput.focus();
                }
            } else if (key === 'ArrowDown') {
                const nextRow = row.nextElementSibling;
                if (nextRow && nextRow.id && nextRow.id.startsWith('bulk_row_')) {
                    const nextInput = nextRow.querySelectorAll('.bulk-product-search, .bulk-quantity, .bulk-cost')[currentCol];
                    if (nextInput) nextInput.focus();
                } else {
                    addBulkWarehouseRow();
                    const newRow = document.querySelector('#bulkWarehouseItems tr:last-child');
                    if (newRow) {
                        const newInput = newRow.querySelectorAll('.bulk-product-search, .bulk-quantity, .bulk-cost')[currentCol];
                        if (newInput) newInput.focus();
                    }
                }
            } else if (key === 'Enter') {
                if (currentCol < 2) {
                    inputs[currentCol + 1].focus();
                } else {
                    const nextRow = row.nextElementSibling;
                    if (nextRow && nextRow.id && nextRow.id.startsWith('bulk_row_')) {
                        const firstInput = nextRow.querySelector('.bulk-product-search');
                        if (firstInput) firstInput.focus();
                    } else {
                        addBulkWarehouseRow();
                        const newRow = document.querySelector('#bulkWarehouseItems tr:last-child');
                        if (newRow) {
                            const firstInput = newRow.querySelector('.bulk-product-search');
                            if (firstInput) firstInput.focus();
                        }
                    }
                }
            } else if (key === 'Tab') {
                if (e.shiftKey) {
                    if (currentCol > 0) {
                        inputs[currentCol - 1].focus();
                    } else {
                        const prevRow = row.previousElementSibling;
                        if (prevRow && prevRow.id && prevRow.id.startsWith('bulk_row_')) {
                            const lastInput = prevRow.querySelector('.bulk-cost');
                            if (lastInput) lastInput.focus();
                        }
                    }
                } else {
                    if (currentCol < 2) {
                        inputs[currentCol + 1].focus();
                    } else {
                        const nextRow = row.nextElementSibling;
                        if (nextRow && nextRow.id && nextRow.id.startsWith('bulk_row_')) {
                            const firstInput = nextRow.querySelector('.bulk-product-search');
                            if (firstInput) firstInput.focus();
                        } else {
                            addBulkWarehouseRow();
                            const newRow = document.querySelector('#bulkWarehouseItems tr:last-child');
                            if (newRow) {
                                const firstInput = newRow.querySelector('.bulk-product-search');
                                if (firstInput) firstInput.focus();
                            }
                        }
                    }
                }
            }
        });
    });

    quantityInput.addEventListener('input', () => updateBulkRowTotal(rowId));
    costInput.addEventListener('input', () => updateBulkRowTotal(rowId));
}

function updateBulkRowTotal(rowId) {
    const row = document.getElementById(rowId);
    if (!row) return;
    const qty = parseFloat(row.querySelector('.bulk-quantity').value) || 0;
    const cost = parseFloat(row.querySelector('.bulk-cost').value) || 0;
    row.querySelector('.bulk-row-total').textContent = (qty * cost).toLocaleString('uz-UZ') + ' UZS';
    updateBulkWarehouseTotal();
}

function updateBulkWarehouseTotal() {
    let grandTotal = 0;
    document.querySelectorAll('#bulkWarehouseItems tr').forEach(row => {
        const quantity = parseFloat(row.querySelector('.bulk-quantity')?.value) || 0;
        const cost = parseFloat(row.querySelector('.bulk-cost')?.value) || 0;
        grandTotal += quantity * cost;
    });
    document.getElementById('bulkWarehouseTotalAmount').textContent = grandTotal.toLocaleString('uz-UZ') + ' UZS';
}

function addMultipleBulkRows() {
    const countInput = document.getElementById('bulkRowsCount');
    if (!countInput) return;
    
    let count = parseInt(countInput.value, 10);
    if (isNaN(count) || count < 1) count = 1;
    
    const MAX_ROWS = 50;
    if (count > MAX_ROWS) {
        if (!confirm(`${count} ta qator qo'shish juda ko'p. Maksimal ${MAX_ROWS} ta. Davom ettirilsinmi?`)) {
            return;
        }
        count = MAX_ROWS;
    }
    
    if (count > 20) {
        showLoading(`${count} ta qator qo'shilmoqda...`);
        setTimeout(() => {
            for (let i = 0; i < count; i++) {
                addBulkWarehouseRow();
            }
            hideLoading();
        }, 10);
    } else {
        for (let i = 0; i < count; i++) {
            addBulkWarehouseRow();
        }
    }
}

// Тёмная тема
(function initTheme() {
    const themeToggle = document.getElementById('themeToggle');
    if (!themeToggle) return;

    const savedTheme = localStorage.getItem('dokon_theme');
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-theme');
        themeToggle.querySelector('i').className = 'fas fa-sun';
    }

    themeToggle.addEventListener('click', function() {
        document.body.classList.toggle('dark-theme');
        const icon = this.querySelector('i');
        if (document.body.classList.contains('dark-theme')) {
            icon.className = 'fas fa-sun';
            localStorage.setItem('dokon_theme', 'dark');
        } else {
            icon.className = 'fas fa-moon';
            localStorage.setItem('dokon_theme', 'light');
        }
    });
})();

// Refund: автодополнение для выбора товара
let refundAutocompleteInitialized = false;

function initRefundAutocomplete() {
    if (refundAutocompleteInitialized) return;

    const input = document.getElementById('refundProductSearch');
    const hidden = document.getElementById('refundProductId');
    const suggestions = document.getElementById('refundProductSuggestions');
    const priceInput = document.getElementById('refundPrice');
    const costInput = document.getElementById('refundCost');
    const availableInfo = document.getElementById('refundAvailableInfo');

    if (!input || !hidden || !suggestions) return;

    let selectedIndex = -1;
    let currentItems = [];

    function highlightItem(index) {
        const items = suggestions.querySelectorAll('.suggestion-item');
        items.forEach((item, i) => {
            if (i === index) item.classList.add('selected');
            else item.classList.remove('selected');
        });
    }

    function closeSuggestions() {
        suggestions.style.display = 'none';
        selectedIndex = -1;
    }

    input.addEventListener('input', function() {
        const searchTerm = this.value.trim().toLowerCase();
        if (searchTerm.length < 1) {
            closeSuggestions();
            hidden.value = '';
            if (availableInfo) availableInfo.textContent = '';
            return;
        }

        const products = DokonApp.products || [];
        const matches = products.filter(p =>
            p.name.toLowerCase().includes(searchTerm) ||
            (p.article && p.article.toLowerCase().includes(searchTerm))
        ).slice(0, 10);

        if (matches.length === 0) {
            closeSuggestions();
            return;
        }

        currentItems = matches;
        suggestions.innerHTML = matches.map(p =>
            `<div class="suggestion-item p-2 border-bottom" data-id="${p.id}" data-name="${p.name}" data-price="${p.price || 0}" data-cost="${p.cost || 0}">
                ${p.name} (${p.article || 'artikulsiz'}) – Akil Box
            </div>`
        ).join('');
        suggestions.style.display = 'block';
        selectedIndex = -1;
    });

    input.addEventListener('keydown', function(e) {
        if (suggestions.style.display !== 'block') return;
        const items = suggestions.querySelectorAll('.suggestion-item');
        if (items.length === 0) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            selectedIndex = (selectedIndex + 1) % items.length;
            highlightItem(selectedIndex);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            selectedIndex = (selectedIndex - 1 + items.length) % items.length;
            highlightItem(selectedIndex);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (selectedIndex >= 0) {
                const selected = items[selectedIndex];
                const productId = selected.dataset.id;
                const productName = selected.dataset.name;
                const productPrice = selected.dataset.price;
                const productCost = selected.dataset.cost;

                input.value = productName;
                hidden.value = productId;
                if (priceInput) priceInput.value = productPrice;
                if (costInput) costInput.value = productCost;
                closeSuggestions();
                updateAvailableForReturn(productId);
            }
        } else if (e.key === 'Tab') {
            closeSuggestions();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            closeSuggestions();
        }
    });

    document.addEventListener('click', function(e) {
        if (!input.contains(e.target) && !suggestions.contains(e.target)) {
            closeSuggestions();
        }
    });

    suggestions.addEventListener('click', function(e) {
        const target = e.target.closest('.suggestion-item');
        if (!target) return;

        const productId = target.dataset.id;
        const productName = target.dataset.name;
        const productPrice = target.dataset.price;
        const productCost = target.dataset.cost;

        input.value = productName;
        hidden.value = productId;
        if (priceInput) priceInput.value = productPrice;
        if (costInput) costInput.value = productCost;
        closeSuggestions();
        updateAvailableForReturn(productId);
    });

    refundAutocompleteInitialized = true;
}

function updateAvailableForReturn(productId) {
    const availableInfo = document.getElementById('refundAvailableInfo');
    if (!productId || !availableInfo) {
        if (availableInfo) availableInfo.textContent = '';
        return;
    }

    const allSales = DokonApp.sales || [];
    const totalSold = allSales
        .filter(s => s.productId === productId && s.quantity > 0)
        .reduce((sum, s) => sum + s.quantity, 0);
    const totalReturned = allSales
        .filter(s => s.productId === productId && s.quantity < 0)
        .reduce((sum, s) => sum + Math.abs(s.quantity), 0);

    const available = totalSold - totalReturned;
    if (available <= 0) {
        availableInfo.innerHTML = `<span class="text-danger">Qaytarish mumkin emas (sotilmagan yoki hammasi qaytarilgan)</span>`;
    } else {
        availableInfo.innerHTML = `Qaytarish mumkin: <strong>${available}</strong> dona (jami sotilgan: ${totalSold}, qaytarilgan: ${totalReturned})`;
    }

    const qtyInput = document.getElementById('refundQuantity');
    if (qtyInput) {
        qtyInput.max = available;
        if (parseInt(qtyInput.value) > available) qtyInput.value = available;
    }
}

// ==================== REFUND (Qaytarish) ====================

let refundItems = [];

function initRefundTab() {
    const dateInput = document.getElementById('refundDate');
    if (dateInput && !dateInput.value) {
        dateInput.value = new Date().toISOString().split('T')[0];
    }
    if (document.querySelectorAll('#refundItemsBody tr').length === 0) {
        addRefundRow();
    }
    updateRefundTotal();
}

function addRefundRow() {
    const tbody = document.getElementById('refundItemsBody');
    const rowId = 'refund_row_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    
    const rowHtml = `
        <tr id="${rowId}">
            <td>
                <div class="position-relative">
                    <input type="text" 
                           class="form-control refund-product-search" 
                           placeholder="Mahsulot nomini yozing..." 
                           autocomplete="off"
                           data-row="${rowId}">
                    <input type="hidden" class="refund-product-id" data-row="${rowId}" value="">
                    <div class="autocomplete-suggestions" 
                         style="display: none; position: absolute; width: 100%; z-index: 1000; background: white; border: 1px solid #ddd; max-height: 200px; overflow-y: auto;"
                         data-row="${rowId}"></div>
                </div>
                <small class="text-muted refund-available-info" data-row="${rowId}"></small>
            </td>
            <td>
                <input type="number" class="form-control refund-quantity" min="1" value="1" data-row="${rowId}">
            </td>
            <td>
                <input type="number" class="form-control refund-price" min="0" step="1000" value="0" data-row="${rowId}">
            </td>
            <td>
                <input type="number" class="form-control refund-cost" min="0" step="1000" value="0" data-row="${rowId}">
            </td>
            <td class="refund-row-total" data-row="${rowId}">0 UZS</td>
            <td>
                <button class="btn btn-sm btn-danger" onclick="removeRefundRow('${rowId}')">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `;
    
    tbody.insertAdjacentHTML('beforeend', rowHtml);
    attachRefundRowEvents(rowId);
    updateRefundTotal();
}

function removeRefundRow(rowId) {
    document.getElementById(rowId)?.remove();
    updateRefundTotal();
}

function addMultipleRefundRows() {
    const countInput = document.getElementById('refundRowsCount');
    if (!countInput) return;
    
    let count = parseInt(countInput.value, 10);
    if (isNaN(count) || count < 1) count = 1;
    
    const MAX_ROWS = 50;
    if (count > MAX_ROWS) {
        if (!confirm(`${count} ta qator qo'shish juda ko'p. Maksimal ${MAX_ROWS} ta. Davom ettirilsinmi?`)) return;
        count = MAX_ROWS;
    }
    
    for (let i = 0; i < count; i++) {
        addRefundRow();
    }
}

function attachRefundRowEvents(rowId) {
    const row = document.getElementById(rowId);
    if (!row) return;

    const searchInput = row.querySelector('.refund-product-search');
    const suggestionsDiv = row.querySelector('.autocomplete-suggestions');
    const hiddenId = row.querySelector('.refund-product-id');
    const quantityInput = row.querySelector('.refund-quantity');
    const priceInput = row.querySelector('.refund-price');
    const costInput = row.querySelector('.refund-cost');
    const availableInfo = row.querySelector('.refund-available-info');

    let selectedIndex = -1;
    let currentItems = [];

    function highlightItem(index) {
        const items = suggestionsDiv.querySelectorAll('.suggestion-item');
        items.forEach((item, i) => {
            if (i === index) item.classList.add('selected');
            else item.classList.remove('selected');
        });
    }

    function closeSuggestions() {
        suggestionsDiv.style.display = 'none';
        selectedIndex = -1;
    }

    function updateAvailable(productId) {
        if (!productId) {
            availableInfo.textContent = '';
            return;
        }
        const allSales = DokonApp.sales || [];
        const totalSold = allSales
            .filter(s => s.productId === productId && s.quantity > 0)
            .reduce((sum, s) => sum + s.quantity, 0);
        const totalReturned = allSales
            .filter(s => s.productId === productId && s.quantity < 0)
            .reduce((sum, s) => sum + Math.abs(s.quantity), 0);
        const available = totalSold - totalReturned;
        if (available <= 0) {
            availableInfo.innerHTML = `<span class="text-danger">Qaytarish mumkin emas</span>`;
        } else {
            availableInfo.innerHTML = `Mumkin: ${available} dona`;
        }
        quantityInput.max = available;
    }

    searchInput.addEventListener('input', function() {
        const searchTerm = this.value.trim().toLowerCase();
        if (searchTerm.length < 1) {
            closeSuggestions();
            hiddenId.value = '';
            availableInfo.textContent = '';
            return;
        }

        const products = DokonApp.products || [];
        const matches = products.filter(p =>
            p.name.toLowerCase().includes(searchTerm) ||
            (p.article && p.article.toLowerCase().includes(searchTerm))
        ).slice(0, 10);

        if (matches.length === 0) {
            closeSuggestions();
            return;
        }

        currentItems = matches;
        suggestionsDiv.innerHTML = matches.map(p =>
            `<div class="suggestion-item p-2 border-bottom" data-id="${p.id}" data-name="${p.name}" data-price="${p.price || 0}" data-cost="${p.cost || 0}">
                ${p.name} (${p.article || 'artikulsiz'}) – Akil Box
            </div>`
        ).join('');
        suggestionsDiv.style.display = 'block';
        selectedIndex = -1;
    });

    searchInput.addEventListener('keydown', function(e) {
        if (suggestionsDiv.style.display !== 'block') return;
        const items = suggestionsDiv.querySelectorAll('.suggestion-item');
        if (items.length === 0) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            selectedIndex = (selectedIndex + 1) % items.length;
            highlightItem(selectedIndex);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            selectedIndex = (selectedIndex - 1 + items.length) % items.length;
            highlightItem(selectedIndex);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (selectedIndex >= 0) {
                const selected = items[selectedIndex];
                const productId = selected.dataset.id;
                const productName = selected.dataset.name;
                const productPrice = selected.dataset.price;
                const productCost = selected.dataset.cost;

                searchInput.value = productName;
                hiddenId.value = productId;
                priceInput.value = productPrice;
                costInput.value = productCost;
                closeSuggestions();
                updateAvailable(productId);
                updateRefundRowTotal(rowId);
            }
        } else if (e.key === 'Tab') {
            closeSuggestions();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            closeSuggestions();
        }
    });

    document.addEventListener('click', function(e) {
        if (!searchInput.contains(e.target) && !suggestionsDiv.contains(e.target)) {
            closeSuggestions();
        }
    });

    suggestionsDiv.addEventListener('click', function(e) {
        const target = e.target.closest('.suggestion-item');
        if (!target) return;

        const productId = target.dataset.id;
        const productName = target.dataset.name;
        const productPrice = target.dataset.price;
        const productCost = target.dataset.cost;

        searchInput.value = productName;
        hiddenId.value = productId;
        priceInput.value = productPrice;
        costInput.value = productCost;
        closeSuggestions();
        updateAvailable(productId);
        updateRefundRowTotal(rowId);
    });

    quantityInput.addEventListener('input', () => updateRefundRowTotal(rowId));
    priceInput.addEventListener('input', () => updateRefundRowTotal(rowId));
    costInput.addEventListener('input', () => updateRefundRowTotal(rowId));
}

function updateRefundRowTotal(rowId) {
    const row = document.getElementById(rowId);
    if (!row) return;
    const qty = parseFloat(row.querySelector('.refund-quantity').value) || 0;
    const price = parseFloat(row.querySelector('.refund-price').value) || 0;
    row.querySelector('.refund-row-total').textContent = (qty * price).toLocaleString('uz-UZ') + ' UZS';
    updateRefundTotal();
}

function updateRefundTotal() {
    let total = 0;
    document.querySelectorAll('#refundItemsBody tr').forEach(row => {
        const qty = parseFloat(row.querySelector('.refund-quantity')?.value) || 0;
        const price = parseFloat(row.querySelector('.refund-price')?.value) || 0;
        total += qty * price;
    });
    document.getElementById('refundTotalAmount').textContent = total.toLocaleString('uz-UZ') + ' UZS';
}

function collectRefundItems() {
    const items = [];
    const errors = [];
    let hasAny = false;

    document.querySelectorAll('#refundItemsBody tr').forEach(row => {
        const productId = row.querySelector('.refund-product-id')?.value;
        const quantity = parseFloat(row.querySelector('.refund-quantity')?.value) || 0;
        const price = parseFloat(row.querySelector('.refund-price')?.value) || 0;
        const cost = parseFloat(row.querySelector('.refund-cost')?.value) || 0;

        if (!productId && quantity === 0 && price === 0 && cost === 0) return;

        if (!productId) {
            errors.push('Mahsulot tanlanmagan qator');
            return;
        }
        if (quantity <= 0) {
            errors.push('Miqdor 1 dan kam bo‘lmasligi kerak');
            return;
        }
        if (price <= 0) {
            errors.push('Sotish narxi 0 dan katta bo‘lishi kerak');
            return;
        }
        if (cost <= 0) {
            errors.push('Kirim narxi 0 dan katta bo‘lishi kerak');
            return;
        }

        const product = DokonApp.products.find(p => p.id === productId);
        if (!product) {
            errors.push('Mahsulot topilmadi');
            return;
        }

        const allSales = DokonApp.sales || [];
        const totalSold = allSales.filter(s => s.productId === productId && s.quantity > 0)
                                  .reduce((sum, s) => sum + s.quantity, 0);
        const totalReturned = allSales.filter(s => s.productId === productId && s.quantity < 0)
                                      .reduce((sum, s) => sum + Math.abs(s.quantity), 0);
        const available = totalSold - totalReturned;
        if (quantity > available) {
            errors.push(`${product.name}: faqat ${available} dona qaytarish mumkin (so'ralgan ${quantity})`);
            return;
        }

        hasAny = true;
        items.push({
            productId,
            productName: product.name,
            productType: product.type,
            quantity,
            price,
            cost,
            total: quantity * price,
            description: ''
        });
    });

    if (errors.length > 0) {
        showError(errors.join('<br>'));
        return null;
    }
    if (!hasAny) {
        showError('Hech qanday mahsulot kiritilmagan');
        return null;
    }
    return items;
}

async function processRefundTable() {
    const items = collectRefundItems();
    if (!items) return;

    const date = document.getElementById('refundDate').value;
    const customer = document.getElementById('refundCustomer').value.trim();
    const globalDesc = document.getElementById('refundGlobalDescription').value.trim();

    if (!date) {
        showError('Sanani kiriting');
        return;
    }

    try {
        for (const item of items) {
            const payload = {
                productId: item.productId,
                quantity: item.quantity,
                price: item.price,
                cost: item.cost,
                date: date,
                description: globalDesc + (customer ? ` (mijoz: ${customer})` : '')
            };
            await apiFetch('/sales/refund', {
                method: 'POST',
                body: payload
            });
        }

        showSuccess(`Qaytarish amalga oshirildi: ${items.length} ta mahsulot`);

        await Promise.all([
            loadProducts(),
            loadSales(),
            loadWarehouseLogs(),
            loadWarehouseDebt()
        ]);

        document.getElementById('refundItemsBody').innerHTML = '';
        addRefundRow();
        document.getElementById('refundCustomer').value = '';
        document.getElementById('refundGlobalDescription').value = '';

        renderAllTables();
        updateStatistics();
        updateBrandStats('akitoy');
        updateWarehouseDebtDisplay();

    } catch (error) {
        console.error('Refund error:', error);
        showError('Qaytarishda xatolik: ' + error.message);
    }
}

async function generateRefundPDF() {
    const items = collectRefundItems();
    if (!items) return;

    const date = document.getElementById('refundDate').value;
    const customer = document.getElementById('refundCustomer').value.trim();
    const globalDesc = document.getElementById('refundGlobalDescription').value.trim();

    const totalAmount = items.reduce((sum, it) => sum + it.total, 0);
    const totalQuantity = items.reduce((sum, it) => sum + it.quantity, 0);

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    try {
        const logoUrl = '/Akiltoys.png';
        const logoImg = await loadImage(logoUrl);
        doc.addImage(logoImg, 'PNG', 15, 10, 30, 30);
    } catch (e) {
        console.warn('Logo yuklanmadi');
    }

    doc.setFontSize(22);
    doc.setTextColor(255, 193, 7);
    doc.text('Akil Box', 55, 25);
    doc.setFontSize(18);
    doc.setTextColor(0, 0, 0);
    doc.text('MAHSULOT QAYTARISH', 55, 35);

    const parts = date.split('-');
    const formattedDate = `${parts[2]}.${parts[1]}.${parts[0]}`;
    const refundNumber = `REF-${Date.now().toString().slice(-6)}`;
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`№: ${refundNumber} | Sana: ${formattedDate}`, 55, 45);

    let yPos = 70;
    if (customer) {
        doc.setFontSize(12);
        doc.text(`Mijoz: ${customer}`, 15, yPos);
        yPos += 7;
    }
    if (globalDesc) {
        doc.setFontSize(10);
        doc.text(`Izoh: ${globalDesc}`, 15, yPos);
        yPos += 7;
    }
    yPos += 5;

    const tableHeaders = [['№', 'Mahsulot', 'Miqdor', 'Sotish narxi', 'Kirim narxi', 'Jami (UZS)']];
    const tableData = items.map((item, index) => [
        (index + 1).toString(),
        item.productName,
        item.quantity.toString(),
        item.price.toLocaleString('uz-UZ'),
        item.cost.toLocaleString('uz-UZ'),
        item.total.toLocaleString('uz-UZ')
    ]);

    doc.autoTable({
        startY: yPos,
        head: tableHeaders,
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [255, 193, 7], textColor: 0, fontStyle: 'bold' },
        styles: { fontSize: 10, cellPadding: 3, overflow: 'linebreak' },
        columnStyles: {
            0: { cellWidth: 10 },
            1: { cellWidth: 'auto' },
            2: { cellWidth: 20 },
            3: { cellWidth: 30 },
            4: { cellWidth: 30 },
            5: { cellWidth: 35 }
        },
        margin: { left: 15, right: 15 }
    });

    const finalY = doc.lastAutoTable.finalY || 150;
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text(`Jami qaytarilgan summa: ${totalAmount.toLocaleString('uz-UZ')} UZS`, 120, finalY + 15);
    doc.setFontSize(10);
    doc.text(`Jami mahsulot: ${totalQuantity} dona`, 120, finalY + 22);

    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text('Akil Box - O\'yinchoqlar do\'koni', 15, 280);
    doc.text('Tel: +998 98 302 77 76 | +998 77 302 77 66', 15, 285);
    doc.text(new Date().toLocaleDateString('uz-UZ'), 15, 290);

    const safeCustomer = customer ? customer.replace(/[^a-zA-Z0-9а-яА-ЯёЁ]/g, '_').substring(0, 30) : 'mijoz';
    const filename = `Refund_${safeCustomer}_${date.replace(/-/g, '.')}.pdf`;
    doc.save(filename);
}

// Экспорт глобальных функций
window.addRefundRow = addRefundRow;
window.removeRefundRow = removeRefundRow;
window.addMultipleRefundRows = addMultipleRefundRows;
window.processRefundTable = processRefundTable;
window.generateRefundPDF = generateRefundPDF;
window.initRefundTab = initRefundTab;
window.showLoading = showLoading;
window.hideLoading = hideLoading;
window.initializeApp = initializeApp;
window.showAddProductModal = showAddProductModal;
window.showEditProductModal = showEditProductModal;
window.showAddUserModal = showAddUserModal;
window.showSaleModal = showSaleModal;
window.confirmSaleAction = confirmSaleAction;
window.saveProduct = saveProduct;
window.deleteProduct = deleteProduct;
window.addToWarehouse = addToWarehouse;
window.saveUser = saveUser;
window.deleteUser = deleteUser;
window.editUser = editUser;
window.updateSaleTotal = updateSaleTotal;
window.calculateWarehouseTotal = calculateWarehouseTotal;
window.searchProducts = searchProducts;
window.previewImage = previewImage;
window.changePeriod = changePeriod;
window.generateInvoice = generateInvoice;
window.generateInvoicePDF = generateInvoicePDF;
window.showFullReport = showFullReport;
window.showProfitReport = showProfitReport;
window.showWarehouseReport = showWarehouseReport;
window.confirmClearMonthReports = confirmClearMonthReports;
window.downloadReport = downloadReport;
window.printReport = printReport;
window.DokonApp = DokonApp;
window.addWarehousePayment = addWarehousePayment;
window.generateReportPDF = generateReportPDF;
window.printInvoice = printInvoice;
window.loadUserLogs = loadUserLogs;
window.renderUserLogsTable = renderUserLogsTable;
window.updateUserLogsFilter = updateUserLogsFilter;
window.updateBrandStats = updateBrandStats;
window.loadNotifications = loadNotifications;
window.handleNotificationClick = handleNotificationClick;
window.clearAllNotifications = clearAllNotifications;
window.createNotification = createNotification;
window.initializeNotifications = initializeNotifications;
window.loadNasiyaData = loadNasiyaData;
window.showAddNasiyaClientModal = showAddNasiyaClientModal;
window.showCreateNasiyaSaleModal = showCreateNasiyaSaleModal;
window.addToNasiyaCart = addToNasiyaCart;
window.removeFromNasiyaCart = removeFromNasiyaCart;
window.confirmNasiyaSale = confirmNasiyaSale;
window.saveNasiyaClient = saveNasiyaClient;
window.addPaymentToClient = addPaymentToClient;
window.processNasiyaPayment = processNasiyaPayment;
window.showNasiyaPaymentModal = showNasiyaPaymentModal;
window.showNasiyaClientDetails = showNasiyaClientDetails;
window.generateNasiyaClientPDF = generateNasiyaClientPDF;
window.showCreateNasiyaSaleModalForClient = showCreateNasiyaSaleModalForClient;
window.checkNasiyaReminders = checkNasiyaReminders;
window.deleteNotification = deleteNotification;
window.clearReadNotifications = clearReadNotifications;
window.markAllNotificationsRead = markAllNotificationsRead;
window.showNotificationsModal = showNotificationsModal;
window.searchNasiyaClients = searchNasiyaClients;
window.deleteNasiyaClient = deleteNasiyaClient;
window.resetNasiyaSearch = resetNasiyaSearch;
window.sendRemindersToAllUsers = sendRemindersToAllUsers;
window.broadcastNotification = broadcastNotification;
window.filterReminders = filterReminders;
window.filterRemindersByDate = filterRemindersByDate;
window.changeReminderPage = changeReminderPage;
window.showAllReminders = showAllReminders;
window.markAllRemindersAsSent = markAllRemindersAsSent;
window.toggleAllReminders = toggleAllReminders;
window.getPaymentDateClass = getPaymentDateClass;
window.formatDaysUntil = formatDaysUntil;
window.sendSingleReminder = sendSingleReminder;
window.deleteReminder = deleteReminder;
window.destroyAllCharts = destroyAllCharts;
window.createNewNasiyaClient = createNewNasiyaClient;
window.processNasiyaPayment = processNasiyaPayment;
window.saveBulkWarehouseReceive = saveBulkWarehouseReceive;
window.addMultipleBulkRows = addMultipleBulkRows;
window.initRefundAutocomplete = initRefundAutocomplete;
window.showCreateNasiyaSaleModalForClient = function(clientId) {
    showCreateNasiyaSaleModal();
    if (clientId) {
        const hidden = document.getElementById('nasiyaSaleClientId');
        const search = document.getElementById('nasiyaSaleClientSearch');
        const client = DokonApp.nasiyaData.clients.find(c => c.id === clientId);
        if (hidden) hidden.value = clientId;
        if (search && client) search.value = client.name;
        if (typeof updateNasiyaClientInfo === 'function') updateNasiyaClientInfo();
    }
};

function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function addNotificationsButton() {
    const notificationsButton = `
        <button class="btn btn-primary position-relative" onclick="showNotificationsModal()">
            <i class="fas fa-bell"></i>
            ${DokonNotifications.unreadCount > 0 ? 
                `<span class="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger">
                    ${DokonNotifications.unreadCount}
                </span>` : ''
            }
        </button>
    `;
    
    const navbar = document.querySelector('.navbar-nav');
    if (navbar) {
        navbar.insertAdjacentHTML('beforeend', `
            <li class="nav-item ms-2">
                ${notificationsButton}
            </li>
        `);
    }
}

function showNotificationToast(title, message, type) {
    const toast = document.createElement('div');
    toast.className = `toast align-items-center text-bg-${type === 'high' ? 'danger' : type === 'medium' ? 'warning' : 'info'} position-fixed top-0 end-0 m-3`;
    toast.style.zIndex = '9999';
    toast.innerHTML = `
        <div class="d-flex">
            <div class="toast-body">
                <strong>${title}</strong><br>
                ${message}
            </div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
        </div>
    `;
    
    document.body.appendChild(toast);
    const bsToast = new bootstrap.Toast(toast, { autohide: true, delay: 5000 });
    bsToast.show();
    
    setTimeout(() => {
        toast.remove();
    }, 6000);
}

async function saveBulkWarehouseReceive() {
    console.log('=== BULK RECEIVE DEBUG BOSHLANDI ===');

    if (!DokonApp.currentUser) {
        showError('Foydalanuvchi topilmadi. Qayta kirish kerak.');
        return;
    }

    const allowedRoles = ['warehouse', 'admin', 'superadmin'];
    if (!allowedRoles.includes(DokonApp.currentUser.role)) {
        showError('Bu amalni faqat omborchi yoki admin bajarishi mumkin');
        return;
    }

    const token = localStorage.getItem('dokon_token');
    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    const dateInput = document.getElementById('bulkWarehouseDate');
    const date = dateInput?.value?.trim();
    if (!date) {
        showError('Qabul qilish sanasini kiriting');
        dateInput?.focus();
        return;
    }

    const rows = document.querySelectorAll('#bulkWarehouseItems tr');
    if (rows.length === 0) {
        showError('Hech qanday mahsulot qo‘shilmagan');
        return;
    }

    let items = [];
    let totalCost = 0;
    const errors = [];
    const seenProductIds = new Set();

    rows.forEach((row, index) => {
        const rowNum = index + 1;

        const hiddenInput = row.querySelector('.bulk-product-id');
        const quantityInput = row.querySelector('.bulk-quantity');
        const costInput = row.querySelector('.bulk-cost');

        if (!hiddenInput || !quantityInput || !costInput) return;

        const productId = hiddenInput.value?.trim();
        const quantity = parseInt(quantityInput.value?.trim() || '0', 10);
        const cost = parseFloat(costInput.value?.trim() || '0');

        if (!productId && quantity === 0 && cost === 0) return;

        if (!productId) {
            errors.push(`Qator ${rowNum}: mahsulot tanlanmagan`);
            return;
        }
        if (quantity <= 0 || isNaN(quantity)) {
            errors.push(`Qator ${rowNum}: miqdor 1 dan kam bo‘lmasligi kerak`);
            return;
        }
        if (cost <= 0 || isNaN(cost)) {
            errors.push(`Qator ${rowNum}: kirim narxi 0 dan katta bo‘lishi kerak`);
            return;
        }
        if (seenProductIds.has(productId)) {
            errors.push(`Qator ${rowNum}: mahsulot (ID: ${productId}) allaqachon qo‘shilgan`);
            return;
        }
        seenProductIds.add(productId);

        const product = DokonApp.products.find(p => 
            p.id === productId || p._id === productId || p._id?.toString() === productId
        );

        if (!product) {
            errors.push(`Qator ${rowNum}: mahsulot topilmadi (ID: ${productId})`);
            return;
        }

        const itemTotal = quantity * cost;
        items.push({
            productId: productId,
            productName: product.name || 'Noma\'lum',
            productType: product.type || 'akitoy',
            quantity: quantity,
            cost: cost,
            totalCost: itemTotal
        });
        totalCost += itemTotal;
    });

    if (errors.length > 0) {
        showError(errors.join('<br>'));
        return;
    }
    if (items.length === 0) {
        showError('Hech qanday to‘g‘ri mahsulot kiritilmagan');
        return;
    }

    try {
        showLoading(`Ommaviy qabul: ${items.length} ta mahsulot, jami ${totalCost.toLocaleString('uz-UZ')} so‘m...`);

        const payload = {
            items: items,
            date: date,
            type: currentBulkType || 'akitoy'
        };

        const response = await apiFetch('/warehouse/bulk-receive', {
            method: 'POST',
            body: JSON.stringify(payload)
        });

        if (!response?.success) {
            throw new Error(response?.message || 'Server javobi muvaffaqiyatsiz');
        }

        showSuccess(`Muvaffaqiyat! ${items.length} ta mahsulot qo‘shildi. Jami: ${totalCost.toLocaleString('uz-UZ')} UZS.`);

        generateBulkWarehousePDF(items, date, response.receiptId);

        await Promise.all([
            loadProducts(),
            loadWarehouseLogs(),
            loadWarehouseDebt()
        ]);

        const tableBody = document.getElementById('bulkWarehouseItems');
        if (tableBody) {
            tableBody.innerHTML = '';
            addBulkWarehouseRow();
        }

        if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];
        updateBulkWarehouseTotal?.();
        renderAllTables?.();
        updateStatistics?.();
        updateWarehouseDebtDisplay?.();
        updateBrandStats?.('akitoy');

    } catch (err) {
        console.error('Bulk receive xatosi:', err);
        showError(`Xatolik yuz berdi: ${err.message || 'Server bilan bog‘lanib bo‘lmadi'}.`);
    } finally {
        hideLoading();
        console.log('=== BULK RECEIVE DEBUG TUGADI ===');
    }
}

function generateBulkWarehousePDF(items, date, receiptId) {
    const brandName = 'Akil Box';
    const totalAmount = items.reduce((sum, i) => sum + i.totalCost, 0);
    const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);

    const printWindow = window.open('', '_blank');
    const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Ombor qabul qilish - ${brandName}</title>
            <style>
                @page { margin: 15mm; }
                body { font-family: Arial, sans-serif; margin: 0; padding: 20px; color: #333; }
                .header { text-align: center; border-bottom: 2px solid #4361ee; padding-bottom: 15px; margin-bottom: 20px; }
                .logo-container { margin-bottom: 10px; }
                .logo { max-width: 100px; height: auto; }
                .company-name { font-size: 24px; font-weight: bold; color: #4361ee; }
                .report-title { font-size: 20px; margin: 10px 0; }
                .details { margin: 20px 0; background: #f8f9fa; padding: 15px; border-radius: 8px; }
                table { width: 100%; border-collapse: collapse; margin: 20px 0; }
                th { background: #4361ee; color: white; padding: 10px; text-align: left; }
                td { padding: 8px 10px; border-bottom: 1px solid #ddd; }
                tr:nth-child(even) { background: #f8f9fa; }
                .total { font-size: 18px; font-weight: bold; text-align: right; margin-top: 20px; }
                .footer { margin-top: 40px; text-align: center; font-size: 12px; color: #666; border-top: 1px solid #ddd; padding-top: 20px; }
            </style>
        </head>
        <body>
            <div class="header">
                <div class="logo-container">
                    <img src="/Akiltoys.png" alt="Akil Box Logo" class="logo">
                </div>
                <div class="company-name">Akil Box</div>
                <div class="report-title">OMBORGA QABUL QILISH</div>
                <div style="margin-top: 10px;">
                    <strong>${brandName}</strong> | Sana: ${date} | № ${receiptId || 'BULK-' + Date.now().toString().slice(-6)}
                </div>
            </div>

            <div class="details">
                <p><strong>Jami mahsulotlar:</strong> ${items.length} xil</p>
                <p><strong>Jami miqdor:</strong> ${itemCount} dona</p>
                <p><strong>Jami summa:</strong> ${totalAmount.toLocaleString('uz-UZ')} UZS</p>
            </div>

            <table>
                <thead>
                    <tr>
                        <th>№</th>
                        <th>Mahsulot nomi</th>
                        <th>Miqdor (dona)</th>
                        <th>Kirim narxi (UZS)</th>
                        <th>Jami (UZS)</th>
                    </tr>
                </thead>
                <tbody>
                    ${items.map((item, index) => `
                        <tr>
                            <td>${index + 1}</td>
                            <td>${escapeHtml(item.productName)}</td>
                            <td>${item.quantity}</td>
                            <td>${item.cost.toLocaleString('uz-UZ')}</td>
                            <td>${item.totalCost.toLocaleString('uz-UZ')}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>

            <div class="total">
                Umumiy summa: ${totalAmount.toLocaleString('uz-UZ')} UZS
            </div>

            <div style="margin-top: 30px; display: flex; justify-content: space-between;">
                <div>Qabul qildi: ____________________</div>
                <div>Tekshirdi: ____________________</div>
            </div>

            <div class="footer">
                <p>Akil Box - o'yinchoqlar do'koni | Tel: +998 98 302 77 76</p>
                <p>${new Date().toLocaleDateString('uz-UZ')} ${new Date().toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}</p>
            </div>
        </body>
        </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();

    setTimeout(() => {
        printWindow.print();
        printWindow.close();
    }, 500);
}

function createSalesChart(sales) {
    const ctx = document.getElementById('reportChart');
    if (!ctx) return;
    
    if (window.salesChart) {
        try {
            window.salesChart.destroy();
        } catch (e) {
            console.warn('Ошибка при уничтожении salesChart:', e);
        }
        window.salesChart = null;
    }
    
    const dailySales = {};
    sales.forEach(sale => {
        const date = sale.date ? sale.date.split('T')[0] : 'Noma\'lum';
        if (!dailySales[date]) {
            dailySales[date] = { revenue: 0, profit: 0 };
        }
        dailySales[date].revenue += sale.total || 0;
        dailySales[date].profit += sale.profit || 0;
    });
    
    const dates = Object.keys(dailySales).sort();
    const revenues = dates.map(date => dailySales[date].revenue);
    const profits = dates.map(date => dailySales[date].profit);
    
    window.salesChart = new Chart(ctx.getContext('2d'), {
        type: 'bar',
        data: {
            labels: dates,
            datasets: [
                {
                    label: 'Daromad (UZS)',
                    data: revenues,
                    backgroundColor: 'rgba(67, 97, 238, 0.7)',
                    borderColor: 'rgba(67, 97, 238, 1)',
                    borderWidth: 1
                },
                {
                    label: 'Foyda (UZS)',
                    data: profits,
                    backgroundColor: 'rgba(76, 201, 240, 0.7)',
                    borderColor: 'rgba(76, 201, 240, 1)',
                    borderWidth: 1
                }
            ]
        },
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: 'Kunlik sotuvlar'
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return value.toLocaleString('uz-UZ') + ' UZS';
                        }
                    }
                }
            }
        }
    });
}

function createProfitAndDebtChart(totalProfit, totalDebt) {
    const ctx = document.getElementById('reportChart');
    if (!ctx) return;
    
    if (window.profitAndDebtChart) {
        try {
            window.profitAndDebtChart.destroy();
        } catch (e) {
            console.warn('Ошибка при уничтожении profitAndDebtChart:', e);
        }
        window.profitAndDebtChart = null;
    }
    
    window.profitAndDebtChart = new Chart(ctx.getContext('2d'), {
        type: 'bar',
        data: {
            labels: ['Akil Box'],
            datasets: [
                {
                    label: 'Foyda (UZS)',
                    data: [totalProfit],
                    backgroundColor: 'rgba(40, 167, 69, 0.7)',
                    borderColor: 'rgba(40, 167, 69, 1)',
                    borderWidth: 1
                },
                {
                    label: 'Qarzdorlik (UZS)',
                    data: [totalDebt],
                    backgroundColor: 'rgba(220, 53, 69, 0.7)',
                    borderColor: 'rgba(220, 53, 69, 1)',
                    borderWidth: 1
                }
            ]
        },
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: 'Foyda va qarzdorlik'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            label += context.parsed.y.toLocaleString('uz-UZ') + ' UZS';
                            return label;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return value.toLocaleString('uz-UZ') + ' UZS';
                        }
                    }
                }
            }
        }
    });
}