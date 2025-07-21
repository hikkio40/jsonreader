// Variable untuk menyimpan data yang dimuat dari JSON eksternal
let seriesIndexData = [];
let currentSeriesInfo = null;
let currentSeriesVolumes = [];
let currentVolumeContent = null;

// Fungsi utilitas untuk mengambil data JSON dari URL
async function fetchData(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            // Jika respons bukan OK (misalnya 404 Not Found, 500 Internal Server Error)
            throw new Error(`HTTP error! status: ${response.status} from ${url}`);
        }

        // Cek Content-Type untuk memastikan ini adalah JSON
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            const textResponse = await response.text();
            console.error(`Expected JSON, but received Content-Type: ${contentType}. Response text (first 500 chars):`, textResponse.substring(0, 500) + '...');
            throw new Error(`Invalid content type. Expected JSON for ${url}.`);
        }

        return await response.json();
    } catch (error) {
        console.error("Gagal mengambil data:", error);
        const mainContent = document.getElementById('main-content');
        mainContent.innerHTML = `
            <div class="container mx-auto px-4 py-8 text-center text-red-600">
                <p>Maaf, terjadi kesalahan saat memuat data dari <strong>${url}</strong>.</p>
                <p>Pesan Error: ${error.message}</p>
                <p>Pastikan file JSON ada di lokasi yang benar dan server web Anda berjalan dengan baik.</p>
                <p>Jika Anda menjalankan ini secara lokal (misalnya, membuka file index.html langsung di browser), fungsi 'fetch' mungkin tidak dapat mengakses file lokal. Coba gunakan server web sederhana (misalnya, Python's 'http.server' atau 'serve' dari Node.js).</p>
            </div>
        `;
        return null; // Mengembalikan null agar fungsi pemanggil bisa menanganinya
    }
}

// Fungsi untuk merender tampilan daftar seri (homepage)
async function renderHomePage() {
    const mainContent = document.getElementById('main-content');
    mainContent.innerHTML = `
        <div class="container mx-auto px-4 py-8">
            <h2 class="text-xl font-semibold mb-6 text-center">Daftar Seri</h2>
            <div id="series-grid" class="grid-container">
                <!-- Loading indicator -->
                <div class="col-span-full text-center py-8">Memuat daftar seri...</div>
            </div>
        </div>
    `;

    seriesIndexData = await fetchData('/series/series-index.json');
    if (seriesIndexData) {
        renderSeries(seriesIndexData);
    }
}

// Fungsi untuk merender daftar seri ke dalam DOM
function renderSeries(seriesData) {
    const seriesGrid = document.getElementById('series-grid');
    seriesGrid.innerHTML = ''; // Bersihkan konten sebelumnya

    if (!seriesData || seriesData.length === 0) {
        seriesGrid.innerHTML = `<div class="col-span-full text-center py-8">Tidak ada seri yang ditemukan.</div>`;
        return;
    }

    seriesData.forEach(series => {
        const seriesCard = document.createElement('div');
        seriesCard.className = 'post-card no-shadow cursor-pointer';
        seriesCard.setAttribute('data-id', series.id);

        // Path cover: disesuaikan dengan struktur folder /covers/ di root
        seriesCard.innerHTML = `
            <img src="covers/${series.cover.split('/').pop()}" alt="Cover ${series.judul}" class="w-full h-full object-cover no-shadow" onerror="this.onerror=null;this.src='https://placehold.co/400x600/CCCCCC/000000?text=No+Cover';">
            <div class="post-content">
                <h3 class="post-title">${series.judul}</h3>
            </div>
        `;
        seriesGrid.appendChild(seriesCard);

        seriesCard.addEventListener('click', () => {
            renderDetailPage(series.id);
        });
    });
}

// Fungsi untuk merender tampilan detail seri
async function renderDetailPage(seriesId) {
    const mainContent = document.getElementById('main-content');
    mainContent.innerHTML = `
        <div class="container mx-auto px-4 py-8 text-center">Memuat detail seri...</div>
    `;

    // Ambil info.json dan volumes.json secara paralel
    const [infoData, volumesData] = await Promise.all([
        fetchData(`/series/${seriesId}/info.json`),
        fetchData(`/series/${seriesId}/volumes.json`)
    ]);

    if (!infoData || !volumesData) {
        // Error sudah ditangani di fetchData, cukup return
        return;
    }

    currentSeriesInfo = infoData;
    currentSeriesVolumes = volumesData;

    mainContent.innerHTML = ''; // Bersihkan loading indicator

    // --- Bagian Tombol Kembali ---
    const backButtonContainer = document.createElement('div');
    backButtonContainer.className = 'container mx-auto px-4 py-4';
    const backButton = document.createElement('button');
    backButton.className = 'bg-gray-200 text-gray-800 px-4 py-2 rounded-none hover:bg-gray-300 no-shadow';
    backButton.textContent = '← Kembali ke Beranda';
    backButton.onclick = renderHomePage;
    backButtonContainer.appendChild(backButton);
    mainContent.appendChild(backButtonContainer);

    // --- Bagian Info Seri ---
    const infoSectionContainer = document.createElement('div');
    infoSectionContainer.className = 'container mx-auto px-4 py-4';
    const infoSection = document.createElement('div');
    infoSection.className = 'bg-white p-6 border border-gray-200 no-shadow';
    infoSection.innerHTML = `
        <h2 class="text-3xl font-bold mb-4 text-center">${currentSeriesInfo.judul}</h2>
        <p class="text-gray-700 mb-4 text-justify">${currentSeriesInfo.deskripsi}</p>
        <div class="text-sm text-gray-600 grid grid-cols-1 md:grid-cols-2 gap-2">
            <p><strong>Penulis:</strong> ${currentSeriesInfo.penulis}</p>
            <p><strong>Genre:</strong> ${currentSeriesInfo.genre}</p>
            <p><strong>Status:</strong> ${currentSeriesInfo.status}</p>
            <p><strong>Rilis:</strong> ${currentSeriesInfo.rilis}</p>
        </div>
    `;
    infoSectionContainer.appendChild(infoSection);
    mainContent.appendChild(infoSectionContainer);

    // --- Bagian Daftar Volume ---
    const volumesSectionContainer = document.createElement('div');
    volumesSectionContainer.className = 'container mx-auto px-4 py-8';
    const volumesSection = document.createElement('div');
    volumesSection.className = 'bg-white p-6 border border-gray-200 no-shadow';
    volumesSection.innerHTML = `
        <h3 class="text-2xl font-semibold mb-6 text-center">Daftar Volume</h3>
        <div id="detail-volumes-grid" class="grid-container">
            <!-- Volume akan dirender di sini -->
        </div>
    `;
    volumesSectionContainer.appendChild(volumesSection);
    mainContent.appendChild(volumesSectionContainer);

    const detailVolumesGrid = volumesSection.querySelector('#detail-volumes-grid');
    if (!currentSeriesVolumes || currentSeriesVolumes.length === 0) {
        detailVolumesGrid.innerHTML = `<div class="col-span-full text-center py-4">Tidak ada volume yang ditemukan untuk seri ini.</div>`;
        return;
    }

    currentSeriesVolumes.forEach(volume => {
        const volumeCard = document.createElement('div');
        volumeCard.className = 'post-card no-shadow cursor-pointer';
        volumeCard.setAttribute('data-id', volume.id);

        // Path cover: disesuaikan dengan struktur folder /covers/ di root
        volumeCard.innerHTML = `
            <img src="covers/${volume.cover.split('/').pop()}" alt="Cover ${volume.judul}" class="w-full h-full object-cover no-shadow" onerror="this.onerror=null;this.src='https://placehold.co/400x600/CCCCCC/000000?text=No+Cover';">
            <div class="post-content">
                <h4 class="post-title">${volume.judul}</h4>
            </div>
        `;
        detailVolumesGrid.appendChild(volumeCard);

        volumeCard.addEventListener('click', () => {
            renderVolumePage(volume.id, seriesId);
        });
    });
}

// Fungsi untuk menampilkan bab yang dipilih
function showChapter(chapterId) {
    // Sembunyikan semua bab
    document.querySelectorAll('.chapter-content-section').forEach(section => {
        section.classList.remove('active');
    });
    // Hapus kelas aktif dari semua link daftar isi
    document.querySelectorAll('.toc-panel a').forEach(link => {
        link.classList.remove('active-tab');
    });

    // Tampilkan bab yang dipilih
    const activeChapter = document.getElementById(`chapter-content-${chapterId}`);
    if (activeChapter) {
        activeChapter.classList.add('active');
    }
    // Tambahkan kelas aktif ke link daftar isi yang sesuai
    const activeLink = document.querySelector(`.toc-panel a[data-chapter-id="${chapterId}"]`);
    if (activeLink) {
        activeLink.classList.add('active-tab');
    }
}

// Fungsi untuk merender tampilan baca volume
async function renderVolumePage(volumeId, seriesId) {
    const mainContent = document.getElementById('main-content');
    mainContent.innerHTML = `
        <div class="container mx-auto px-4 py-8 text-center">Memuat konten volume...</div>
    `;

    // Path ke file JSON volume
    const volumeFilePath = `/series/${seriesId}/${volumeId}.json`;
    currentVolumeContent = await fetchData(volumeFilePath);

    if (!currentVolumeContent) {
        // Error sudah ditangani di fetchData, cukup return
        return;
    }

    mainContent.innerHTML = ''; // Bersihkan loading indicator

    // --- Bagian Tombol Kembali ke Detail Seri ---
    const backButtonContainer = document.createElement('div');
    backButtonContainer.className = 'container mx-auto px-4 py-4';
    const backButton = document.createElement('button');
    backButton.className = 'bg-gray-200 text-gray-800 px-4 py-2 rounded-none hover:bg-gray-300 no-shadow';
    backButton.textContent = '← Kembali ke Detail Seri';
    backButton.onclick = () => renderDetailPage(seriesId);
    backButtonContainer.appendChild(backButton);
    mainContent.appendChild(backButtonContainer);

    // --- Bagian Layout Pembaca Volume (Panel Kiri dan Kanan) ---
    const volumeReaderLayout = document.createElement('div');
    volumeReaderLayout.className = 'volume-reader-layout';

    // --- Panel Kiri: Daftar Isi (Table of Contents) ---
    const tocPanel = document.createElement('div');
    tocPanel.className = 'toc-panel no-shadow';
    tocPanel.innerHTML = `
        <h3>Daftar Isi</h3>
        <ul id="toc-list"></ul>
    `;
    const tocList = tocPanel.querySelector('#toc-list');

    if (!currentVolumeContent.bab || currentVolumeContent.bab.length === 0) {
        tocList.innerHTML = `<li><p class="text-gray-500">Tidak ada bab.</p></li>`;
    } else {
        currentVolumeContent.bab.forEach(bab => {
            const listItem = document.createElement('li');
            const link = document.createElement('a');
            link.href = '#';
            link.textContent = bab.judul;
            link.setAttribute('data-chapter-id', bab.id);
            link.addEventListener('click', (e) => {
                e.preventDefault();
                showChapter(bab.id);
            });
            listItem.appendChild(link);
            tocList.appendChild(listItem);
        });
    }
    volumeReaderLayout.appendChild(tocPanel);

    // --- Panel Kanan: Konten Volume ---
    const contentPanel = document.createElement('div');
    contentPanel.className = 'content-panel no-shadow';
    
    contentPanel.innerHTML = `
        <div id="chapter-content-container">
            <!-- Konten bab individual akan dirender di sini -->
        </div>
    `;

    const chapterContentContainer = contentPanel.querySelector('#chapter-content-container');

    if (!currentVolumeContent.bab || currentVolumeContent.bab.length === 0) {
        chapterContentContainer.innerHTML = `<p class="text-center text-gray-500">Konten bab tidak tersedia.</p>`;
    } else {
        currentVolumeContent.bab.forEach(bab => {
            const chapterSection = document.createElement('section');
            chapterSection.id = `chapter-content-${bab.id}`;
            chapterSection.className = 'chapter-content-section';
            
            chapterSection.innerHTML = `<h3>${bab.judul}</h3>`;

            bab.konten.forEach(item => {
                if (item.paragraf) {
                    const p = document.createElement('p');
                    p.textContent = item.paragraf;
                    chapterSection.appendChild(p);
                } else if (item.gambar) {
                    const img = document.createElement('img');
                    // *** PERBAIKAN UTAMA DI SINI ***
                    // Membangun path gambar: "images/" + seriesId + "/" + nama_file_gambar
                    // item.gambar di JSON sekarang diharapkan hanya berisi "nama-seri/nama-file.jpg"
                    // Contoh: "pahlawan-barat/scene-desa.jpg"
                    const fullImagePathInJson = item.gambar; // Ini akan menjadi "pahlawan-barat/scene-desa.jpg"
                    // Kita perlu memastikan path relatif dari root proyek
                    img.src = `images/${fullImagePathInJson}`; // Ini akan menjadi images/pahlawan-barat/scene-desa.jpg
                    img.alt = item.caption || 'Gambar ilustrasi';
                    img.onerror = function() {
                        this.onerror=null;
                        this.src='https://placehold.co/800x450/CCCCCC/000000?text=Gambar+Tidak+Ditemukan';
                        console.error(`Gagal memuat gambar: ${img.src}`);
                    };
                    chapterSection.appendChild(img);
                    if (item.caption) {
                        const caption = document.createElement('p');
                        caption.className = 'text-center text-sm text-gray-500 mt-2 mb-4';
                        caption.textContent = item.caption;
                        chapterSection.appendChild(caption);
                    }
                } else if (item.kutipan) {
                    const blockquote = document.createElement('blockquote');
                    blockquote.className = 'quote';
                    blockquote.textContent = item.kutipan;
                    chapterSection.appendChild(blockquote);
                } else if (item.dialog) {
                    const dialogBox = document.createElement('div');
                    dialogBox.className = 'dialog-box';
                    item.dialog.forEach(line => {
                        const p = document.createElement('p');
                        p.innerHTML = `<strong>${line.karakter}:</strong> ${line.ucapan}`;
                        dialogBox.appendChild(p);
                    });
                    chapterSection.appendChild(dialogBox);
                }
            });
            chapterContentContainer.appendChild(chapterSection);
        });
    }

    volumeReaderLayout.appendChild(contentPanel);
    mainContent.appendChild(volumeReaderLayout);

    // Tampilkan bab pertama secara default
    if (currentVolumeContent.bab.length > 0) {
        showChapter(currentVolumeContent.bab[0].id);
    }
}

// Panggil fungsi renderHomePage saat DOM selesai dimuat untuk menampilkan homepage pertama kali
document.addEventListener('DOMContentLoaded', renderHomePage);
