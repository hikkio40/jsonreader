//==================================
// Objek DOM, State Aplikasi, dan Utilitas
//==================================
const DOMElements = {
    sidebarToggle: document.getElementById('sidebarToggle'),
    mainAppHeader: document.getElementById('mainAppHeader'),
    mainTitle: document.getElementById('mainTitle'),
    mainContent: document.getElementById('mainContent'),
    dynamicContent: document.getElementById('dynamicContent'),
    overlay: document.getElementById('overlay'),
    tocSidebar: null,
    headerMainNav: document.querySelector('.header-main-nav'),
};

const URL_REGEX = {
    SERIES_DETAIL: /^\/([a-zA-Z0-9_-]+)$/,
    VOLUME_READ: /^\/([a-zA-Z0-9_-]+)\/(\d+)$/,
    CHAPTER_READ: /^\/([a-zA-Z0-9_-]+)\/(\d+)\/(\d+)$/,
};

const appState = {
    isMobile: false,
    isTocSidebarOpen: false,
    currentView: 'home',
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

const volumeIdConverter = {
    stringToNumber: (volumeStringId) => {
        const match = volumeStringId.match(/^volume(\d+)$/);
        return match ? parseInt(match[1], 10) : null;
    },
    numberToString: (volumeNumber) => {
        return `volume${volumeNumber}`;
    }
};

//==================================
// Layanan Data
//==================================
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
            // Tangani error jika localStorage penuh
        }
    },

    async fetchJson(path) {
        const cacheKey = path;
        let cachedData = this.getCache(cacheKey);
        
        try {
            const response = await fetch(path);
            
            if (!response.ok) {
                throw new Error(`Failed to load ${path}: ${response.statusText}`);
            }

            const contentType = response.headers.get('Content-Type');
            if (!contentType || !contentType.includes('application/json')) {
                throw new Error(`Expected JSON but received ${contentType || 'unknown type'}`);
            }

            const data = await response.json();
            this.setCache(cacheKey, data);
            return data;

        } catch (error) {
            if (cachedData && cachedData.data) {
                return cachedData.data;
            } else {
                DOMElements.dynamicContent.innerHTML = `<div class="error-message">Konten belum tersedia atau gagal dimuat. Silakan coba lagi nanti atau hubungi administrator.</div>`;
                return null;
            }
        }
    },

    getChapterImagePath(seriesId, volumeId, imageName) {
        return `/images/${seriesId}/${volumeId}/${imageName}`;
    },

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

//==================================
// Layanan UI (Merender Konten)
//==================================
const uiService = {
    async renderContentWithTransition(contentHtml) {
        DOMElements.dynamicContent.classList.add('fade-out');
        await new Promise(resolve => setTimeout(resolve, 300));
        DOMElements.dynamicContent.innerHTML = contentHtml;
        DOMElements.dynamicContent.classList.remove('fade-out');
    },

    renderDynamicSidebarContent() {
        if (!DOMElements.tocSidebar) {
            const tocSidebarElement = document.createElement('aside');
            tocSidebarElement.id = 'tocSidebar';
            tocSidebarElement.classList.add('toc-sidebar-hidden');
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
            if (appState.currentVolumeChapters && appState.currentVolumeChapters.length > 0) {
                appState.currentVolumeChapters.forEach((chapter, index) => {
                    const isActive = index === appState.currentChapterIndex ? 'active' : '';
                    chaptersHtml += `
                        <li class="toc-menu-item">
                            <a href="#" onclick="navigationService.goToChapter('${appState.currentSeriesId}', '${appState.currentVolumeId}', ${index}); app.toggleTocSidebar(false); return false;" class="flex items-center ${isActive}">
                                <span class="material-icons mr-2">menu_book</span>
                                <span class="text-sm">${chapter.judul}</span>
                            </a>
                        </li>
                    `;
                });
            } else {
                chaptersHtml = `<li class="toc-menu-item text-gray-500 px-3 py-2">Tidak ada bab ditemukan.</li>`;
            }

            sidebarContentHtml = `${chaptersHtml}`;
        } else {
            sidebarTitle = 'Menu Utama';
            sidebarContentHtml = `
                <li class="toc-menu-item">
                    <a href="#" onclick="navigationService.goToHomepage(); app.toggleTocSidebar(false); return false;">
                        <span class="material-icons mr-2">home</span>
                        Beranda
                    </a>
                </li>
                <li class="toc-divider"></li>
                <li class="toc-menu-item">
                    <a href="#" class="toc-menu-link-secondary">
                        <span class="material-icons mr-2">info</span>
                        Tentang
                    </a>
                </li>
                <li class="toc-menu-item">
                    <a href="#" class="toc-menu-link-secondary">
                        <span class="material-icons mr-2">email</span>
                        Kontak
                    </a>
                </li>
                <li class="toc-menu-item">
                    <a href="#" class="toc-menu-link-secondary">
                        <span class="material-icons mr-2">security</span>
                        Kebijakan Privasi
                    </a>
                </li>
            `;
        }

        DOMElements.tocSidebar.innerHTML = `
            <header class="toc-header">
                <h2 class="app-title-2">${sidebarTitle}</h2>
                <button id="closeTocSidebar" class="sidebar-toggle-button md-hidden">
                    <span class="material-icons text-icon">close</span>
                </button>
            </header>
            <nav class="toc-nav">
                <ul class="toc-menu-list">
                    ${sidebarContentHtml}
                </ul>
            </nav>
        `;

        if (appState.isMobile && !appState.isTocSidebarOpen) {
            DOMElements.tocSidebar.classList.add('toc-sidebar-hidden');
        }
    },

    removeTocSidebar() {
        if (DOMElements.tocSidebar) {
            DOMElements.tocSidebar.classList.add('toc-sidebar-hidden');
            appState.isTocSidebarOpen = false;
        }
        DOMElements.overlay.classList.add('hidden');
    },

    async renderHomepageContent(seriesIndex) {
        let seriesHtml = ``;
        seriesIndex.forEach(series => {
            let badgeClass = '';
            if (series.format === 'Light Novel') {
                badgeClass = 'badge-light-novel';
            } else if (series.format === 'Manga') {
                badgeClass = 'badge-manga';
            } else if (series.format === 'Web Novel') {
                badgeClass = 'badge-web-novel';
            } else {
                badgeClass = 'badge-default';
            }

            seriesHtml += `
                <article class="series-card" onclick="navigationService.goToSeriesDetail('${series.id}')">
                    <div class="series-cover-wrapper">
                        ${series.cover ? `<img src="${dataService.getAbsoluteCoverPath(series.cover)}" alt="${series.judul}" class="series-cover-image" loading="lazy">` : `<svg class="series-cover-placeholder-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path>
                        </svg>`}
                        ${series.format ? `<span class="badge-format ${badgeClass}">${series.format}</span>` : ''}
                    </div>
                    <h3 class="series-title line-clamp-2">${series.judul}</h3>
                </article>
            `;
        });

        const contentHtml = `
            <h2 class="page-title">Light Novel Terbaru</h2>
            <div class="series-grid">
                ${seriesHtml}
            </div>
        `;
        uiService.renderContentWithTransition(contentHtml);
    },

    async renderSeriesDetailContent(info, volumes) {
        let volumesHtml = '';
        volumes.forEach(volume => {
            volumesHtml += `
                <div class="volume-card" onclick="navigationService.goToVolume('${appState.currentSeriesId}', '${volume.id}')">
                    <div class="volume-cover-wrapper">
                        ${volume.cover ? `<img src="${dataService.getAbsoluteCoverPath(volume.cover)}" alt="${volume.judul}" class="volume-cover-image" loading="lazy">` : `<svg class="volume-cover-placeholder-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path>
                        </svg>`}
                    </div>
                    <h4 class="volume-title">${volume.judul}</h4>
                </div>
            `;
        });

        const contentHtml = `
            <div class="series-detail-container">
                <div class="series-header-section">
                    <div class="series-poster-wrapper">
                        <div class="series-poster-placeholder">
                            ${info.cover ? `<img src="${dataService.getAbsoluteCoverPath(info.cover)}" alt="${info.judul}" class="series-poster-image" loading="lazy">` : `<svg class="series-poster-placeholder-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path>
                            </svg>`}
                        </div>
                    </div>
                    
                    <div class="series-info-section">
                        <h1 class="series-title">${info.judul}</h1>
                        <div class="series-metadata">
                            <div class="series-author">
                                <span class="material-icons">person</span>
                                ${info.penulis}
                            </div>
                            <div class="series-release-date">
                                <span class="material-icons">calendar_today</span>
                                ${info.rilis}
                            </div>
                            <div class="series-genre">
                                <span class="material-icons">label</span>
                                ${info.genre}
                            </div>
                            <div class="series-status">
                                <span class="material-icons">info</span>
                                ${info.status}
                            </div>
                        </div>
                        
                        <div class="series-synopsis">
                            <h3>Sinopsis</h3>
                            <p>${info.deskripsi}</p>
                        </div>
                    </div>
                </div>
                
                <div class="series-volumes-section">
                    <h3>Volume Terkait</h3>
                    <div class="volumes-grid">
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
                chapterContentHtml += `<p class="chapter-paragraph">${item.paragraf}</p>`;
            } else if (item.gambar) {
                chapterContentHtml += `
                    <div class="chapter-image-wrapper">
                        <img src="${dataService.getChapterImagePath(appState.currentSeriesId, appState.currentVolumeId, item.gambar)}" alt="Gambar ilustrasi" class="chapter-image" loading="lazy">
                    </div>
                `;
            } else if (item.kutipan) {
                chapterContentHtml += `
                    <blockquote class="chapter-quote">
                        "${item.kutipan}"
                    </blockquote>
                `;
            } else if (item.dialog) {
                let dialogHtml = '';
                item.dialog.forEach(d => {
                    dialogHtml += `<p class="chapter-dialog-line"><strong class="chapter-dialog-character">${d.karakter}:</strong> <span class="chapter-dialog-speech">${d.ucapan}</span></p>`;
                });
                chapterContentHtml += `<div class="chapter-dialog-block">${dialogHtml}</div>`;
            }
        });
        
        const prevButton = chapterIndex > 0 ?
            `<button onclick="navigationService.goToChapter('${appState.currentSeriesId}', '${appState.currentVolumeId}', ${chapterIndex - 1})" class="chapter-nav-button chapter-nav-prev">
                <span class="material-icons">arrow_back</span>
                Bab Sebelumnya
            </button>` : '';
        
        const nextButton = chapterIndex < totalChapters - 1 ?
            `<button onclick="navigationService.goToChapter('${appState.currentSeriesId}', '${appState.currentVolumeId}', ${chapterIndex + 1})" class="chapter-nav-button chapter-nav-next">
                Bab Selanjutnya
                <span class="material-icons">arrow_forward</span>
            </button>` : '';
        
        const contentHtml = `
            <div class="chapter-content-wrapper">
                <h2 class="chapter-title">${chapterData.judul}</h2>
                ${chapterContentHtml}
                
                <div class="chapter-navigation-bottom">
                    <div>${prevButton}</div>
                    <div>${nextButton}</div>
                </div>
            </div>
        `;
        uiService.renderContentWithTransition(contentHtml);

        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
};

//==================================
// Layanan Navigasi
//==================================
const navigationService = {
    _updateAppState(view, seriesId = null, volumeId = null, chapterIndex = 0) {
        appState.currentView = view;
        appState.currentSeriesId = seriesId;
        appState.currentVolumeId = volumeId;
        appState.currentChapterIndex = chapterIndex;
    },

    async loadContentFromUrl() {
        const path = window.location.pathname;
        DOMElements.dynamicContent.innerHTML = `<div class="loading-state"><p>Memuat konten...</p></div>`;

        let match;

        if ((match = path.match(URL_REGEX.CHAPTER_READ))) {
            const seriesId = match[1];
            const volumeNumber = parseInt(match[2], 10);
            const volumeId = volumeIdConverter.numberToString(volumeNumber);
            const chapterIndex = parseInt(match[3], 10);
            
            this._updateAppState('volume-read', seriesId, volumeId, chapterIndex);

            const volumeData = await dataService.fetchJson(`/series/${seriesId}/${volumeId}/${volumeId}.json`);
            if (!volumeData) {
                app.toggleTocSidebar(false);
                app.applyLayoutClasses();
                return;
            }

            appState.currentVolumeChapters = volumeData.bab;
            appState.currentVolumeData = volumeData;
            
            uiService.renderDynamicSidebarContent();
            appState.isTocSidebarOpen = !appState.isMobile;
            app.applyLayoutClasses();
            
            const chapterInfo = appState.currentVolumeChapters[chapterIndex];
            if (!chapterInfo) {
                DOMElements.dynamicContent.innerHTML = `<div class="error-message">Bab tidak ditemukan.</div>`;
                app.toggleTocSidebar(false);
                app.applyLayoutClasses();
                return;
            }
            const chapterData = await dataService.fetchJson(`/series/${seriesId}/${volumeId}/${chapterInfo.file}`);
            if (chapterData) {
                uiService.renderChapterContent(chapterData, volumeData, chapterIndex, appState.currentVolumeChapters.length);
            }
        } else if ((match = path.match(URL_REGEX.VOLUME_READ))) {
            const seriesId = match[1];
            const volumeNumber = parseInt(match[2], 10);
            const volumeId = volumeIdConverter.numberToString(volumeNumber);
            
            const newChapter0Url = `/${seriesId}/${volumeNumber}/0`;
            history.replaceState(null, '', newChapter0Url);
            
            this.loadContentFromUrl();
            return;
        } else if (path === '/' || path === '/index.html') {
            this._updateAppState('home');
            const seriesIndex = await dataService.fetchJson('/series/series-index.json');
            if (seriesIndex) {
                uiService.renderHomepageContent(seriesIndex);
            }
            app.toggleTocSidebar(false);
            app.applyLayoutClasses();
        } else if ((match = path.match(URL_REGEX.SERIES_DETAIL))) {
            const seriesId = match[1];
            this._updateAppState('series-detail', seriesId);
            const info = await dataService.fetchJson(`/series/${seriesId}/info.json`);
            const volumes = await dataService.fetchJson(`/series/${seriesId}/volumes.json`);
            if (info && volumes) {
                uiService.renderSeriesDetailContent(info, volumes);
            }
            app.toggleTocSidebar(false);
            app.applyLayoutClasses();
        } else {
            this.goToHomepage();
        }
    },

    goToHomepage() {
        history.pushState(null, '', '/');
        this.loadContentFromUrl();
    },

    goToSeriesDetail(seriesId) {
        history.pushState(null, '', `/${seriesId}`);
        this.loadContentFromUrl();
    },

    goToVolume(seriesId, volumeId) {
        const volumeNumber = volumeIdConverter.stringToNumber(volumeId);
        if (volumeNumber === null) {
            this.goToHomepage();
            return;
        }
        this.goToChapter(seriesId, volumeId, 0);
    },

    goToChapter(seriesId, volumeId, chapterIndex) {
        const volumeNumber = volumeIdConverter.stringToNumber(volumeId);
        if (volumeNumber === null) {
            this.goToHomepage();
            return;
        }
        history.pushState(null, '', `/${seriesId}/${volumeNumber}/${chapterIndex}`);
        this.loadContentFromUrl();
    }
};

//==================================
// Objek Aplikasi Utama
//==================================
const app = {
    applyLayoutClasses() {
        if (appState.isMobile) {
            // Gaya mobile
            DOMElements.mainContent.style.marginLeft = '0';
            DOMElements.mainAppHeader.style.left = '0';
            document.body.classList.remove('toc-active');
            DOMElements.sidebarToggle.style.display = 'block';

            if (DOMElements.tocSidebar) {
                if (appState.isTocSidebarOpen) {
                    DOMElements.tocSidebar.classList.remove('toc-sidebar-hidden');
                    DOMElements.overlay.style.display = 'block';
                } else {
                    DOMElements.tocSidebar.classList.add('toc-sidebar-hidden');
                    DOMElements.overlay.style.display = 'none';
                }
            }
        } else {
            // Gaya desktop
            DOMElements.sidebarToggle.style.display = 'none';
            DOMElements.overlay.style.display = 'none';

            if (appState.currentView === 'volume-read' && DOMElements.tocSidebar) {
                DOMElements.tocSidebar.classList.remove('toc-sidebar-hidden');
                DOMElements.mainContent.style.marginLeft = '256px';
                DOMElements.mainAppHeader.style.left = '256px';
                document.body.classList.add('toc-active');
            } else {
                DOMElements.mainContent.style.marginLeft = '0';
                DOMElements.mainAppHeader.style.left = '0';
                document.body.classList.remove('toc-active');
                if (DOMElements.tocSidebar) {
                    DOMElements.tocSidebar.classList.add('toc-sidebar-hidden');
                }
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
        const newState = forceState !== null ? forceState : !appState.isTocSidebarOpen;
        appState.isTocSidebarOpen = newState;
        
        uiService.renderDynamicSidebarContent();
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
        
        window.addEventListener('popstate', (event) => {
            navigationService.loadContentFromUrl();
        });

        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                if (appState.isMobile && appState.isTocSidebarOpen) {
                    app.toggleTocSidebar(false);
                }
            }
        });

        document.addEventListener('DOMContentLoaded', function() {
            app.checkMobile();
            const currentPath = window.location.pathname;
            if (currentPath !== '/' && currentPath !== '/index.html') {
                history.replaceState(null, '', '/');
                history.pushState(null, '', currentPath);
            }
            navigationService.loadContentFromUrl();
        });
    }
};

app.setupEventListeners();
