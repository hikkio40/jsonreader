const DOMElements = {
    sidebarToggle: document.getElementById('sidebarToggle'),
    sidebar: document.getElementById('sidebar'),
    mainContent: document.getElementById('mainContent'),
    dynamicContent: document.getElementById('dynamicContent'),
    overlay: document.getElementById('overlay'),
    sidebarTitle: document.getElementById('sidebarTitle'),
    sidebarMenu: document.getElementById('sidebarMenu'),
};

const appState = {
    isCollapsed: false,
    isMobile: false,
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

const dataService = {
    CACHE_PREFIX: 'app_data_cache_',

    getCache(key) {
        try {
            const cachedData = localStorage.getItem(this.CACHE_PREFIX + key);
            return cachedData ? JSON.parse(cachedData) : null;
        } catch (e) {
            console.error('Error reading from cache:', e);
            localStorage.removeItem(this.CACHE_PREFIX + key);
            return null;
        }
    },

    setCache(key, data) {
        try {
            localStorage.setItem(this.CACHE_PREFIX + key, JSON.stringify(data));
        } catch (e) {
            console.error('Error writing to cache:', e);
        }
    },

    async fetchJson(path) {
        const cacheKey = path;

        const cachedData = this.getCache(cacheKey);
        if (cachedData) {
            return cachedData;
        }

        try {
            const response = await fetch(path);
            if (!response.ok) {
                throw new Error(`Failed to load ${path}: ${response.statusText}`);
            }
            const data = await response.json();
            this.setCache(cacheKey, data);
            return data;
        } catch (error) {
            console.error('Error fetching JSON:', error);
            DOMElements.dynamicContent.innerHTML = `<div class="text-center py-10 text-red-500">Konten belum tersedia. Silakan coba lagi nanti atau hubungi administrator.</div>`;
            return null;
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

    renderMainMenuSidebar() {
        DOMElements.sidebarTitle.textContent = 'Website Saya';
        // Memisahkan menu utama dan menu pengaturan ke dalam dua ul terpisah
        DOMElements.sidebarMenu.innerHTML = `
            <ul class="space-y-2">
                <li class="sidebar-menu-item">
                    <a href="#" onclick="navigationService.renderHomepage()" class="flex items-center py-2 px-3 hover:bg-gray-100 rounded">
                        <span class="material-icons text-xl flex-shrink-0">home</span>
                        <span class="sidebar-text ml-3 whitespace-nowrap overflow-hidden">Beranda</span>
                    </a>
                </li>
                <li class="sidebar-menu-item">
                    <a href="#" class="flex items-center py-2 px-3 hover:bg-gray-100 rounded">
                        <span class="material-icons text-xl flex-shrink-0">favorite</span>
                        <span class="sidebar-text ml-3 whitespace-nowrap overflow-hidden">Favorit</span>
                    </a>
                </li>
                <li class="sidebar-menu-item">
                    <a href="#" class="flex items-center py-2 px-3 hover:bg-gray-100 rounded">
                        <span class="material-icons text-xl flex-shrink-0">category</span>
                        <span class="sidebar-text ml-3 whitespace-nowrap overflow-hidden">Kategori</span>
                    </a>
                </li>
                <li class="sidebar-menu-item">
                    <a href="#" class="flex items-center py-2 px-3 hover:bg-gray-100 rounded">
                        <span class="material-icons text-xl flex-shrink-0">perm_media</span>
                        <span class="sidebar-text ml-3 whitespace-nowrap overflow-hidden">Media</span>
                    </a>
                </li>
                <li class="sidebar-menu-item">
                    <a href="#" class="flex items-center py-2 px-3 hover:bg-gray-100 rounded">
                        <span class="material-icons text-xl flex-shrink-0">people</span>
                        <span class="sidebar-text ml-3 whitespace-nowrap overflow-hidden">Pengguna</span>
                    </a>
                </li>
            </ul>
            <ul class="space-y-2 mt-auto"> <!-- ul terpisah untuk Pengaturan -->
                <li class="sidebar-menu-item">
                    <a href="#" class="flex items-center py-2 px-3 hover:bg-gray-100 rounded">
                        <span class="material-icons text-xl flex-shrink-0">settings</span>
                        <span class="sidebar-text ml-3 whitespace-nowrap overflow-hidden">Pengaturan</span>
                    </a>
                </li>
            </ul>
        `;
    },

    setupVolumeSidebar(chapters) {
        DOMElements.sidebarTitle.textContent = 'Daftar Isi Volume';
        let chaptersHtml = `
            <li class="sidebar-menu-item">
                <a href="#" onclick="navigationService.showSeriesDetail('${appState.currentSeriesId}')" class="flex items-center py-2 px-3 hover:bg-gray-100 rounded">
                    <span class="material-icons mr-2">arrow_back</span>
                    <span class="sidebar-text ml-3 whitespace-nowrap overflow-hidden">Kembali ke Seri</span>
                </a>
            </li>
            <li class="border-t border-gray-200 my-2 sidebar-divider"></li>
        `;
        
        chapters.forEach((chapter, index) => {
            const isActive = index === appState.currentChapterIndex ? 'bg-blue-100 text-blue-600' : '';
            chaptersHtml += `
                <li class="sidebar-menu-item">
                    <a href="#" onclick="navigationService.showChapter('${appState.currentSeriesId}', '${appState.currentVolumeId}', ${index})" class="flex items-center py-2 px-3 hover:bg-gray-100 rounded ${isActive}">
                        <span class="material-icons text-xl flex-shrink-0">menu_book</span>
                        <span class="sidebar-text ml-3 whitespace-nowrap overflow-hidden text-sm">${chapter.judul}</span>
                    </a>
                </li>
            `;
        });
        
        DOMElements.sidebarMenu.innerHTML = chaptersHtml;
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
                <article class="cursor-pointer hover:opacity-80 transition-opacity series-card" onclick="navigationService.showSeriesDetail('${series.id}')">
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
                <div class="cursor-pointer hover:opacity-80 transition-opacity volume-card" onclick="navigationService.showVolume('${appState.currentSeriesId}', '${volume.id}')">
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
                <button onclick="navigationService.renderHomepage()" class="flex items-center text-gray-600 hover:text-black mb-4 back-to-homepage-button">
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
                        <div class="flex items-center gap-6 text-gray-600 mb-4 series-metadata">
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
            `<button onclick="navigationService.showChapter('${appState.currentSeriesId}', '${appState.currentVolumeId}', ${chapterIndex - 1})" class="flex items-center px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded chapter-nav-button chapter-nav-prev">
                <span class="material-icons mr-2">arrow_back</span>
                Bab Sebelumnya
            </button>` : '';
        
        const nextButton = chapterIndex < totalChapters - 1 ? 
            `<button onclick="navigationService.showChapter('${appState.currentSeriesId}', '${appState.currentVolumeId}', ${chapterIndex + 1})" class="flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded chapter-nav-button chapter-nav-next">
                Bab Selanjutnya
                <span class="material-icons ml-2">arrow_forward</span>
            </button>` : '';
        
        const contentHtml = `
            <div class="chapter-navigation-top">
                <button onclick="navigationService.showVolume('${appState.currentSeriesId}', '${appState.currentVolumeId}')" class="flex items-center text-gray-600 hover:text-black mb-4 back-to-volume-button">
                    <span class="material-icons mr-2">arrow_back</span>
                    Kembali ke Volume
                </button>
            </div>
            
            <div class="chapter-content-wrapper">
                <h1 class="text-3xl font-bold mb-6 volume-title">${volumeData.judul_volume || 'Judul Volume'}</h1>
                
                <div class="prose max-w-none text-justify leading-relaxed chapter-main-text">
                    <h2 class="text-2xl font-semibold mb-4 chapter-title">${chapterData.judul}</h2>
                    ${chapterContentHtml}
                </div>
                
                <div class="flex justify-between items-center mt-8 pt-6 border-t border-gray-200 chapter-navigation-bottom">
                    <div>${prevButton}</div>
                    <div class="text-gray-500 chapter-page-info">Bab ${chapterIndex + 1} dari ${totalChapters}</div>
                    <div>${nextButton}</div>
                </div>
            </div>
        `;
        uiService.renderContentWithTransition(contentHtml);
    }
};

const navigationService = {
    async renderHomepage() {
        appState.currentView = 'home';
        appState.currentSeriesId = null;
        appState.currentVolumeId = null;
        appState.currentChapterIndex = 0;

        uiService.renderMainMenuSidebar();
        app.checkMobile();

        const seriesIndex = await dataService.fetchJson('series/series-index.json');
        if (!seriesIndex) return;

        uiService.renderHomepageContent(seriesIndex);
    },

    async showSeriesDetail(seriesId) {
        appState.currentView = 'series-detail';
        appState.currentSeriesId = seriesId;
        appState.currentVolumeId = null;
        appState.currentChapterIndex = 0;

        DOMElements.sidebar.classList.remove('sidebar-mobile-hidden');
        DOMElements.mainContent.classList.remove('main-mobile-full');
        if (!appState.isCollapsed) {
            DOMElements.mainContent.classList.add('ml-64');
        }
        DOMElements.overlay.classList.add('hidden');

        const info = await dataService.fetchJson(`series/${seriesId}/info.json`);
        const volumes = await dataService.fetchJson(`series/${seriesId}/volumes.json`);

        if (!info || !volumes) return;

        uiService.renderMainMenuSidebar();
        DOMElements.sidebarTitle.textContent = 'Detail Seri';

        uiService.renderSeriesDetailContent(info, volumes);
    },

    async showVolume(seriesId, volumeId) {
        appState.currentView = 'volume-read';
        appState.currentSeriesId = seriesId;
        appState.currentVolumeId = volumeId;
        appState.currentChapterIndex = 0;

        DOMElements.sidebar.classList.remove('sidebar-mobile-hidden');
        DOMElements.mainContent.classList.remove('main-mobile-full');
        if (!appState.isCollapsed) {
            DOMElements.mainContent.classList.add('ml-64');
        }
        DOMElements.overlay.classList.add('hidden');

        const volumeData = await dataService.fetchJson(`series/${seriesId}/${volumeId}/${volumeId}.json`);
        if (!volumeData) return;

        appState.currentVolumeChapters = volumeData.bab;
        appState.currentVolumeData = volumeData;

        uiService.setupVolumeSidebar(volumeData.bab);
        navigationService.showChapter(seriesId, volumeId, 0);
    },

    async showChapter(seriesId, volumeId, chapterIndex) {
        appState.currentChapterIndex = chapterIndex;
        const chapterInfo = appState.currentVolumeChapters[chapterIndex];
        const volumeData = appState.currentVolumeData;

        if (!chapterInfo || !volumeData) {
            DOMElements.dynamicContent.innerHTML = `<div class="text-center py-10 text-red-500">Bab atau data volume tidak ditemukan.</div>`;
            return;
        }

        uiService.setupVolumeSidebar(appState.currentVolumeChapters);

        const chapterData = await dataService.fetchJson(`series/${seriesId}/${volumeId}/${chapterInfo.file}`);
        if (!chapterData) return;

        uiService.renderChapterContent(chapterData, volumeData, chapterIndex, appState.currentVolumeChapters.length);
    }
};

const app = {
    checkMobile() {
        appState.isMobile = window.innerWidth < 768;
        if (appState.isMobile && appState.currentView === 'home') {
            DOMElements.sidebar.classList.add('sidebar-mobile-hidden');
            DOMElements.mainContent.classList.add('main-mobile-full');
            DOMElements.overlay.classList.add('hidden');
        } else if (!appState.isMobile && appState.currentView === 'home') {
            DOMElements.sidebar.classList.remove('sidebar-mobile-hidden');
            DOMElements.mainContent.classList.remove('main-mobile-full');
            if (!appState.isCollapsed) {
                DOMElements.mainContent.classList.add('ml-64');
            }
        }
    },

    toggleSidebar() {
        if (appState.isMobile) {
            if (DOMElements.sidebar.classList.contains('sidebar-mobile-hidden')) {
                DOMElements.sidebar.classList.remove('sidebar-mobile-hidden');
                DOMElements.overlay.classList.remove('hidden');
            } else {
                DOMElements.sidebar.classList.add('sidebar-mobile-hidden');
                DOMElements.overlay.classList.add('hidden');
            }
        } else {
            appState.isCollapsed = !appState.isCollapsed;
            
            if (appState.isCollapsed) {
                DOMElements.sidebar.classList.add('sidebar-collapsed');
                DOMElements.mainContent.classList.remove('ml-64');
                DOMElements.mainContent.classList.add('ml-16');
            } else {
                DOMElements.sidebar.classList.remove('sidebar-collapsed');
                DOMElements.mainContent.classList.remove('ml-16');
                DOMElements.mainContent.classList.add('ml-64');
            }
        }
    },

    setupEventListeners() {
        DOMElements.sidebarToggle.addEventListener('click', app.toggleSidebar);

        DOMElements.overlay.addEventListener('click', function() {
            if (appState.isMobile) {
                DOMElements.sidebar.classList.add('sidebar-mobile-hidden');
                DOMElements.overlay.classList.add('hidden');
            }
        });

        window.addEventListener('resize', debounce(app.checkMobile, 200));

        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                if (appState.isMobile && !DOMElements.sidebar.classList.contains('sidebar-mobile-hidden')) {
                    DOMElements.sidebar.classList.add('sidebar-mobile-hidden');
                    DOMElements.overlay.classList.add('hidden');
                } else if (!appState.isMobile && appState.isCollapsed) {
                    app.toggleSidebar();
                }
            }
        });

        document.addEventListener('DOMContentLoaded', function() {
            app.checkMobile();
            navigationService.renderHomepage();
        });
    }
};

app.setupEventListeners();
