const DOMElements = {
    sidebarToggle: document.getElementById('sidebarToggle'),
    mainAppHeader: document.getElementById('mainAppHeader'),
    mainTitle: document.getElementById('mainTitle'),
    mainContent: document.getElementById('mainContent'),
    dynamicContent: document.getElementById('dynamicContent'),
    overlay: document.getElementById('overlay'),
    tocSidebar: null, // Reference to the dynamically created TOC sidebar
    headerMainNav: document.querySelector('.header-main-nav'), // Reference to the main nav in header
};

const appState = {
    isMobile: false,
    isTocSidebarOpen: false, // Tracks if the single dynamic sidebar is open
    currentView: 'home', // 'home', 'series-detail', 'volume-read'
    currentSeriesId: null,
    currentVolumeId: null,
    currentChapterIndex: 0,
    currentVolumeChapters: [],
    currentVolumeData: null,
};

const debounce = (func, delay) => {
    let timeout;
    return function(...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), delay);
    };
};

const dataService = {
    CACHE_PREFIX: 'app_data_cache_',
    CACHE_EXPIRATION_SECONDS: 300,

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
            localStorage.removeItem(this.CACHE_PREFIX + key);
            return null;
        }
    },

    setCache(key, data) {
        try {
            const itemToCache = {
                data: data,
                timestamp: new Date().getTime()
            };
            localStorage.setItem(this.CACHE_PREFIX + key, JSON.stringify(itemToCache));
        } catch (e) {
            console.error('Error writing to cache:', e);
        }
    },

    async fetchJson(path) {
        const cacheKey = path;
        let cachedData = this.getCache(cacheKey);

        console.log(`Mencoba mengambil data dari jaringan untuk: ${path} (mengizinkan cache HTTP browser)`);
        try {
            const response = await fetch(path); 
            
            // --- LOGGING TAMBAHAN UNTUK DIAGNOSIS ---
            console.log("Fetch response details for:", path);
            console.log("Response URL:", response.url);
            console.log("Response Status:", response.status);
            console.log("Response OK:", response.ok);
            console.log("Response Content-Type:", response.headers.get('Content-Type'));
            // --- AKHIR LOGGING TAMBAHAN ---

            if (!response.ok) {
                // Jika respons tidak OK, coba baca teksnya untuk debugging lebih lanjut
                const errorText = await response.text();
                console.error(`Respons tidak OK untuk ${path}. Status: ${response.status}. Teks respons: ${errorText.substring(0, 200)}...`);
                throw new Error(`Failed to load ${path}: ${response.statusText}`);
            }

            // Periksa Content-Type sebelum parsing JSON
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

    getChapterImagePath(seriesId, volumeId, imageName) {
        return `images/${seriesId}/${volumeId}/${imageName}`;
    }
};

const uiService = {
    async renderContentWithTransition(contentHtml) {
        DOMElements.dynamicContent.classList.add('fade-out');
        await new Promise(resolve => setTimeout(resolve, 300));
        DOMElements.dynamicContent.innerHTML = contentHtml;
        DOMElements.dynamicContent.classList.remove('fade-out');
    },

    // Function to create or update the single dynamic sidebar content
    renderDynamicSidebarContent() {
        // Create sidebar element if it doesn't exist
        if (!DOMElements.tocSidebar) {
            const tocSidebarElement = document.createElement('aside');
            tocSidebarElement.id = 'tocSidebar';
            tocSidebarElement.classList.add('app-sidebar', 'toc-sidebar-hidden'); // Add hidden class initially
            document.body.appendChild(tocSidebarElement);
            DOMElements.tocSidebar = tocSidebarElement;

            // Attach event listener for close button
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

            sidebarContentHtml = `
                <li class="toc-menu-item">
                    <a href="#" onclick="navigationService.goToSeriesDetail('${appState.currentSeriesId}'); app.toggleTocSidebar(false); return false;" class="flex items-center">
                        <span class="material-icons mr-2">arrow_back</span>
                        Kembali ke Seri
                    </a>
                </li>
                <li class="border-t border-gray-200 my-2"></li>
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

        // Ensure it's hidden on mobile initially if not explicitly opened
        if (appState.isMobile && !appState.isTocSidebarOpen) {
            DOMElements.tocSidebar.classList.add('toc-sidebar-hidden');
        }
    },

    removeTocSidebar() {
        // This function will now just hide the sidebar, not remove it from DOM
        if (DOMElements.tocSidebar) {
            DOMElements.tocSidebar.classList.add('toc-sidebar-hidden');
            appState.isTocSidebarOpen = false; // Reset state
        }
        DOMElements.overlay.classList.add('hidden');
    },

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
                        ${series.cover ? `<img src="${series.cover}" alt="${series.judul}" class="w-full h-full object-cover series-cover-image" loading="lazy">` : `<svg class="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

    async renderSeriesDetailContent(info, volumes) {
        let volumesHtml = '';
        volumes.forEach(volume => {
            volumesHtml += `
                <div class="cursor-pointer hover:opacity-80 transition-opacity volume-card" onclick="navigationService.goToVolume('${appState.currentSeriesId}', '${volume.id}')">
                    <div class="aspect-[3/4] bg-gray-100 border border-gray-200 mb-2 flex items-center justify-center overflow-hidden volume-cover-placeholder">
                        ${volume.cover ? `<img src="${volume.cover}" alt="${volume.judul}" class="w-full h-full object-cover volume-cover-image" loading="lazy">` : `<svg class="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path>
                        </svg>`}
                    </div>
                    <h4 class="text-xs font-medium text-center volume-title">${volume.judul}</h4>
                </div>
            `;
        });

        const contentHtml = `
            <div class="mb-6">
                <button onclick="navigationService.goToHomepage()" class="flex items-center text-gray-600 hover:text-black mb-4 back-to-homepage-button">
                    <span class="material-icons mr-2">arrow_back</span>
                    Kembali ke Beranda
                </button>
            </div>
            <div class="series-detail-container">
                <div class="flex flex-col md:flex-row gap-6 mb-8 series-header-section">
                    <div class="w-full md:w-80 flex-shrink-0 series-poster-wrapper">
                        <div class="aspect-[3/4] bg-gray-100 border border-gray-200 flex items-center justify-center overflow-hidden series-poster-placeholder">
                            ${info.cover ? `<img src="${info.cover}" alt="${info.judul}" class="w-full h-full object-cover series-poster-image" loading="lazy">` : `<svg class="w-16 h-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                <button onclick="navigationService.goToVolume('${appState.currentSeriesId}', '${appState.currentVolumeId}')" class="flex items-center text-gray-600 hover:text-black mb-4 back-to-volume-button">
                    <span class="material-icons mr-2">arrow_back</span>
                    Kembali ke Volume
                </button>
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

const navigationService = {
    // Fungsi untuk memuat konten berdasarkan URL saat ini
    async loadContentFromUrl() {
        const path = window.location.pathname;
        console.log("Loading content from URL:", path);

        // Regex untuk mencocokkan pola URL
        const seriesDetailRegex = /^\/series\/([a-zA-Z0-9_-]+)$/;
        const volumeReadRegex = /^\/series\/([a-zA-Z0-9_-]+)\/volume\/([a-zA-Z0-9_-]+)$/;
        const chapterReadRegex = /^\/series\/([a-zA-Z0-9_-]+)\/volume\/([a-zA-Z0-9_-]+)\/chapter\/(\d+)$/;

        let match;

        if (path === '/' || path === '/index.html') {
            appState.currentView = 'home';
            appState.currentSeriesId = null;
            appState.currentVolumeId = null;
            appState.currentChapterIndex = 0;
            uiService.removeTocSidebar();
            app.applyLayoutClasses();
            const seriesIndex = await dataService.fetchJson('series/series-index.json');
            if (seriesIndex) uiService.renderHomepageContent(seriesIndex);
        } else if ((match = path.match(chapterReadRegex))) {
            const seriesId = match[1];
            const volumeId = match[2];
            const chapterIndex = parseInt(match[3], 10);
            
            appState.currentView = 'volume-read';
            appState.currentSeriesId = seriesId;
            appState.currentVolumeId = volumeId;
            appState.currentChapterIndex = chapterIndex;

            const volumeData = await dataService.fetchJson(`series/${seriesId}/${volumeId}/${volumeId}.json`);
            if (!volumeData) return;

            appState.currentVolumeChapters = volumeData.bab;
            appState.currentVolumeData = volumeData;
            
            // Toggle sidebar based on mobile/desktop view
            if (!appState.isMobile) {
                app.toggleTocSidebar(true);
            } else {
                app.toggleTocSidebar(false);
            }
            app.applyLayoutClasses();

            const chapterInfo = appState.currentVolumeChapters[chapterIndex];
            if (!chapterInfo) {
                DOMElements.dynamicContent.innerHTML = `<div class="text-center py-10 text-red-500">Bab tidak ditemukan.</div>`;
                return;
            }
            const chapterData = await dataService.fetchJson(`series/${seriesId}/${volumeId}/${chapterInfo.file}`);
            if (chapterData) uiService.renderChapterContent(chapterData, volumeData, chapterIndex, appState.currentVolumeChapters.length);

        } else if ((match = path.match(volumeReadRegex))) {
            const seriesId = match[1];
            const volumeId = match[2];

            appState.currentView = 'volume-read'; // Set view for volume, which also uses TOC
            appState.currentSeriesId = seriesId;
            appState.currentVolumeId = volumeId;
            appState.currentChapterIndex = 0; // Reset chapter index when entering a new volume

            const volumeData = await dataService.fetchJson(`series/${seriesId}/${volumeId}/${volumeId}.json`);
            if (!volumeData) return;

            appState.currentVolumeChapters = volumeData.bab;
            appState.currentVolumeData = volumeData;

            // Toggle sidebar based on mobile/desktop view
            if (!appState.isMobile) {
                app.toggleTocSidebar(true);
            } else {
                app.toggleTocSidebar(false);
            }
            app.applyLayoutClasses();

            // Render the first chapter of the volume by default
            if (appState.currentVolumeChapters && appState.currentVolumeChapters.length > 0) {
                const firstChapterInfo = appState.currentVolumeChapters[0];
                const chapterData = await dataService.fetchJson(`series/${seriesId}/${volumeId}/${firstChapterInfo.file}`);
                if (chapterData) uiService.renderChapterContent(chapterData, volumeData, 0, appState.currentVolumeChapters.length);
            } else {
                DOMElements.dynamicContent.innerHTML = `<div class="text-center py-10 text-gray-500">Tidak ada bab ditemukan untuk volume ini.</div>`;
            }

        } else if ((match = path.match(seriesDetailRegex))) {
            const seriesId = match[1];
            appState.currentView = 'series-detail';
            appState.currentSeriesId = seriesId;
            appState.currentVolumeId = null;
            appState.currentChapterIndex = 0;
            uiService.removeTocSidebar();
            app.applyLayoutClasses();
            const info = await dataService.fetchJson(`series/${seriesId}/info.json`);
            const volumes = await dataService.fetchJson(`series/${seriesId}/volumes.json`);
            if (info && volumes) uiService.renderSeriesDetailContent(info, volumes);
        } else {
            // Fallback to homepage if URL doesn't match any pattern
            console.warn("URL tidak dikenal, mengarahkan ke beranda:", path);
            navigationService.goToHomepage(); // Use goToHomepage to push the correct URL
        }
    },

    // Fungsi navigasi yang akan memperbarui URL dan memuat konten
    goToHomepage() {
        history.pushState(null, '', '/');
        navigationService.loadContentFromUrl();
    },

    goToSeriesDetail(seriesId) {
        history.pushState(null, '', `/series/${seriesId}`);
        navigationService.loadContentFromUrl();
    },

    goToVolume(seriesId, volumeId) {
        history.pushState(null, '', `/series/${seriesId}/volume/${volumeId}`);
        navigationService.loadContentFromUrl();
    },

    goToChapter(seriesId, volumeId, chapterIndex) {
        history.pushState(null, '', `/series/${seriesId}/volume/${volumeId}/chapter/${chapterIndex}`);
        navigationService.loadContentFromUrl();
    }
};

const app = {
    applyLayoutClasses() {
        if (appState.isMobile) {
            DOMElements.mainContent.classList.add('main-mobile-full');
            DOMElements.mainContent.style.marginLeft = '0';
            DOMElements.mainAppHeader.style.left = '0';
            DOMElements.sidebarToggle.style.display = 'block';

            if (DOMElements.tocSidebar) {
                if (appState.isTocSidebarOpen) {
                    DOMElements.tocSidebar.classList.remove('toc-sidebar-hidden');
                    DOMElements.overlay.classList.remove('hidden');
                } else {
                    DOMElements.tocSidebar.classList.add('toc-sidebar-hidden');
                    DOMElements.overlay.classList.add('hidden');
                }
            } else {
                DOMElements.overlay.classList.add('hidden');
            }

        } else {
            DOMElements.mainContent.classList.remove('main-mobile-full');
            DOMElements.overlay.classList.add('hidden');
            DOMElements.sidebarToggle.style.display = 'none';

            if (appState.currentView === 'volume-read' && DOMElements.tocSidebar) {
                DOMElements.tocSidebar.classList.remove('toc-sidebar-hidden');
                DOMElements.mainContent.style.marginLeft = '256px';
                DOMElements.mainAppHeader.style.left = '256px';
                document.body.classList.add('toc-active');
            } else {
                DOMElements.mainContent.style.marginLeft = '0';
                DOMElements.mainAppHeader.style.left = '0';
                document.body.classList.remove('toc-active');
                uiService.removeTocSidebar();
            }
        }
    },

    checkMobile() {
        const wasMobile = appState.isMobile;
        appState.isMobile = window.innerWidth < 768;

        if (wasMobile !== appState.isMobile) {
            app.applyLayoutClasses();
            if (appState.isTocSidebarOpen) {
                app.toggleTocSidebar(false);
            }
        }
    },

    toggleTocSidebar(forceState = null) {
        uiService.renderDynamicSidebarContent();

        if (!DOMElements.tocSidebar) return;

        const newState = forceState !== null ? forceState : !appState.isTocSidebarOpen;
        appState.isTocSidebarOpen = newState;

        if (appState.isMobile) {
            if (newState) {
                DOMElements.tocSidebar.classList.remove('toc-sidebar-hidden');
                DOMElements.overlay.classList.remove('hidden');
            } else {
                DOMElements.tocSidebar.classList.add('toc-sidebar-hidden');
                DOMElements.overlay.classList.add('hidden');
            }
        } else {
            if (appState.currentView === 'volume-read') {
                DOMElements.tocSidebar.classList.remove('toc-sidebar-hidden');
            } else {
                DOMElements.tocSidebar.classList.add('toc-sidebar-hidden');
            }
            DOMElements.overlay.classList.add('hidden');
        }
        app.applyLayoutClasses();
    },

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

app.setupEventListeners();
