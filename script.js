// KONSTANTA DAN ELEMEN DOM
const DOMElements = {
    sidebarToggle: document.getElementById('sidebarToggle'),
    mainAppHeader: document.getElementById('mainAppHeader'),
    mainTitle: document.getElementById('mainTitle'),
    mainContent: document.getElementById('mainContent'),
    dynamicContent: document.getElementById('dynamicContent'),
    overlay: document.getElementById('overlay'),
    tocSidebar: null, // Referensi ke sidebar TOC yang dibuat secara dinamis
    headerMainNav: document.querySelector('.header-main-nav'), // Referensi ke navigasi utama di header
};

// Pola Regex untuk URL navigasi yang diperbarui
const URL_REGEX = {
    // Mengubah pola agar tidak menyertakan '/series' di awal
    SERIES_DETAIL: /^\/([a-zA-Z0-9_-]+)$/,
    // Mengubah pola agar tidak menyertakan '/volume/' literal di tengah
    VOLUME_READ: /^\/([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_-]+)$/, // Matches /seriesId/volumeId
    // Mengubah pola agar tidak menyertakan '/volume/' literal di tengah
    CHAPTER_READ: /^\/([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_-]+)\/chapter\/(\d+)$/, // Matches /seriesId/volumeId/chapter/chapterIndex
};

// MANAJEMEN STATUS APLIKASI
const appState = {
    isMobile: false,
    isTocSidebarOpen: false, // Melacak apakah sidebar dinamis tunggal terbuka
    currentView: 'home', // 'home', 'series-detail', 'volume-read'
    currentSeriesId: null,
    currentVolumeId: null,
    currentChapterIndex: 0,
    currentVolumeChapters: [],
    currentVolumeData: null,
};

// UTILITAS UMUM
const debounce = (func, delay) => {
    let timeout;
    return function(...args) { // Memperbaiki bug: menggunakan ...args
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), delay); // Memperbaiki bug: menggunakan args
    };
};

// LAYANAN DATA (FETCHING & CACHING)
const dataService = {
    CACHE_PREFIX: 'app_data_cache_',
    CACHE_EXPIRATION_SECONDS: 300, // Waktu kedaluwarsa cache dalam detik (misal: 300 detik = 5 menit)

    /**
     * Mengambil data dari localStorage.
     * @param {string} key Kunci cache.
     * @returns {object|null} Objek cache termasuk data, timestamp, dan status kedaluwarsa, atau null jika tidak ada/error.
     */
    getCache(key) {
        try {
            const cachedItem = localStorage.getItem(this.CACHE_PREFIX + key);
            if (!cachedItem) {
                return null;
            }
            const { data, timestamp } = JSON.parse(cachedItem);
            const now = new Date().getTime();
            return { data, timestamp, isExpired: (now - timestamp >= this.CACHE_EXPIRATION_SECONDS * 1000) };
        } catch (e) {
            console.error('Error reading from cache:', e);
            localStorage.removeItem(this.CACHE_PREFIX + key); // Hapus cache yang rusak
            return null;
        }
    },

    /**
     * Menyimpan data ke localStorage dengan timestamp.
     * @param {string} key Kunci cache.
     * @param {any} data Data yang akan disimpan.
     */
    setCache(key, data) {
        try {
            const itemToCache = {
                data: data,
                timestamp: new Date().getTime() // Simpan stempel waktu saat ini
            };
            localStorage.setItem(this.CACHE_PREFIX + key, JSON.stringify(itemToCache));
        } catch (e) {
            console.error('Error writing to cache:', e);
        }
    },

    /**
     * Mengambil file JSON dari jaringan, dengan fallback ke cache lokal.
     * @param {string} path Jalur file JSON (harus absolut, dimulai dengan '/').
     * @returns {Promise<object|null>} Data JSON atau null jika gagal.
     */
    async fetchJson(path) {
        const cacheKey = path;
        let cachedData = this.getCache(cacheKey);

        console.log(`Mencoba mengambil data dari jaringan untuk: ${path} (mengizinkan cache HTTP browser)`);
        try {
            // Mengizinkan browser untuk menggunakan mekanisme cache HTTP standar (ETag, Last-Modified)
            const response = await fetch(path);
            
            console.log("Fetch response details for:", path);
            console.log("Response URL:", response.url);
            console.log("Response Status:", response.status);
            console.log("Response OK:", response.ok);
            console.log("Response Content-Type:", response.headers.get('Content-Type'));

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`Respons tidak OK untuk ${path}. Status: ${response.status}. Teks respons: ${errorText.substring(0, 200)}...`);
                throw new Error(`Failed to load ${path}: ${response.statusText}`);
            }

            const contentType = response.headers.get('Content-Type');
            if (!contentType || !contentType.includes('application/json')) {
                const responseText = await response.text();
                console.error(`Respons bukan JSON untuk ${path}. Content-Type: ${contentType}. Teks respons awal: ${responseText.substring(0, 200)}...`);
                throw new Error(`Expected JSON but received ${contentType || 'unknown type'}`);
            }

            const data = await response.json();
            this.setCache(cacheKey, data);
            console.log(`Berhasil mengambil data terbaru dari jaringan untuk: ${path}`);
            return data;

        } catch (error) {
            console.error(`Gagal mengambil data dari jaringan untuk ${path}. Mencoba menggunakan cache lokal sebagai fallback:`, error);
            
            if (cachedData && cachedData.data) {
                console.log(`Menggunakan data dari cache lokal (sebagai fallback) untuk: ${path}`);
                return cachedData.data;
            } else {
                DOMElements.dynamicContent.innerHTML = `<div class="text-center py-10 text-red-500">Konten belum tersedia atau gagal dimuat. Silakan coba lagi nanti atau hubungi administrator.</div>`;
                return null;
            }
        }
    },

    /**
     * Mengembalikan jalur gambar bab yang absolut.
     * @param {string} seriesId ID seri.
     * @param {string} volumeId ID volume.
     * @param {string} imageName Nama file gambar.
     * @returns {string} Jalur absolut ke gambar bab.
     */
    getChapterImagePath(seriesId, volumeId, imageName) {
        // Jalur ini mengacu pada lokasi file di server, tidak perlu diubah
        return `/images/${seriesId}/${volumeId}/${imageName}`;
    },

    /**
     * Mengembalikan jalur cover gambar yang absolut.
     * @param {string} relativePath Jalur relatif cover.
     * @returns {string} Jalur absolut ke gambar cover.
     */
    getAbsoluteCoverPath(relativePath) {
        if (!relativePath) {
            return '';
        }
        if (relativePath.startsWith('/') || relativePath.startsWith('http://') || relativePath.startsWith('https://')) {
            return relativePath;
        }
        return '/' + relativePath;
    }
};

// LAYANAN UI (RENDERING KONTEN)
const uiService = {
    /**
     * Merender konten dengan efek transisi fade-out/fade-in.
     * @param {string} contentHtml HTML konten yang akan dirender.
     */
    async renderContentWithTransition(contentHtml) {
        DOMElements.dynamicContent.classList.add('fade-out');
        await new Promise(resolve => setTimeout(resolve, 300));
        DOMElements.dynamicContent.innerHTML = contentHtml;
        DOMElements.dynamicContent.classList.remove('fade-out');
    },

    /**
     * Membuat atau memperbarui konten sidebar dinamis.
     */
    renderDynamicSidebarContent() {
        if (!DOMElements.tocSidebar) {
            console.log("Creating tocSidebar DOM element."); // Log tambahan
            const tocSidebarElement = document.createElement('aside');
            tocSidebarElement.id = 'tocSidebar';
            tocSidebarElement.classList.add('app-sidebar', 'toc-sidebar-hidden');
            document.body.appendChild(tocSidebarElement);
            DOMElements.tocSidebar = tocSidebarElement;

            tocSidebarElement.addEventListener('click', (event) => {
                if (event.target.closest('#closeTocSidebar')) {
                    app.toggleTocSidebar(false);
                }
            });
        }

        let sidebarContentHtml = '';
        let sidebarTitle = '';

        if (appState.currentView === 'volume-read') {
            sidebarTitle = 'Daftar Isi Volume';
            let chaptersHtml = '';
            console.log("Rendering sidebar for volume-read. currentVolumeChapters:", appState.currentVolumeChapters); // Log tambahan untuk debugging
            if (appState.currentVolumeChapters && appState.currentVolumeChapters.length > 0) {
                appState.currentVolumeChapters.forEach((chapter, index) => {
                    const isActive = index === appState.currentChapterIndex ? 'active' : '';
                    chaptersHtml += `
                        <li class="toc-menu-item">
                            <a href="#" onclick="navigationService.goToChapter('${appState.currentSeriesId}', '${appState.currentVolumeId}', ${index}); app.toggleTocSidebar(false); return false;" class="flex items-center ${isActive}">
                                <span class="material-icons text-xl flex-shrink-0 mr-2">menu_book</span>
                                <span class="text-sm">${chapter.judul}</span>
                            </a>
                        </li>
                    `;
                });
            } else {
                chaptersHtml = `<li class="toc-menu-item text-gray-500 px-3 py-2">Tidak ada bab ditemukan.</li>`;
            }

            // Menghapus tombol "Kembali ke Seri" dari sidebar
            sidebarContentHtml = `
                ${chaptersHtml}
            `;
        } else { // 'home' or 'series-detail' view
            sidebarTitle = 'Menu Utama';
            sidebarContentHtml = `
                <li class="toc-menu-item">
                    <a href="#" onclick="navigationService.goToHomepage(); app.toggleTocSidebar(false); return false;" class="flex items-center">
                        <span class="material-icons mr-2">home</span>
                        Beranda
                    </a>
                </li>
                <li class="border-t border-gray-200 my-2"></li>
                <li class="toc-menu-item">
                    <a href="#" class="flex items-center text-gray-600 hover:text-black">
                        <span class="material-icons mr-2">info</span>
                        Tentang
                    </a>
                </li>
                <li class="toc-menu-item">
                    <a href="#" class="flex items-center text-gray-600 hover:text-black">
                        <span class="material-icons mr-2">email</span>
                        Kontak
                    </a>
                </li>
                <li class="toc-menu-item">
                    <a href="#" class="flex items-center text-gray-600 hover:text-black">
                        <span class="material-icons mr-2">security</span>
                        Kebijakan Privasi
                    </a>
                </li>
            `;
        }

        DOMElements.tocSidebar.innerHTML = `
            <header class="toc-header">
                <h2 class="text-xl font-semibold">${sidebarTitle}</h2>
                <button id="closeTocSidebar" class="p-2 hover:bg-gray-100 rounded md:hidden">
                    <span class="material-icons text-xl">close</span>
                </button>
            </header>
            <nav class="toc-nav">
                <ul class="space-y-2">
                    ${sidebarContentHtml}
                </ul>
            </nav>
        `;

        if (appState.isMobile && !appState.isTocSidebarOpen) {
            DOMElements.tocSidebar.classList.add('toc-sidebar-hidden');
        }
    },

    /**
     * Menyembunyikan sidebar TOC dan overlay.
     */
    removeTocSidebar() {
        if (DOMElements.tocSidebar) {
            DOMElements.tocSidebar.classList.add('toc-sidebar-hidden');
            appState.isTocSidebarOpen = false;
        }
        DOMElements.overlay.classList.add('hidden');
    },

    /**
     * Merender konten halaman beranda.
     * @param {Array<object>} seriesIndex Data indeks seri.
     */
    async renderHomepageContent(seriesIndex) {
        let seriesHtml = ``;
        seriesIndex.forEach(series => {
            let badgeColorClass = '';
            if (series.format === 'Light Novel') {
                badgeColorClass = 'bg-blue-500';
            } else if (series.format === 'Manga') {
                badgeColorClass = 'bg-green-500';
            } else if (series.format === 'Web Novel') {
                badgeColorClass = 'bg-purple-500';
            } else {
                badgeColorClass = 'bg-gray-500';
            }

            seriesHtml += `
                <article class="cursor-pointer hover:opacity-80 transition-opacity series-card" onclick="navigationService.goToSeriesDetail('${series.id}')">
                    <div class="aspect-[3/4] bg-gray-100 border border-gray-200 mb-3 flex items-center justify-center overflow-hidden relative">
                        ${series.cover ? `<img src="${dataService.getAbsoluteCoverPath(series.cover)}" alt="${series.judul}" class="w-full h-full object-cover series-cover-image" loading="lazy">` : `<svg class="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path>
                        </svg>`}
                        ${series.format ? `<span class="absolute top-2 left-2 px-2 py-1 text-xs font-semibold text-white rounded-full ${badgeColorClass}">${series.format}</span>` : ''}
                    </div>
                    <h3 class="text-sm font-medium line-clamp-2 series-title">${series.judul}</h3>
                </article>
            `;
        });

        const contentHtml = `
            <h2 class="text-2xl font-semibold mb-8 page-title">Light Novel Terbaru</h2>
            <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 series-grid">
                ${seriesHtml}
            </div>
        `;
        uiService.renderContentWithTransition(contentHtml);
    },

    /**
     * Merender konten halaman detail seri.
     * @param {object} info Data informasi seri.
     * @param {Array<object>} volumes Data volume seri.
     */
    async renderSeriesDetailContent(info, volumes) {
        let volumesHtml = '';
        volumes.forEach(volume => {
            volumesHtml += `
                <div class="cursor-pointer hover:opacity-80 transition-opacity volume-card" onclick="navigationService.goToVolume('${appState.currentSeriesId}', '${volume.id}')">
                    <div class="aspect-[3/4] bg-gray-100 border border-gray-200 mb-2 flex items-center justify-center overflow-hidden volume-cover-placeholder">
                        ${volume.cover ? `<img src="${dataService.getAbsoluteCoverPath(volume.cover)}" alt="${volume.judul}" class="w-full h-full object-cover volume-cover-image" loading="lazy">` : `<svg class="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path>
                        </svg>`}
                    </div>
                    <h4 class="text-xs font-medium text-center volume-title">${volume.judul}</h4>
                </div>
            `;
        });

        const contentHtml = `
            <div class="mb-6">
                <!-- Tombol "Kembali ke Beranda" dihapus dari sini -->
            </div>
            <div class="series-detail-container">
                <div class="flex flex-col md:flex-row gap-6 mb-8 series-header-section">
                    <div class="w-full md:w-80 flex-shrink-0 series-poster-wrapper">
                        <div class="aspect-[3/4] bg-gray-100 border border-gray-200 flex items-center justify-center overflow-hidden series-poster-placeholder">
                            ${info.cover ? `<img src="${dataService.getAbsoluteCoverPath(info.cover)}" alt="${info.judul}" class="w-full h-full object-cover series-poster-image" loading="lazy">` : `<svg class="w-16 h-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path>
                            </svg>`}
                        </div>
                    </div>
                    
                    <div class="flex-1 series-info-section">
                        <h1 class="text-3xl font-bold mb-4 series-title">${info.judul}</h1>
                        <div class="flex flex-wrap items-center gap-x-4 gap-y-2 text-gray-600 mb-4 series-metadata">
                            <div class="flex items-center series-author">
                                <span class="material-icons text-sm mr-1 align-middle">person</span>
                                ${info.penulis}
                            </div>
                            <div class="flex items-center series-release-date">
                                <span class="material-icons text-sm mr-1 align-middle">calendar_today</span>
                                ${info.rilis}
                            </div>
                            <div class="flex items-center series-genre">
                                <span class="material-icons text-sm mr-1">label</span>
                                ${info.genre}
                            </div>
                            <div class="flex items-center series-status">
                                <span class="material-icons text-sm mr-1">info</span>
                                ${info.status}
                            </div>
                        </div>
                        
                        <div class="series-synopsis">
                            <h3 class="text-xl font-semibold mb-3">Sinopsis</h3>
                            <p class="mb-4">${info.deskripsi}</p>
                        </div>
                    </div>
                </div>
                
                <div class="prose max-w-none series-volumes-section">
                    <h3 class="text-xl font-semibold mb-3">Volume Terkait</h3>
                    <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6 volumes-grid">
                        ${volumesHtml}
                    </div>
                </div>
            </div>
        `;
        uiService.renderContentWithTransition(contentHtml);
    },

    /**
     * Merender konten bab.
     * @param {object} chapterData Data bab.
     * @param {object} volumeData Data volume.
     * @param {number} chapterIndex Indeks bab saat ini.
     * @param {number} totalChapters Jumlah total bab dalam volume.
     */
    async renderChapterContent(chapterData, volumeData, chapterIndex, totalChapters) {
        let chapterContentHtml = '';
        chapterData.konten.forEach(item => {
            if (item.paragraf) {
                chapterContentHtml += `<p class="mb-4 chapter-paragraph">${item.paragraf}</p>`;
            } else if (item.gambar) {
                chapterContentHtml += `
                    <div class="my-6 text-center chapter-image-wrapper">
                        <img src="${dataService.getChapterImagePath(appState.currentSeriesId, appState.currentVolumeId, item.gambar)}" alt="Gambar ilustrasi" class="max-w-full h-auto mx-auto rounded-lg shadow-md chapter-image" loading="lazy">
                    </div>
                `;
            } else if (item.kutipan) {
                chapterContentHtml += `
                    <blockquote class="border-l-4 border-gray-300 pl-4 py-2 my-4 italic text-gray-700 chapter-quote">
                        "${item.kutipan}"
                    </blockquote>
                `;
            } else if (item.dialog) {
                let dialogHtml = '';
                item.dialog.forEach(d => {
                    dialogHtml += `<p class="mb-2 chapter-dialog-line"><strong class="text-blue-700 chapter-dialog-character">${d.karakter}:</strong> <span class="chapter-dialog-speech">${d.ucapan}</span></p>`;
                });
                chapterContentHtml += `<div class="bg-gray-50 p-4 rounded-lg my-4 chapter-dialog-block">${dialogHtml}</div>`;
            }
        });
        
        const prevButton = chapterIndex > 0 ? 
            `<button onclick="navigationService.goToChapter('${appState.currentSeriesId}', '${appState.currentVolumeId}', ${chapterIndex - 1})" class="flex items-center px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded chapter-nav-button chapter-nav-prev">
                <span class="material-icons mr-2">arrow_back</span>
                Bab Sebelumnya
            </button>` : '';
        
        const nextButton = chapterIndex < totalChapters - 1 ? 
            `<button onclick="navigationService.goToChapter('${appState.currentSeriesId}', '${appState.currentVolumeId}', ${chapterIndex + 1})" class="flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded chapter-nav-button chapter-nav-next">
                Bab Selanjutnya
                <span class="material-icons ml-2">arrow_forward</span>
            </button>` : '';
        
        const contentHtml = `
            <div class="chapter-navigation-top">
                <!-- Tombol "Kembali ke Volume" dihapus dari sini -->
            </div>
            
            <div class="chapter-content-wrapper">
                <h2 class="text-2xl font-semibold mb-4 chapter-title">${chapterData.judul}</h2>
                ${chapterContentHtml}
                
                <div class="flex justify-between items-center mt-8 pt-6 border-t border-gray-200 chapter-navigation-bottom">
                    <div>${prevButton}</div>
                    <div>${nextButton}</div>
                </div>
            </div>
        `;
        uiService.renderContentWithTransition(contentHtml);

        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
};

// LAYANAN NAVIGASI (MANAJEMEN URL & STATE)
const navigationService = {
    /**
     * Memperbarui appState berdasarkan perubahan navigasi.
     * @param {string} view Nama tampilan baru ('home', 'series-detail', 'volume-read').
     * @param {string|null} seriesId ID seri (opsional).
     * @param {string|null} volumeId ID volume (opsional).
     * @param {number|null} chapterIndex Indeks bab (opsional).
     */
    _updateAppState(view, seriesId = null, volumeId = null, chapterIndex = 0) {
        console.log("Entering _updateAppState. Proposed view:", view, "isMobile:", appState.isMobile);
        appState.currentView = view;
        appState.currentSeriesId = seriesId;
        appState.currentVolumeId = volumeId;
        appState.currentChapterIndex = chapterIndex;
        console.log("Exiting _updateAppState. Current appState:", appState);
    },

    /**
     * Memuat konten berdasarkan URL saat ini.
     */
    async loadContentFromUrl() {
        const path = window.location.pathname;
        console.log("Loading content from URL:", path);

        let match;

        if (path === '/' || path === '/index.html') {
            this._updateAppState('home');
            const seriesIndex = await dataService.fetchJson('/series/series-index.json');
            if (seriesIndex) uiService.renderHomepageContent(seriesIndex);
            appState.isTocSidebarOpen = false; // Pastikan TOC tertutup di halaman beranda
            app.applyLayoutClasses(); // Terapkan layout
        } else if ((match = path.match(URL_REGEX.CHAPTER_READ))) {
            const seriesId = match[1];
            const volumeId = match[2];
            const chapterIndex = parseInt(match[3], 10);
            
            this._updateAppState('volume-read', seriesId, volumeId, chapterIndex);

            // Jalur fetch data JSON tetap menggunakan '/series/' karena itu adalah struktur folder di server
            const volumeData = await dataService.fetchJson(`/series/${seriesId}/${volumeId}/${volumeId}.json`);
            if (!volumeData) {
                appState.isTocSidebarOpen = false; // Sembunyikan TOC jika data volume gagal dimuat
                app.applyLayoutClasses(); // Terapkan layout
                return;
            }

            appState.currentVolumeChapters = volumeData.bab;
            appState.currentVolumeData = volumeData;
            
            // Panggil renderDynamicSidebarContent di sini setelah appState.currentVolumeChapters diisi
            uiService.renderDynamicSidebarContent();
            // Hanya buka sidebar secara otomatis di desktop
            appState.isTocSidebarOpen = !appState.isMobile;
            app.applyLayoutClasses(); // Terapkan kelas layout untuk menampilkan sidebar
            
            const chapterInfo = appState.currentVolumeChapters[chapterIndex];
            if (!chapterInfo) {
                DOMElements.dynamicContent.innerHTML = `<div class="text-center py-10 text-red-500">Bab tidak ditemukan.</div>`;
                appState.isTocSidebarOpen = false; // Sembunyikan TOC jika bab tidak ditemukan
                app.applyLayoutClasses(); // Terapkan layout
                return;
            }
            // Jalur fetch data JSON tetap menggunakan '/series/'
            const chapterData = await dataService.fetchJson(`/series/${seriesId}/${volumeId}/${chapterInfo.file}`);
            if (chapterData) uiService.renderChapterContent(chapterData, volumeData, chapterIndex, appState.currentVolumeChapters.length);

        } else if ((match = path.match(URL_REGEX.VOLUME_READ))) {
            const seriesId = match[1];
            const volumeId = match[2];

            // Ketika URL hanya sampai volume, kita navigasi ke bab 0 dan perbarui URL
            this._updateAppState('volume-read', seriesId, volumeId, 0); // Default ke bab 0
            // Memperbarui URL di history tanpa menambah entri history baru
            // URL sekarang akan menjadi /seriesId/volumeId/chapter/0
            history.replaceState(null, '', `/${seriesId}/${volumeId}/chapter/0`);

            // Jalur fetch data JSON tetap menggunakan '/series/'
            const volumeData = await dataService.fetchJson(`/series/${seriesId}/${volumeId}/${volumeId}.json`);
            if (!volumeData) {
                appState.isTocSidebarOpen = false; // Sembunyikan TOC jika data volume gagal dimuat
                app.applyLayoutClasses(); // Terapkan layout
                return;
            }

            appState.currentVolumeChapters = volumeData.bab;
            appState.currentVolumeData = volumeData;

            // Panggil renderDynamicSidebarContent di sini setelah appState.currentVolumeChapters diisi
            uiService.renderDynamicSidebarContent();
            // Hanya buka sidebar secara otomatis di desktop
            appState.isTocSidebarOpen = !appState.isMobile;
            app.applyLayoutClasses(); // Terapkan kelas layout untuk menampilkan sidebar

            if (appState.currentVolumeChapters && appState.currentVolumeChapters.length > 0) {
                const firstChapterInfo = appState.currentVolumeChapters[0];
                // Jalur fetch data JSON tetap menggunakan '/series/'
                const chapterData = await dataService.fetchJson(`/series/${seriesId}/${volumeId}/${firstChapterInfo.file}`);
                if (chapterData) uiService.renderChapterContent(chapterData, volumeData, 0, appState.currentVolumeChapters.length);
            } else {
                DOMElements.dynamicContent.innerHTML = `<div class="text-center py-10 text-gray-500">Tidak ada bab ditemukan untuk volume ini.</div>`;
                appState.isTocSidebarOpen = false; // Sembunyikan TOC jika tidak ada bab
                app.applyLayoutClasses(); // Terapkan layout
            }

        } else if ((match = path.match(URL_REGEX.SERIES_DETAIL))) {
            const seriesId = match[1];
            this._updateAppState('series-detail', seriesId);
            // Jalur fetch data JSON tetap menggunakan '/series/'
            const info = await dataService.fetchJson(`/series/${seriesId}/info.json`);
            const volumes = await dataService.fetchJson(`/series/${seriesId}/volumes.json`);
            if (info && volumes) uiService.renderSeriesDetailContent(info, volumes);
            appState.isTocSidebarOpen = false; // Pastikan TOC tertutup di halaman detail seri
            app.applyLayoutClasses(); // Terapkan layout
        } else {
            console.warn("URL tidak dikenal, mengarahkan ke beranda:", path);
            this.goToHomepage(); // Gunakan goToHomepage untuk mendorong URL yang benar
        }
    },

    /**
     * Navigasi ke halaman beranda.
     */
    goToHomepage() {
        history.pushState(null, '', '/');
        this.loadContentFromUrl();
    },

    /**
     * Navigasi ke halaman detail seri.
     * @param {string} seriesId ID seri.
     */
    goToSeriesDetail(seriesId) {
        // Memperbarui URL di history
        history.pushState(null, '', `/${seriesId}`);
        this.loadContentFromUrl();
    },

    /**
     * Navigasi ke halaman volume.
     * @param {string} seriesId ID seri.
     * @param {string} volumeId ID volume.
     */
    goToVolume(seriesId, volumeId) {
        // Langsung navigasi ke bab 0 dari volume tersebut dan perbarui URL
        // Menghilangkan literal '/volume/' dari URL yang ditampilkan
        history.pushState(null, '', `/${seriesId}/${volumeId}/chapter/0`);
        this.loadContentFromUrl();
    },

    /**
     * Navigasi ke halaman bab.
     * @param {string} seriesId ID seri.
     * @param {string} volumeId ID volume.
     * @param {number} chapterIndex Indeks bab.
     */
    goToChapter(seriesId, volumeId, chapterIndex) {
        // Memperbarui URL di history
        // Menghilangkan literal '/volume/' dari URL yang ditampilkan
        history.pushState(null, '', `/${seriesId}/${volumeId}/chapter/${chapterIndex}`);
        this.loadContentFromUrl();
    }
};

// FUNGSI UTAMA APLIKASI
const app = {
    /**
     * Menerapkan kelas layout berdasarkan status mobile/desktop dan sidebar.
     */
    applyLayoutClasses() {
        console.log("applyLayoutClasses called. appState.isMobile:", appState.isMobile, "appState.currentView:", appState.currentView, "appState.isTocSidebarOpen:", appState.isTocSidebarOpen, "DOMElements.tocSidebar:", DOMElements.tocSidebar);

        // Reset default styles/classes first to ensure clean state
        DOMElements.mainContent.style.marginLeft = '0';
        DOMElements.mainAppHeader.style.left = '0';
        document.body.classList.remove('toc-active');
        DOMElements.overlay.classList.add('hidden'); // Hide overlay by default

        if (appState.isMobile) {
            DOMElements.mainContent.classList.add('main-mobile-full');
            DOMElements.sidebarToggle.style.display = 'block';

            if (DOMElements.tocSidebar) {
                if (appState.isTocSidebarOpen) {
                    DOMElements.tocSidebar.classList.remove('toc-sidebar-hidden');
                    DOMElements.overlay.classList.remove('hidden');
                } else {
                    DOMElements.tocSidebar.classList.add('toc-sidebar-hidden');
                }
            }
        } else { // Desktop
            DOMElements.mainContent.classList.remove('main-mobile-full');
            DOMElements.sidebarToggle.style.display = 'none';
            if (appState.currentView === 'volume-read' && DOMElements.tocSidebar) {
                console.log("Desktop: currentView is volume-read AND tocSidebar exists. Showing TOC.");
                DOMElements.tocSidebar.classList.remove('toc-sidebar-hidden');
                DOMElements.mainContent.style.marginLeft = '256px';
                DOMElements.mainAppHeader.style.left = '256px';
                document.body.classList.add('toc-active');
            } else {
                console.log("Desktop: Not volume-read or no TOC sidebar, hiding TOC.");
                if (DOMElements.tocSidebar) { // Only hide if it exists
                    DOMElements.tocSidebar.classList.add('toc-sidebar-hidden');
                }
            }
        }
    },

    /**
     * Memeriksa apakah perangkat adalah mobile dan menyesuaikan layout.
     */
    checkMobile() {
        const wasMobile = appState.isMobile;
        appState.isMobile = window.innerWidth < 768;

        if (wasMobile !== appState.isMobile) {
            app.applyLayoutClasses();
            // Ketika status mobile berubah, pastikan sidebar tertutup jika sedang terbuka
            if (appState.isTocSidebarOpen) {
                app.toggleTocSidebar(false);
            }
        }
    },

    /**
     * Mengelola pembukaan/penutupan sidebar dinamis.
     * @param {boolean|null} forceState Jika true/false, akan memaksa status sidebar.
     */
    toggleTocSidebar(forceState = null) {
        const newState = forceState !== null ? forceState : !appState.isTocSidebarOpen;
        appState.isTocSidebarOpen = newState;
        
        // Pastikan konten dirender/diperbarui sebelum menerapkan layout
        uiService.renderDynamicSidebarContent();
        app.applyLayoutClasses();
    },

    /**
     * Menyiapkan semua event listener aplikasi.
     */
    setupEventListeners() {
        DOMElements.sidebarToggle.addEventListener('click', () => app.toggleTocSidebar());
        DOMElements.overlay.addEventListener('click', function() {
            if (appState.isMobile) {
                app.toggleTocSidebar(false);
            }
        });

        window.addEventListener('resize', debounce(app.checkMobile, 200));
        window.addEventListener('popstate', navigationService.loadContentFromUrl);

        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                if (appState.isMobile && appState.isTocSidebarOpen) {
                    app.toggleTocSidebar(false);
                }
            }
        });

        document.addEventListener('DOMContentLoaded', function() {
            app.checkMobile();
            navigationService.loadContentFromUrl();
        });
    }
};

// INISIALISASI APLIKASI
app.setupEventListeners();
