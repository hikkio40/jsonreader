// script.js

// DOM & State
const DOMElements = {
    sidebarToggle: document.getElementById('sidebarToggle'),
    mainAppHeader: document.getElementById('mainAppHeader'),
    mainTitle: document.getElementById('mainTitle'),
    mainContent: document.getElementById('mainContent'),
    dynamicContent: document.getElementById('dynamicContent'),
    overlay: document.getElementById('overlay'),
    tocSidebar: null,
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
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), delay);
    };
};

const dataService = {
    CACHE_PREFIX: 'app_data_cache_',

    getCache(key) {
        try {
            const cached = localStorage.getItem(this.CACHE_PREFIX + key);
            return cached ? JSON.parse(cached) : null;
        } catch (e) {
            console.error('Cache read error:', e);
            return null;
        }
    },

    setCache(key, data) {
        try {
            localStorage.setItem(this.CACHE_PREFIX + key, JSON.stringify(data));
        } catch (e) {
            console.error('Cache write error:', e);
        }
    },

    async fetchJson(path) {
        const cached = this.getCache(path);
        if (cached) return cached;
        try {
            const res = await fetch(path);
            if (!res.ok) throw new Error(res.statusText);
            const data = await res.json();
            this.setCache(path, data);
            return data;
        } catch (e) {
            console.error('Fetch JSON failed:', e);
            DOMElements.dynamicContent.innerHTML = '<div class="text-center py-10 text-red-500">Konten belum tersedia.</div>';
            return null;
        }
    },

    getChapterImagePath(seriesId, volumeId, imageName) {
        return `images/${seriesId}/${volumeId}/${imageName}`;
    },
};

const uiService = {
    async renderContent(contentHtml) {
        DOMElements.dynamicContent.classList.add('fade-out');
        await new Promise(r => setTimeout(r, 300));
        DOMElements.dynamicContent.innerHTML = contentHtml;
        DOMElements.dynamicContent.classList.remove('fade-out');
    },

    removeTocSidebar() {
        if (DOMElements.tocSidebar) {
            DOMElements.tocSidebar.remove();
            DOMElements.tocSidebar = null;
            appState.isTocSidebarOpen = false;
        }
    },

    createTocSidebar(chapters) {
        uiService.removeTocSidebar();
        const aside = document.createElement('aside');
        aside.id = 'tocSidebar';
        aside.className = 'app-sidebar';

        aside.innerHTML = `
            <header class="toc-header">
                <h2 class="text-xl font-semibold">Daftar Isi Volume</h2>
                <button id="closeTocSidebar" class="p-2 hover:bg-gray-100 rounded md:hidden">
                    <span class="material-icons text-xl">close</span>
                </button>
            </header>
            <nav class="toc-nav">
                <ul class="space-y-2">
                    ${chapters.map((ch, i) => `
                        <li class="toc-menu-item">
                            <a href="#" class="flex items-center ${i === appState.currentChapterIndex ? 'active' : ''}"
                                onclick="navigationService.showChapter('${appState.currentSeriesId}', '${appState.currentVolumeId}', ${i}); return false;">
                                <span class="material-icons mr-2">menu_book</span>
                                ${ch.judul}
                            </a>
                        </li>
                    `).join('')}
                </ul>
            </nav>
        `;

        document.body.appendChild(aside);
        DOMElements.tocSidebar = aside;

        document.getElementById('closeTocSidebar')?.addEventListener('click', () => app.toggleTocSidebar(false));

        if (appState.isMobile) {
            aside.classList.add('toc-sidebar-hidden');
        }
    },
};

const navigationService = {
    async renderHomepage() {
        history.pushState(null, '', '/');
        appState.currentView = 'home';
        appState.currentSeriesId = null;
        uiService.removeTocSidebar();
        app.applyLayoutClasses();

        const seriesIndex = await dataService.fetchJson('series/series-index.json');
        if (!seriesIndex) return;

        let html = '<h2 class="text-2xl font-semibold mb-8">Light Novel Terbaru</h2><div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">';
        for (let s of seriesIndex) {
            html += `<article class="cursor-pointer hover:opacity-80" onclick="navigationService.showSeriesDetail('${s.id}')">
                <div class="aspect-[3/4] bg-gray-100 border border-gray-200 mb-3 flex items-center justify-center overflow-hidden relative">
                    ${s.cover ? `<img src="${s.cover}" class="w-full h-full object-cover">` : '<div class="text-gray-500">No Cover</div>'}
                    ${s.format ? `<span class="absolute top-2 left-2 bg-blue-500 text-white text-xs px-2 py-1 rounded">${s.format}</span>` : ''}
                </div>
                <h3 class="text-sm font-medium line-clamp-2">${s.judul}</h3>
            </article>`;
        }
        html += '</div>';

        uiService.renderContent(html);
    },

    async showSeriesDetail(seriesId) {
        history.pushState(null, '', `/series/${seriesId}`);
        appState.currentSeriesId = seriesId;
        appState.currentView = 'series-detail';
        uiService.removeTocSidebar();
        app.applyLayoutClasses();

        const info = await dataService.fetchJson(`series/${seriesId}/info.json`);
        const volumes = await dataService.fetchJson(`series/${seriesId}/volumes.json`);
        if (!info || !volumes) return;

        let html = `<div class="mb-6">
            <h1 class="text-3xl font-bold mb-4">${info.judul}</h1>
            <div class="mb-4 text-gray-600">${info.penulis} • ${info.rilis} • ${info.genre} • ${info.status}</div>
            <p class="mb-4">${info.deskripsi}</p>
            <h3 class="text-xl font-semibold mb-2">Volume</h3>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4">`;

        for (let v of volumes) {
            html += `<div onclick="navigationService.showVolume('${seriesId}', '${v.id}')" class="cursor-pointer">
                <div class="aspect-[3/4] bg-gray-100 border border-gray-200 mb-2 overflow-hidden">
                    ${v.cover ? `<img src="${v.cover}" class="w-full h-full object-cover">` : '<div class="text-center">No Cover</div>'}
                </div>
                <div class="text-xs text-center">${v.judul}</div>
            </div>`;
        }

        html += '</div></div>';

        uiService.renderContent(html);
    },

    async showVolume(seriesId, volumeId) {
        history.pushState(null, '', `/series/${seriesId}/${volumeId}`);
        appState.currentSeriesId = seriesId;
        appState.currentVolumeId = volumeId;

        const volumeData = await dataService.fetchJson(`series/${seriesId}/${volumeId}/${volumeId}.json`);
        if (!volumeData) return;

        appState.currentVolumeData = volumeData;
        appState.currentVolumeChapters = volumeData.bab;

        uiService.createTocSidebar(volumeData.bab);

        if (!appState.isMobile) app.toggleTocSidebar(true);
        else app.toggleTocSidebar(false);

        navigationService.showChapter(seriesId, volumeId, 0);
    },

    async showChapter(seriesId, volumeId, chapterIndex) {
        history.pushState(null, '', `/series/${seriesId}/${volumeId}/${chapterIndex + 1}`);
        appState.currentChapterIndex = chapterIndex;

        const chapterInfo = appState.currentVolumeChapters[chapterIndex];
        if (!chapterInfo) return;

        const chapterData = await dataService.fetchJson(`series/${seriesId}/${volumeId}/${chapterInfo.file}`);
        if (!chapterData) return;

        let html = `<h2 class="text-2xl font-bold mb-4">${chapterData.judul}</h2>`;
        for (let item of chapterData.konten) {
            if (item.paragraf) {
                html += `<p class="mb-4">${item.paragraf}</p>`;
            } else if (item.gambar) {
                html += `<div class="my-6 text-center">
                    <img src="${dataService.getChapterImagePath(seriesId, volumeId, item.gambar)}" class="mx-auto max-w-full">
                </div>`;
            } else if (item.kutipan) {
                html += `<blockquote class="italic text-gray-700 border-l-4 border-gray-300 pl-4 py-2 mb-4">"${item.kutipan}"</blockquote>`;
            } else if (item.dialog) {
                html += `<div class="bg-gray-50 p-4 rounded mb-4">`;
                for (let d of item.dialog) {
                    html += `<p><strong>${d.karakter}:</strong> ${d.ucapan}</p>`;
                }
                html += '</div>';
            }
        }

        uiService.renderContent(html);
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
            if (DOMElements.tocSidebar) {
                DOMElements.tocSidebar.classList.remove('toc-sidebar-hidden');
                DOMElements.mainContent.style.marginLeft = '256px';
                DOMElements.mainAppHeader.style.left = '256px';
                document.body.classList.add('toc-active');
            } else {
                DOMElements.mainContent.style.marginLeft = '0';
                DOMElements.mainAppHeader.style.left = '0';
                document.body.classList.remove('toc-active');
            }
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

    checkMobile() {
        const wasMobile = appState.isMobile;
        appState.isMobile = window.innerWidth < 768;
        if (wasMobile !== appState.isMobile) app.applyLayoutClasses();
    },

    handleRouting(path) {
        const segments = path.split('/').filter(Boolean);
        if (segments.length === 0) {
            navigationService.renderHomepage();
        } else if (segments[0] === 'series') {
            const seriesId = segments[1];
            if (segments.length === 2) {
                navigationService.showSeriesDetail(seriesId);
            } else if (segments.length === 3) {
                navigationService.showVolume(seriesId, segments[2]);
            } else if (segments.length === 4) {
                const chapterIndex = parseInt(segments[3], 10) - 1;
                navigationService.showVolume(seriesId, segments[2]).then(() => {
                    navigationService.showChapter(seriesId, segments[2], chapterIndex);
                });
            } else {
                navigationService.renderHomepage();
            }
        } else {
            navigationService.renderHomepage();
        }
    },

    setupEventListeners() {
        DOMElements.sidebarToggle.addEventListener('click', () => app.toggleTocSidebar());
        DOMElements.overlay.addEventListener('click', () => app.toggleTocSidebar(false));
        window.addEventListener('resize', debounce(app.checkMobile, 200));
        window.addEventListener('popstate', () => app.handleRouting(location.pathname));
        document.addEventListener('DOMContentLoaded', () => {
            app.checkMobile();
            app.handleRouting(location.pathname);
        });
    },
};

app.setupEventListeners();
