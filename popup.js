// 切換遮蔽或變更密碼都要先輸入密碼。只存 SHA-256 雜湊，不存明碼。
const DEFAULT_PW_HASH = 'aada16b8ba1a50f04efc4793bcb277dea56140098a0e08618f2455d03692ac69';

const $ = (id) => document.getElementById(id);
const box = $('enabled');
const unlockForm = $('unlock');
const changeForm = $('change');

let enabled = true;

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function checkPassword(pw) {
  const { pwHash = DEFAULT_PW_HASH } = await chrome.storage.local.get('pwHash');
  return (await sha256(pw)) === pwHash;
}

function render() {
  box.checked = enabled;
  $('hint').textContent = enabled
    ? '已開啟：照片、影片與頭像會顯示為灰色色塊。'
    : '已關閉：若有圖片仍未出現，請重新整理頁面。';
}

function showForm(form) {
  for (const f of [unlockForm, changeForm]) {
    f.hidden = f !== form;
    f.reset();
    f.querySelector('.error').textContent = '';
  }
  $('show-change').hidden = form !== null;
  form?.querySelector('input').focus();
}

chrome.storage.local.get('enabled').then(({ enabled: value = true }) => {
  enabled = value;
  render();
});

// 勾選框不直接生效，先要求密碼
box.addEventListener('click', (e) => {
  e.preventDefault();
  $('unlock-title').textContent = enabled ? '輸入密碼以關閉遮蔽' : '輸入密碼以開啟遮蔽';
  showForm(unlockForm);
});

unlockForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!(await checkPassword($('unlock-pw').value))) {
    $('unlock-error').textContent = '密碼錯誤';
    $('unlock-pw').select();
    return;
  }
  enabled = !enabled;
  await chrome.storage.local.set({ enabled });
  showForm(null);
  render();
});

$('show-change').addEventListener('click', () => showForm(changeForm));

changeForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const error = $('change-error');
  const next = $('new-pw').value;
  if (!(await checkPassword($('old-pw').value))) {
    error.textContent = '目前密碼錯誤';
    return;
  }
  if (!next) {
    error.textContent = '新密碼不可空白';
    return;
  }
  if (next !== $('new-pw2').value) {
    error.textContent = '兩次輸入的新密碼不一致';
    return;
  }
  await chrome.storage.local.set({ pwHash: await sha256(next) });
  showForm(null);
  $('hint').textContent = '密碼已變更。';
});

for (const btn of document.querySelectorAll('[data-cancel]')) {
  btn.addEventListener('click', () => showForm(null));
}
