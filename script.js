const DOMElements = {
    sidebarToggle: document.getElementById('sidebarToggle'),
    mainAppHeader: document.getElementById('mainAppHeader'),
    mainTitle: document.getElementById('mainTitle'),
    mainContent: document.getElementById('mainContent'),
    dynamicContent: document.getElementById('dynamicContent'),
    overlay: document.getElementById('overlay'),
    tocSidebar: null, // Reference to the dynamically created TOC sidebar
};

const appState = {
    isMobile: false,
    isTocSidebarOpen: false, // Tracks if TOC sidebar is open (mainly for mobile)
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
            const data = await response.json(); // Mengembalikan ke logika kode lama
            this.setCache(cacheKey, data);
            return data;
        } catch (error) {
            console.error('Error fetching JSON:', error);
            // Mengembalikan pesan error ke versi kode lama
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
        await new Promise(resolve => setTimeout(resolve, 350)); // Tetap 350ms untuk transisi visual
        DOMElements.dynamicContent.innerHTML = contentHtml;
        DOMElements.dynamicContent.classList.remove('fade-out');
    },

    createTocSidebar(chapters) {
        if (DOMElements.tocSidebar) {
            DOMElements.tocSidebar.remove();
            DOMElements.tocSidebar = null;
        }

        const tocSidebarElement = document.createElement('aside');
        tocSidebarElement.id = 'tocSidebar';
        tocSidebarElement.classList.add('app-sidebar');

        let chaptersHtml = ``;
        chapters.forEach((chapter, index) => {
            const isActive = index === appState.currentChapterIndex ? 'active' : '';
            chaptersHtml += `
                <li class="toc-menu-item">
                    <a href="#" onclick="navigationService.showChapter('${appState.currentSeriesId}', '${appState.currentVolumeId}', ${index}); return false;" class="flex items-center ${isActive}">
                        <span class="material-icons text-xl flex-shrink-0 mr-2">menu_book</span>
                        <span class="text-sm">${chapter.judul}</span>
                    </a>
                </li>
            `;
        });

        tocSidebarElement.innerHTML = `
            <header class="toc-header">
                <h2 class="text-xl font-semibold">Daftar Isi Volume</h2>
                <button id="closeTocSidebar" class="p-2 hover:bg-gray-100 rounded md:hidden">
                    <span class="material-icons text-xl">close</span>
                </button>
            </header>
            <nav class="toc-nav">
                <ul class="space-y-2">
                    <li class="toc-menu-item">
                        <a href="#" onclick="navigationService.showSeriesDetail('${appState.currentSeriesId}'); return false;" class="flex items-center">
                            <span class="material-icons mr-2">arrow_back</span>
                            Kembali ke Seri
                        </a>
                    </li>
                    <li class="border-t border-gray-200 my-2"></li>
                    ${chaptersHtml}
                </ul>
            </nav>
        `;

        document.body.appendChild(tocSidebarElement);
        DOMElements.tocSidebar = tocSidebarElement;

        const closeButton = document.getElementById('closeTocSidebar');
        if (closeButton) {
            closeButton.addEventListener('click', () => app.toggleTocSidebar(false));
        }

        if (appState.isMobile) {
            DOMElements.tocSidebar.classList.add('toc-sidebar-hidden');
        }
    },

    removeTocSidebar() {
        if (DOMElements.tocSidebar) {
            DOMElements.tocSidebar.remove();
            DOMElements.tocSidebar = null;
            appState.isTocSidebarOpen = false;
        }
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
        await uiService.renderContentWithTransition(contentHtml);
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
        await uiService.renderContentWithTransition(contentHtml);
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
            <div class="chapter-content-wrapper">
                <h2 class="text-2xl font-semibold mb-4 chapter-title">${chapterData.judul}</h2>
                ${chapterContentHtml}
                
                <div class="flex justify-between items-center mt-8 pt-6 border-t border-gray-200 chapter-navigation-bottom">
                    <div>${prevButton}</div>
                    <div class="text-gray-500 chapter-page-info">Bab ${chapterIndex + 1} dari ${totalChapters}</div>
                    <div>${nextButton}</div>
                </div>
            </div>
        `;
        await uiService.renderContentWithTransition(contentHtml);
    }
};

const navigationService = {
    // Helper function to update URL and history
    updateUrlAndHistory(view, seriesId = null, volumeId = null, chapterIndex = null) {
        let path = '/';
        let state = { view: view, seriesId: seriesId, volumeId: volumeId, chapterIndex: chapterIndex };

        switch (view) {
            case 'home':
                path = '/';
                break;
            case 'series-detail':
                path = `/series/${seriesId}`;
                break;
            case 'volume-read':
                path = `/series/${seriesId}/volume/${volumeId}`;
                break;
            case 'chapter-read': // Changed view name for chapter
                path = `/series/${seriesId}/volume/${volumeId}/chapter/${chapterIndex}`;
                break;
        }
        history.pushState(state, '', path);
    },

    // Function to handle initial page load or popstate event
    async handleNavigation(state) {
        let view = state ? state.view : null;
        let seriesId = state ? state.seriesId : null;
        let volumeId = state ? state.volumeId : null;
        let chapterIndex = state ? state.chapterIndex : null;

        // If state is null (e.g., initial load or direct URL access), parse URL
        if (!state) {
            const pathSegments = window.location.pathname.split('/').filter(segment => segment !== '');
            if (pathSegments.length === 0) {
                view = 'home';
            } else if (pathSegments[0] === 'series' && pathSegments[1]) {
                seriesId = pathSegments[1];
                if (pathSegments[2] === 'volume' && pathSegments[3]) {
                    volumeId = pathSegments[3];
                    if (pathSegments[4] === 'chapter' && pathSegments[5]) {
                        chapterIndex = parseInt(pathSegments[5]);
                        view = 'chapter-read';
                    } else {
                        view = 'volume-read';
                    }
                } else {
                    view = 'series-detail';
                }
            }
        }

        // Update appState based on parsed URL or history state
        appState.currentView = view;
        appState.currentSeriesId = seriesId;
        appState.currentVolumeId = volumeId;
        appState.currentChapterIndex = chapterIndex;

        // Render content based on the determined view
        switch (appState.currentView) {
            case 'home':
                await navigationService.renderHomepage();
                break;
            case 'series-detail':
                await navigationService.showSeriesDetail(appState.currentSeriesId);
                break;
            case 'volume-read':
                await navigationService.showVolume(appState.currentSeriesId, appState.currentVolumeId);
                break;
            case 'chapter-read':
                // For chapter-read, we need to ensure volume data is loaded first
                // This is a simplified approach; a more robust solution might involve
                // re-fetching volume data if not in appState.currentVolumeData
                if (!appState.currentVolumeData || appState.currentVolumeData.id !== appState.currentVolumeId) {
                    const volumeData = await dataService.fetchJson(`series/${appState.currentSeriesId}/${appState.currentVolumeId}/${appState.currentVolumeId}.json`);
                    if (volumeData) {
                        appState.currentVolumeChapters = volumeData.bab;
                        appState.currentVolumeData = volumeData;
                    } else {
                        console.error("Failed to load volume data for chapter navigation.");
                        // Attempt to navigate to series detail if volume data is missing
                        await navigationService.showSeriesDetail(appState.currentSeriesId);
                        return;
                    }
                }
                await navigationService.showChapter(appState.currentSeriesId, appState.currentVolumeId, appState.currentChapterIndex);
                break;
            default:
                // Fallback to homepage if URL is unrecognized
                await navigationService.renderHomepage();
                break;
        }
    },

    async renderHomepage() {
        appState.currentView = 'home';
        appState.currentSeriesId = null;
        appState.currentVolumeId = null;
        appState.currentChapterIndex = 0;

        uiService.removeTocSidebar();
        app.applyLayoutClasses();

        const seriesIndex = await dataService.fetchJson('series/series-index.json');
        if (!seriesIndex) return;

        await uiService.renderHomepageContent(seriesIndex);
        // Update URL after rendering content
        navigationService.updateUrlAndHistory('home');
    },

    async showSeriesDetail(seriesId) {
        appState.currentView = 'series-detail';
        appState.currentSeriesId = seriesId;
        appState.currentVolumeId = null;
        appState.currentChapterIndex = 0;

        uiService.removeTocSidebar();
        app.applyLayoutClasses();

        const info = await dataService.fetchJson(`series/${seriesId}/info.json`);
        const volumes = await dataService.fetchJson(`series/${seriesId}/volumes.json`);

        if (!info || !volumes) return;

        await uiService.renderSeriesDetailContent(info, volumes);
        // Update URL after rendering content
        navigationService.updateUrlAndHistory('series-detail', seriesId);
    },

    async showVolume(seriesId, volumeId) {
        appState.currentView = 'volume-read';
        appState.currentSeriesId = seriesId;
        appState.currentVolumeId = volumeId;
        appState.currentChapterIndex = 0;

        const volumeData = await dataService.fetchJson(`series/${seriesId}/${volumeId}/${volumeId}.json`);
        if (!volumeData) {
            // Jika data volume tidak ditemukan, kembali ke detail seri
            await navigationService.showSeriesDetail(seriesId);
            return;
        }

        appState.currentVolumeChapters = volumeData.bab;
        appState.currentVolumeData = volumeData;

        uiService.createTocSidebar(volumeData.bab);

        // Hanya toggle sidebar terbuka jika di desktop
        if (!appState.isMobile) {
            app.toggleTocSidebar(true);
        } else {
            // Di mobile, pastikan sidebar tertutup saat masuk volume/chapter
            app.toggleTocSidebar(false);
        }

        // Panggil showChapter, yang akan merender konten dan memperbarui URL
        await navigationService.showChapter(seriesId, volumeId, 0);
    },

    async showChapter(seriesId, volumeId, chapterIndex) {
        appState.currentChapterIndex = chapterIndex;
        const chapterInfo = appState.currentVolumeChapters[chapterIndex];
        const volumeData = appState.currentVolumeData;

        if (!chapterInfo || !volumeData) {
            DOMElements.dynamicContent.innerHTML = `<div class="text-center py-10 text-red-500">Bab atau data volume tidak ditemukan.</div>`;
            return;
        }

        uiService.createTocSidebar(appState.currentVolumeChapters);

        // Hanya toggle sidebar terbuka jika di desktop
        if (!appState.isMobile) {
            app.toggleTocSidebar(true);
        } else {
            // Di mobile, pastikan sidebar tertutup saat masuk volume/chapter
            app.toggleTocSidebar(false);
        }

        app.applyLayoutClasses();

        const chapterData = await dataService.fetchJson(`series/${seriesId}/${volumeId}/${chapterInfo.file}`);
        if (!chapterData) {
            // Jika data bab tidak ditemukan, kembali ke detail volume (atau seri jika volume juga gagal)
            await navigationService.showVolume(seriesId, volumeId); // Coba kembali ke volume
            return;
        }

        await uiService.renderChapterContent(chapterData, volumeData, chapterIndex, appState.currentVolumeChapters.length);
        // Update URL after rendering content
        navigationService.updateUrlAndHistory('chapter-read', seriesId, volumeId, chapterIndex);

        // Scroll to top after rendering chapter content
        DOMElements.mainContent.scrollTo({ top: 0, behavior: 'smooth' });
    }
};

const app = {
    applyLayoutClasses() {
        if (appState.isMobile) {
            DOMElements.mainContent.classList.add('main-mobile-full');
            DOMElements.mainContent.classList.remove('ml-desktop-toc-open');
            DOMElements.mainAppHeader.classList.remove('header-desktop-toc-open');
            
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

            if (DOMElements.tocSidebar) {
                DOMElements.tocSidebar.classList.remove('toc-sidebar-hidden');
                DOMElements.mainContent.classList.add('ml-desktop-toc-open');
                DOMElements.mainAppHeader.classList.add('header-desktop-toc-open');
                document.body.classList.add('toc-active');
            } else {
                DOMElements.mainContent.classList.remove('ml-desktop-toc-open');
                DOMElements.mainAppHeader.classList.remove('header-desktop-toc-open');
                document.body.classList.remove('toc-active');
            }
        }
    },

    checkMobile() {
        const wasMobile = appState.isMobile;
        appState.isMobile = window.innerWidth < 768;

        if (wasMobile !== appState.isMobile) {
            app.applyLayoutClasses();
        }
    },

    toggleTocSidebar(forceState = null) {
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
            DOMElements.tocSidebar.classList.remove('toc-sidebar-hidden');
            DOMElements.overlay.classList.add('hidden');
        }
    },

    setupEventListeners() {
        DOMElements.sidebarToggle.addEventListener('click', () => app.toggleTocSidebar());

        DOMElements.overlay.addEventListener('click', function() {
            if (appState.isMobile) {
                app.toggleTocSidebar(false);
            }
        });

        window.addEventListener('resize', debounce(app.checkMobile, 200));

        // Listen for browser's back/forward button clicks
        window.onpopstate = function(event) {
            navigationService.handleNavigation(event.state);
        };

        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                if (appState.isMobile && appState.isTocSidebarOpen) {
                    app.toggleTocSidebar(false);
                }
            }
        });

        document.addEventListener('DOMContentLoaded', function() {
            app.checkMobile();
            // Initial load handling using handleNavigation
            navigationService.handleNavigation(history.state);
        });
    }
};

app.setupEventListeners();
