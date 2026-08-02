// Проверяем, что CONFIG загрузился
if (typeof CONFIG === 'undefined') {
    alert('Ошибка: config.js не загрузился! Проверь, что файл существует.');
}

// === АВТОРИЗАЦИЯ ===
function checkPassword() {
    const input = document.getElementById('passwordInput').value;
    const correctPassword = CONFIG.ADMIN_PASSWORD;
    
    console.log('Введён пароль:', input);
    console.log('Правильный пароль:', correctPassword);
    
    if (input === correctPassword) {
        sessionStorage.setItem('adminAuth', 'true');
        showAdminPanel();
    } else {
        document.getElementById('loginError').textContent = '❌ Неверный пароль!';
    }
}

function logout() {
    sessionStorage.removeItem('adminAuth');
    location.reload();
}

function showAdminPanel() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('adminPanel').style.display = 'block';
    loadNasheeds();
}

// Проверяем авторизацию при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    console.log('Страница загрузилась');
    console.log('CONFIG:', CONFIG);
    
    if (sessionStorage.getItem('adminAuth') === 'true') {
        showAdminPanel();
    }
});

// === ЗАГРУЗКА НАШИДОВ ===
async function loadNasheeds() {
    const listEl = document.getElementById('nasheedList');
    listEl.innerHTML = '<p>Загрузка...</p>';

    try {
        const response = await fetch(
            `https://api.github.com/repos/${CONFIG.GITHUB_USERNAME}/${CONFIG.GITHUB_REPO}/contents/${CONFIG.AUDIO_PATH}`,
            {
                headers: {
                    'Authorization': `token ${CONFIG.GITHUB_TOKEN}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            }
        );

        const data = await response.json();

        if (!Array.isArray(data)) {
            listEl.innerHTML = `<p class="error">Ошибка: ${data.message || 'Неизвестная ошибка'}</p>`;
            return;
        }

        const mp3Files = data.filter(f => f.name && f.name.endsWith('.mp3'));

        if (mp3Files.length === 0) {
            listEl.innerHTML = '<p>Нашиды не найдены</p>';
            return;
        }

        listEl.innerHTML = mp3Files.map(file => `
            <div class="nasheed-item">
                <div class="nasheed-info">
                    <h3>${file.name}</h3>
                </div>
            </div>
        `).join('');

    } catch (error) {
        listEl.innerHTML = `<p class="error">Ошибка: ${error.message}</p>`;
        console.error(error);
    }
}

// === ДОБАВЛЕНИЕ НАШИДА ===
document.getElementById('addForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const title = document.getElementById('title').value;
    const artist = document.getElementById('artist').value;
    const duration = document.getElementById('duration').value;
    const fileInput = document.getElementById('audioFile');
    const file = fileInput.files[0];

    if (!file) {
        showStatus('Выберите файл!', 'error');
        return;
    }

    const statusEl = document.getElementById('uploadStatus');
    statusEl.className = '';
    statusEl.textContent = 'Загрузка...';
    statusEl.style.display = 'block';

    try {
        const reader = new FileReader();
        reader.onload = async () => {
            const base64 = reader.result.split(',')[1];
            const fileName = file.name.replace(/\s+/g, '-').toLowerCase();

            const uploadResponse = await fetch(
                `https://api.github.com/repos/${CONFIG.GITHUB_USERNAME}/${CONFIG.GITHUB_REPO}/contents/${CONFIG.AUDIO_PATH}/${fileName}`,
                {
                    method: 'PUT',
                    headers: {
                        'Authorization': `token ${CONFIG.GITHUB_TOKEN}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        message: `Добавлен нашид: ${title}`,
                        content: base64
                    })
                }
            );

            if (!uploadResponse.ok) {
                const errorData = await uploadResponse.json();
                throw new Error(errorData.message || 'Ошибка загрузки');
            }

            showStatus('✅ Файл загружен! Теперь добавьте информацию в app.js вручную.', 'success');
            document.getElementById('addForm').reset();
        };
        reader.readAsDataURL(file);

    } catch (error) {
        showStatus(`❌ Ошибка: ${error.message}`, 'error');
        console.error(error);
    }
});

function showStatus(message, type) {
    const statusEl = document.getElementById('uploadStatus');
    statusEl.textContent = message;
    statusEl.className = type;
    statusEl.style.display = 'block';
    setTimeout(() => {
        statusEl.style.display = 'none';
    }, 5000);
}
