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

        // Проверяем, что это массив
        if (!Array.isArray(data)) {
            console.error('Ответ API:', data);
            listEl.innerHTML = `<p class="error">Ошибка: ${data.message || 'Неизвестная ошибка'}</p>`;
            return;
        }

        const mp3Files = data.filter(f => f.name && f.name.endsWith('.mp3'));

        if (mp3Files.length === 0) {
            listEl.innerHTML = '<p>Нашиды не найдены</p>';
            return;
        }

        // Загружаем app.js из основного репозитория
        const appJsResponse = await fetch(
            `https://raw.githubusercontent.com/${CONFIG.GITHUB_USERNAME}/${CONFIG.GITHUB_REPO}/main/app.js`
        );
        const appJsContent = await appJsResponse.text();

        // Парсим массив nasheeds
        const nasheedsMatch = appJsContent.match(/const nasheeds = \[([\s\S]*?)\];/);
        let nasheeds = [];

        if (nasheedsMatch) {
            try {
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
        console.error(error);
    }
}
