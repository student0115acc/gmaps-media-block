// 網路層：只在 Google Maps 分頁擋下照片／影片主機的請求。
// Maps 和 Google 搜尋、Gmail 共用 google.com 網域，無法用 initiatorDomains 區分，
// 所以改用 session rule 的 tabIds，追蹤哪些分頁正在看 Maps。

const RULE_ID = 1;
const BLOCKED_DOMAINS = [
  'googleusercontent.com',
  'ggpht.com',
  'streetviewpixels-pa.googleapis.com',
  // 贊助廣告的縮圖
  'encrypted-tbn0.gstatic.com',
  'encrypted-tbn1.gstatic.com',
  'encrypted-tbn2.gstatic.com',
  'encrypted-tbn3.gstatic.com',
];
const MAPS_URL = /^https:\/\/(www\.google\.[a-z.]+\/maps([/?#]|$)|maps\.google\.[a-z.]+\/)/;

let queue = Promise.resolve();
// 所有狀態變更依序執行，避免同時改 storage 互相覆蓋
function serial(fn) {
  queue = queue.then(fn, fn);
  return queue;
}

async function syncRule() {
  const { enabled = true } = await chrome.storage.local.get('enabled');
  const { mapTabs = [] } = await chrome.storage.session.get('mapTabs');
  const addRules = enabled && mapTabs.length
    ? [{
        id: RULE_ID,
        priority: 1,
        action: { type: 'block' },
        condition: {
          requestDomains: BLOCKED_DOMAINS,
          resourceTypes: ['image', 'media'],
          tabIds: mapTabs,
        },
      }]
    : [];
  await chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: [RULE_ID], addRules });
}

function setTab(tabId, isMaps) {
  return serial(async () => {
    const { mapTabs = [] } = await chrome.storage.session.get('mapTabs');
    const has = mapTabs.includes(tabId);
    if (has === isMaps) return;
    const next = isMaps ? [...mapTabs, tabId] : mapTabs.filter((id) => id !== tabId);
    await chrome.storage.session.set({ mapTabs: next });
    await syncRule();
  });
}

// 在頁面開始載入前就加入規則
chrome.webNavigation.onBeforeNavigate.addListener(({ tabId, frameId, url }) => {
  if (frameId === 0 && tabId >= 0) setTab(tabId, MAPS_URL.test(url));
});
chrome.webNavigation.onHistoryStateUpdated.addListener(({ tabId, frameId, url }) => {
  if (frameId === 0) setTab(tabId, MAPS_URL.test(url));
});
chrome.tabs.onRemoved.addListener((tabId) => setTab(tabId, false));

// 瀏覽器重啟後還原的分頁不一定觸發 onBeforeNavigate，由內容腳本補報
chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg === 'maps-tab' && sender.tab) setTab(sender.tab.id, true);
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && 'enabled' in changes) serial(syncRule);
});

chrome.runtime.onInstalled.addListener(async () => {
  const { enabled } = await chrome.storage.local.get('enabled');
  if (enabled === undefined) await chrome.storage.local.set({ enabled: true });
  serial(syncRule);
});
