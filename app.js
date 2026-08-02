// === АВТОРИЗАЦИЯ ===
function checkPassword() {
    const input = document.getElementById('passwordInput').value;
    if (input === CONFIG.ADMIN_PASSWORD) {
        sessionStorage.setItem('adminAuth', 'true');
        showAdminPanel();
    } else {
        document.getElementById('loginError').textContent = 'Неверный пароль!';
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

// Проверка при загрузке
if (sessionStorage.getItem('adminAuth') === 'true') {
    showAdminPanel();
}

// === ЗАГРУЗКА НАШИДОВ ===
async function loadNasheeds() {
    const listEl = document.getElementById('nasheedList');
    listEl.innerHTML = '<p>Загрузка...</p>';

    try {
        // Получаем список файлов из папки audio
        const response = await fetch(`https://api.github.com/repos/${CONFIG.GITHUB_USERNAME}/${CONFIG.GITHUB_REPO}/contents/${CONFIG.AUDIO_PATH}`, {
            headers: {
                'Authorization': `token ${CONFIG.GITHUB_TOKEN}`
            }
        });

        const files = await response.json();
        const mp3Files = files.filter(f => f.name.endsWith('.mp3'));

        if (mp3Files.length === 0) {
            listEl.innerHTML = '<p>Нашиды не найдены</p>';
            return;
        }

        // Загружаем app.js для получения информации о нашидах
        const appJsResponse = await fetch(`https://raw.githubusercontent.com/${CONFIG.GITHUB_USERNAME}/${CONFIG.GITHUB_REPO}/main/app.js`);
        const appJsContent = await appJsResponse.text();
        
        // Парсим массив nasheeds из app.js
        const nasheedsMatch = appJsContent.match(/const nasheeds = \[([\s\S]*?)\];/);
        let nasheeds = [];
        
        if (nasheedsMatch) {
            try {
                // Простой парсинг (для production лучше использовать JSON)
                nasheeds = eval(`[${nasheedsMatch[1]}]`);
            } catch (e) {
                console.error('Ошибка парсинга:', e);
            }
        }

        // Отображаем список
        listEl.innerHTML = mp3Files.map(file => {
            const nasheed = nasheeds.find(n => n.file === `${CONFIG.AUDIO_PATH}/${file.name}`);
            return `
                <div class="nasheed-item">
                    <div class="nasheed-info">
                        <h3>${nasheed ? nasheed.title : file.name}</h3>
                        <p>${nasheed ? nasheed.artist : 'Неизвестно'} • ${nasheed ? nasheed.duration : ''}</p>
                    </div>
                    <button class="delete-btn" onclick="deleteNasheed('${file.name}')">🗑 Удалить</button>
                </div>
            `;
        }).join('');

    } catch (error) {
        listEl.innerHTML = `<p class="error">Ошибка загрузки: ${error.message}</p>`;
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
        // Конвертируем файл в base64
        const reader = new FileReader();
        reader.onload = async () => {
            const base64 = reader.result.split(',')[1];
            const fileName = file.name.replace(/\s+/g, '-').toLowerCase();

            // Загружаем файл на GitHub
            const uploadResponse = await fetch(`https://api.github.com/repos/${CONFIG.GITHUB_USERNAME}/${CONFIG.GITHUB_REPO}/contents/${CONFIG.AUDIO_PATH}/${fileName}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `token ${CONFIG.GITHUB_TOKEN}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: `Добавлен нашид: ${title}`,
                    content: base64
                })
            });

            if (!uploadResponse.ok) {
                throw new Error('Ошибка загрузки файла');
            }

            // Обновляем app.js
            await updateAppJs(title, artist, fileName, duration);

            showStatus('✅ Нашид успешно добавлен!', 'success');
            document.getElementById('addForm').reset();
            loadNasheeds();
        };
        reader.readAsDataURL(file);

    } catch (error) {
        showStatus(`❌ Ошибка: ${error.message}`, 'error');
    }
});

// === ОБНОВЛЕНИЕ APP.JS ===
async function updateAppJs(title, artist, fileName, duration) {
    // Получаем текущий app.js
    const response = await fetch(`https://api.github.com/repos/${CONFIG.GITHUB_USERNAME}/${CONFIG.GITHUB_REPO}/contents/app.js`, {
        headers: {
            'Authorization': `token ${CONFIG.GITHUB_TOKEN}`
        }
    });

    const data = await response.json();
    const content = atob(data.content);

    // Добавляем новый нашид в массив
    const newNasheed = `
    {
        title: "${title}",
        artist: "${artist}",
        file: "${CONFIG.AUDIO_PATH}/${fileName}",
        duration: "${duration}"
    }`;

    // Находим позицию перед ]; в конце массива
    const lastBracket = content.lastIndexOf('];');
    const updatedContent = content.slice(0, lastBracket) + ',\n' + newNasheed + '\n' + content.slice(lastBracket);

    // Загружаем обновлённый файл
    await fetch(`https://api.github.com/repos/${CONFIG.GITHUB_USERNAME}/${CONFIG.GITHUB_REPO}/contents/app.js`, {
        method: 'PUT',
        headers: {
            'Authorization': `token ${CONFIG.GITHUB_TOKEN}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            message: `Добавлен нашид: ${title}`,
            content: btoa(updatedContent),
            sha: data.sha
        })
    });
}

// === УДАЛЕНИЕ НАШИДА ===
async function deleteNasheed(fileName) {
    if (!confirm(`Удалить нашид ${fileName}?`)) return;

    try {
        // Удаляем файл
        const fileResponse = await fetch(`https://api.github.com/repos/${CONFIG.GITHUB_USERNAME}/${CONFIG.GITHUB_REPO}/contents/${CONFIG.AUDIO_PATH}/${fileName}`, {
            headers: {
                'Authorization': `token ${CONFIG.GITHUB_TOKEN}`
            }
        });

        const fileData = await fileResponse.json();

        await fetch(`https://api.github.com/repos/${CONFIG.GITHUB_USERNAME}/${CONFIG.GITHUB_REPO}/contents/${CONFIG.AUDIO_PATH}/${fileName}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `token ${CONFIG.GITHUB_TOKEN}`
            },
            body: JSON.stringify({
                message: `Удалён нашид: ${fileName}`,
                sha: fileData.sha
            })
        });

        // TODO: Также нужно удалить запись из app.js
        alert('Файл удалён! Также нужно удалить запись из app.js вручную.');
        loadNasheeds();

    } catch (error) {
        alert(`Ошибка: ${error.message}`);
    }
}

function showStatus(message, type) {
    const statusEl = document.getElementById('uploadStatus');
    statusEl.textContent = message;
    statusEl.className = type;
    setTimeout(() => {
        statusEl.style.display = 'none';
    }, 5000);
}
