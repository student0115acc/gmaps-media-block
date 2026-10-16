// 畫面層：遮蔽本身由 content.css 處理，這裡負責
// 1. 依開關切換 html.gmb-off
// 2. 標記夠大的色塊以顯示「已隱藏」
// 3. 暫停並靜音影片

const MEDIA_HOSTS = ['googleusercontent.com', 'ggpht.com', 'streetviewpixels', 'encrypted-tbn'];
const IMG_SELECTOR = MEDIA_HOSTS.flatMap((h) => [`img[src*="${h}"]`, `img[srcset*="${h}"]`]).join(',');
const BG_SELECTOR = MEDIA_HOSTS.map((h) => `[style*="${h}"]`).join(',');
const BIG_W = 120;
const BIG_H = 80;

let enabled = true;

chrome.runtime.sendMessage('maps-tab').catch(() => {});

function apply() {
  document.documentElement.classList.toggle('gmb-off', !enabled);
  if (enabled) scan();
}

function scan() {
  for (const el of document.querySelectorAll(`${IMG_SELECTOR},${BG_SELECTOR}`)) {
    const { width, height } = el.getBoundingClientRect();
    el.toggleAttribute('data-gmb-big', width >= BIG_W && height >= BIG_H);
  }
  for (const v of document.querySelectorAll('video')) silence(v);
}

function silence(video) {
  video.removeAttribute('autoplay');
  video.autoplay = false;
  video.muted = true;
  if (!video.paused) video.pause();
}

// 被網路層擋過的圖片在關閉遮蔽後重新要求一次
function reloadMedia() {
  for (const img of document.querySelectorAll(IMG_SELECTOR)) {
    if (img.complete && img.naturalWidth === 0) img.src = img.src;
  }
  for (const el of document.querySelectorAll(BG_SELECTOR)) {
    const style = el.getAttribute('style');
    el.setAttribute('style', '');
    el.setAttribute('style', style);
  }
}

// Maps 拖曳地圖時會大量改動 style，只在跟媒體有關的變動時才重新掃描
function isRelevant(record) {
  if (record.type === 'childList') return record.addedNodes.length > 0;
  return record.target.matches?.(`${IMG_SELECTOR},${BG_SELECTOR}`) ?? false;
}

let pending = false;
const observer = new MutationObserver((records) => {
  if (!enabled || pending || !records.some(isRelevant)) return;
  pending = true;
  requestAnimationFrame(() => {
    pending = false;
    scan();
  });
});
observer.observe(document.documentElement, {
  childList: true,
  subtree: true,
  attributes: true,
  attributeFilter: ['src', 'srcset', 'style'],
});

// 任何影片一開始播放就攔下
document.addEventListener('play', (e) => {
  if (enabled && e.target instanceof HTMLVideoElement) silence(e.target);
}, true);

chrome.storage.local.get('enabled').then(({ enabled: value = true }) => {
  enabled = value;
  apply();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local' || !('enabled' in changes)) return;
  enabled = changes.enabled.newValue !== false;
  apply();
  // 等背景移除網路規則後再重新載入
  if (!enabled) setTimeout(reloadMedia, 500);
});
