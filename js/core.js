/* 這個檔案放跨畫面共用的選取、狀態、提示與畫面切換函式。 */
function $(selector, root) {
  return (root || document).querySelector(selector);
}

function esc(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function readSavedState() {
  var saved;

  try {
    saved = JSON.parse(localStorage.getItem('foodDemo4') || '{}');
  } catch (error) {
    console.warn('讀取已儲存的資料失敗，先使用空白狀態。', error);
    return {};
  }

  return saved && typeof saved === 'object' ? saved : {};
}

var S = readSavedState();
S.cust = Array.isArray(S.cust) ? S.cust : [];
S.custR = Array.isArray(S.custR) ? S.custR : [];
S.fav = Array.isArray(S.fav) ? S.fav : [];
S.bl = Array.isArray(S.bl) ? S.bl : [];
var currentUser = null;

function saveLocalState() {
  try {
    localStorage.setItem('foodDemo4', JSON.stringify(S));
  } catch (error) {
    console.error('儲存資料失敗。', error);
    toast('資料無法儲存，請檢查瀏覽器的儲存空間設定。');
  }
}

function save() {
  saveLocalState();
}

var F = {
  meat: 'all',
  stp: ['rice', 'noodle', 'other'],
  rng: 1000,
  city: '',
  dist: '',
  auto: false,
  lat: null,
  lng: null,
  acc: null
};

function go(id) {
  var nextScreen = document.getElementById(id);
  var screens = document.querySelectorAll('.scr');
  var i;

  if (!nextScreen || !nextScreen.classList.contains('scr')) {
    console.error('找不到畫面：' + id);
    return;
  }

  for (i = 0; i < screens.length; i += 1) {
    screens[i].classList.remove('on');
  }

  nextScreen.classList.add('on');
  window.scrollTo(0, 0);
}

function toast(message) {
  var toastBox = $('#toast');

  if (!toastBox) {
    console.error('找不到提示訊息區塊 #toast。');
    return;
  }

  toastBox.textContent = message;
  setHidden('toast', false);
  window.clearTimeout(toast.timer);
  toast.timer = window.setTimeout(function () {
    setHidden('toast', true);
  }, 2800);
}

function setHidden(id, hidden) {
  var element = document.getElementById(id);

  if (!element) {
    console.error('找不到要顯示或隱藏的元素：' + id);
    return;
  }

  element.classList.toggle('hidden', hidden);
}

// 用 document 統一處理導頁與尚未實作功能的提示，不必替每顆按鈕各自綁事件。
document.addEventListener('click', function (event) {
  var target = event.target;

  while (target && target !== document) {
    if (target.hasAttribute('data-go')) {
      go(target.getAttribute('data-go'));
      return;
    }

    if (target.hasAttribute('data-coming-soon')) {
      toast(target.getAttribute('data-message') || '這項功能會在後續階段實作。');
      return;
    }

    target = target.parentNode;
  }
});
