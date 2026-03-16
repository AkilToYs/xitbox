// login.js - авторизация через API
const API_URL = window.location.origin;

// Убираем любой "автозапуск" fetch — всё только по нажатию на кнопку

async function apiRequest(endpoint, method = 'GET', body = null, requireJson = true) {
    const token = localStorage.getItem('dokon_token');
    const headers = { 'Accept': 'application/json' };
    if (body && !(body instanceof FormData)) headers['Content-Type'] = 'application/json';
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const options = { method, headers };
    if (body) options.body = (body instanceof FormData) ? body : JSON.stringify(body);

      const res = await fetch(`${API_URL}${endpoint}`, options);
console.log(`API Request: ${endpoint} - Status: ${res.status}`);  // Добавьте это для отладки
if (res.status === 401) {
    console.error('Unauthorized:', await res.text());
    return { ok: false, status: 401, body: null };
}

    if (requireJson) {
        const json = await res.json().catch(() => null);
        return { ok: res.ok, status: res.status, body: json };
    } else {
        return { ok: res.ok, status: res.status, body: null };
    }
}

async function login() {
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;

    if (!username || !password) {
        alert('Введите login и пароль');
        return;
    }

    try {
        const r = await apiRequest('/api/auth/login', 'POST', { username, password });
        if (!r.ok) {
            const msg = (r.body && r.body.message) ? r.body.message : 'Неверный логин/пароль';
            alert(msg);
            return;
        }
        const data = r.body;
        localStorage.setItem('dokon_token', data.token);
        localStorage.setItem('dokon_user', JSON.stringify(data.user));
        // редирект на основную страницу
        window.location.href = 'dokon.html';
    } catch (err) {
        console.error('Login error', err);
        alert('Ошибка соединения с сервером');
    }
}

// проверка авторизации при загрузке страницы
document.addEventListener('DOMContentLoaded', async () => {
    // toggle пароля + clear btn привязки делаем после DOMContentLoaded
    const passwordInput = document.getElementById('password');
    const toggleBtn = document.getElementById('togglePassword');
    if (toggleBtn && passwordInput) {
        toggleBtn.addEventListener('click', () => {
            if (passwordInput.type === 'password') {
                passwordInput.type = 'text';
                toggleBtn.textContent = '🙈';
            } else {
                passwordInput.type = 'password';
                toggleBtn.textContent = '👁';
            }
        });
    }

    // clear localStorage button
    const clearBtn = document.getElementById('clearStorageBtn');
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            localStorage.removeItem('dokon_token');
            localStorage.removeItem('dokon_user');
            alert('LocalStorage очищен');
            console.log('LocalStorage after clear:', localStorage);
        });
    }

    // Если пользователь уже авторизован — проверяем валидность токена
    const token = localStorage.getItem('dokon_token');
    if (!token) return;

    try {
        const r = await apiRequest('/api/auth/verify', 'GET');
        if (r.ok && r.body?.valid) {
            window.location.href = 'dokon.html';
        } else {
            localStorage.removeItem('dokon_token');
            localStorage.removeItem('dokon_user');
        }
    } catch {
        // ничего не делаем
    }
});
