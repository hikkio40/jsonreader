// script.js

const appState = {
  seriesList: [],
  currentSeries: null,
  currentVolume: null,
  currentChapter: null
};

const mainContent = document.getElementById("dynamicContent");
const tocSidebarId = "tocSidebar";
const overlay = document.getElementById("overlay");

// Utilitas
function fetchJson(url) {
  return fetch(url).then((res) => {
    if (!res.ok) throw new Error("HTTP error " + res.status);
    return res.json();
  });
}

function setTitle(text) {
  const title = document.getElementById("mainTitle");
  if (title) title.textContent = text;
  document.title = text + " - Json Library";
}

function clearMainContent() {
  mainContent.innerHTML = "";
}

function showLoading() {
  mainContent.innerHTML = `<div class="text-center py-10 text-gray-500">Memuat...</div>`;
}

function createTOCSidebar(items, onClickItem) {
  removeTOCSidebar();

  const sidebar = document.createElement("aside");
  sidebar.id = tocSidebarId;
  sidebar.classList.add("toc-sidebar-hidden");

  sidebar.innerHTML = `
    <div class="toc-header">
      <span class="font-semibold">Daftar Isi</span>
      <button id="tocCloseBtn" class="material-icons">close</button>
    </div>
    <nav class="toc-nav">
      ${items
        .map(
          (item, index) => `
        <div class="toc-menu-item">
          <a href="#" data-index="${index}" class="block">${item.title || "Bab " + (index + 1)}</a>
        </div>`
        )
        .join("")}
    </nav>
  `;

  document.body.appendChild(sidebar);

  const links = sidebar.querySelectorAll("a[data-index]");
  links.forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const index = parseInt(link.dataset.index);
      if (!isNaN(index)) onClickItem(index);
      hideSidebar();
    });
  });

  document.getElementById("tocCloseBtn").onclick = hideSidebar;
}

function removeTOCSidebar() {
  const existing = document.getElementById(tocSidebarId);
  if (existing) existing.remove();
}

function showSidebar() {
  const sidebar = document.getElementById(tocSidebarId);
  if (sidebar) {
    sidebar.classList.remove("toc-sidebar-hidden");
    overlay.classList.remove("hidden");
    document.body.classList.add("toc-active");
  }
}

function hideSidebar() {
  const sidebar = document.getElementById(tocSidebarId);
  if (sidebar) {
    sidebar.classList.add("toc-sidebar-hidden");
    overlay.classList.add("hidden");
    document.body.classList.remove("toc-active");
  }
}

// Rendering
function renderSeriesList(seriesList) {
  setTitle("Daftar Seri");
  clearMainContent();

  const wrapper = document.createElement("div");
  wrapper.className = "grid grid-cols-2 md:grid-cols-4 gap-4";

  seriesList.forEach((series) => {
    const div = document.createElement("div");
    div.className = "border p-2 rounded shadow hover:shadow-md cursor-pointer";
    div.innerHTML = `
      <img src="${series.cover}" alt="${series.title}" class="w-full h-48 object-cover rounded">
      <h2 class="font-semibold mt-2 line-clamp-2">${series.title}</h2>
    `;
    div.onclick = () => {
      history.pushState({}, "", `/series/${series.id}`);
      handleRouting(location.pathname);
    };
    wrapper.appendChild(div);
  });

  mainContent.appendChild(wrapper);
}

function renderVolumeList(seriesInfo, volumeList) {
  setTitle(seriesInfo.title);
  clearMainContent();

  const wrapper = document.createElement("div");
  wrapper.className = "grid grid-cols-2 md:grid-cols-4 gap-4";

  volumeList.forEach((volume, index) => {
    const div = document.createElement("div");
    div.className = "border p-2 rounded shadow hover:shadow-md cursor-pointer";
    div.innerHTML = `
      <img src="${volume.cover}" alt="Volume ${index + 1}" class="w-full h-48 object-cover rounded">
      <h2 class="font-semibold mt-2">Volume ${index + 1}</h2>
    `;
    div.onclick = () => {
      history.pushState({}, "", `/series/${seriesInfo.id}/volume${index + 1}`);
      handleRouting(location.pathname);
    };
    wrapper.appendChild(div);
  });

  mainContent.appendChild(wrapper);
}

function renderChapter(seriesId, volumeId, chapterData) {
  setTitle(chapterData.title || "Bab");
  clearMainContent();

  const container = document.createElement("div");
  container.className = "space-y-4";

  if (chapterData.images) {
    chapterData.images.forEach((img) => {
      const image = document.createElement("img");
      image.src = `/images/${seriesId}/${volumeId}/${img}`;
      image.className = "w-full rounded";
      container.appendChild(image);
    });
  } else {
    container.innerHTML = `<p class="text-gray-500">Tidak ada gambar untuk bab ini.</p>`;
  }

  mainContent.appendChild(container);
}

// Routing SPA
function handleRouting(path) {
  showLoading();
  const parts = path.split("/").filter(Boolean);

  if (parts.length === 0) {
    // Home
    fetchJson("/series/series-index.json")
      .then((data) => {
        appState.seriesList = data;
        renderSeriesList(data);
      })
      .catch((err) => console.error("Gagal memuat daftar seri:", err));
  } else if (parts.length === 2 && parts[0] === "series") {
    // Series view
    const seriesId = parts[1];
    Promise.all([
      fetchJson(`/series/${seriesId}/info.json`),
      fetchJson(`/series/${seriesId}/volumes.json`)
    ])
      .then(([info, volumes]) => {
        appState.currentSeries = info;
        renderVolumeList(info, volumes);
      })
      .catch((err) => console.error("Gagal memuat seri:", err));
  } else if (parts.length === 4 && parts[0] === "series") {
    const [_, seriesId, volumeDir, chapterIndexStr] = parts;
    const volumeId = volumeDir;
    const chapterIndex = parseInt(chapterIndexStr);
    const volumePath = `/series/${seriesId}/${volumeId}`;

    fetchJson(`${volumePath}/volume1.json`) // asumsi volume.json = volume1.json
      .then((volumeData) => {
        const chapterList = volumeData.chapters;
        if (!chapterList || !chapterList[chapterIndex]) {
          throw new Error("Bab tidak ditemukan");
        }
        createTOCSidebar(chapterList, (i) => {
          history.pushState({}, "", `/series/${seriesId}/${volumeId}/${i}`);
          handleRouting(location.pathname);
        });
        renderChapter(seriesId, volumeId, chapterList[chapterIndex]);
      })
      .catch((err) => {
        console.error("Gagal memuat volume:", err);
        mainContent.innerHTML = `<div class="text-red-500">Gagal memuat konten.</div>`;
      });
  } else {
    mainContent.innerHTML = `<div class="text-gray-500">Halaman tidak ditemukan.</div>`;
  }
}

// Init
window.addEventListener("popstate", () => {
  handleRouting(location.pathname);
});

document.getElementById("sidebarToggle").onclick = showSidebar;
overlay.onclick = hideSidebar;

document.addEventListener("DOMContentLoaded", () => {
  handleRouting(location.pathname);
});
