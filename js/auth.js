/* 這個檔案負責 Google 登入、帳號資料載入與登出。 */
var googleClientId = '';
var googleScriptLoading = false;
var googleButtonRendered = false;

function renderGoogleButton() {
  var container = $('#google-signin-button');

  if (!googleClientId || !window.google || googleButtonRendered || !container) {
    return;
  }

  window.google.accounts.id.renderButton(container, {
    theme: 'outline',
    size: 'large',
    text: 'signin_with',
    locale: 'zh_TW',
    width: Math.min(380, Math.max(240, container.parentNode.clientWidth))
  });
  googleButtonRendered = true;
}

function updateAccountUI() {
  var loginEntry = $('#login-entry');
  var accountTrigger = $('#account-trigger');
  var menuUser = $('#account-menu-user');

  if (currentUser) {
    loginEntry.classList.add('hidden');
    accountTrigger.classList.remove('hidden');
    accountTrigger.textContent = (currentUser.name || currentUser.email || '使').charAt(0).toUpperCase();
    accountTrigger.setAttribute('aria-label', '開啟 ' +
      (currentUser.name || currentUser.email || 'Google 使用者') + ' 的帳號選單');
    menuUser.textContent = currentUser.email || currentUser.name || 'Google 使用者';
  } else {
    loginEntry.classList.remove('hidden');
    accountTrigger.classList.add('hidden');
  }
}

function updateAfterGoogleLogin(user) {
  currentUser = user;
  updateAccountUI();
  go('home');
  toast('已登入 Google 帳號；使用者資料仍保存在這台裝置。');
}

function handleGoogleCredential(googleResponse) {
  fetch('/api/auth/google', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ credential: googleResponse.credential })
  }).then(function (response) {
    if (!response.ok) {
      return response.json().then(function (result) {
        throw new Error(result.detail || 'Google 登入失敗。');
      });
    }
    return response.json();
  }).then(function (result) {
    updateAfterGoogleLogin(result.user);
  }).catch(function (error) {
    console.error('Google 登入失敗。', error);
    updateAccountUI();
    toast('Google 登入失敗：' + error.message);
  });
}

function initializeGoogleIdentity() {
  window.google.accounts.id.initialize({
    client_id: googleClientId,
    callback: handleGoogleCredential
  });
  renderGoogleButton();
}

function loadGoogleIdentityLibrary() {
  var script;

  if (!googleClientId || googleScriptLoading || window.google) {
    return;
  }

  googleScriptLoading = true;
  script = document.createElement('script');
  script.src = 'https://accounts.google.com/gsi/client';
  script.async = true;
  script.defer = true;
  script.onload = function () {
    initializeGoogleIdentity();
  };
  script.onerror = function () {
    $('#google-signin-button').textContent = '無法載入 Google 登入，請檢查網路後重試。';
  };
  document.head.appendChild(script);
}

function restoreSignedInUser() {
  return fetch('/api/me', { credentials: 'same-origin' }).then(function (response) {
    if (response.status === 401) {
      updateAccountUI();
      return null;
    }
    if (!response.ok) {
      throw new Error('無法載入帳號資料。');
    }
    return response.json();
  }).then(function (result) {
    if (!result || !result.user) {
      updateAccountUI();
      return;
    }
    updateAfterGoogleLogin(result.user);
  });
}

function signOut() {
  if (!currentUser) {
    return;
  }
  fetch('/api/auth/logout', {
    method: 'POST',
    credentials: 'same-origin'
  }).then(function (response) {
    if (!response.ok) {
      throw new Error('登出失敗，請稍後再試。');
    }
    currentUser = null;
    updateAccountUI();
    toast('已登出 Google 帳號；本機資料仍保留。');
  }).catch(function (error) {
    console.error('登出失敗。', error);
    toast(error.message);
  });
}

function closeAccountMenu() {
  var trigger = $('#account-trigger');
  var menu = $('#account-menu');

  trigger.setAttribute('aria-expanded', 'false');
  menu.classList.add('hidden');
}

$('#login-entry').addEventListener('click', function () {
  window.setTimeout(renderGoogleButton, 0);
});

$('#account-trigger').addEventListener('click', function () {
  var menu = $('#account-menu');
  var isOpen = this.getAttribute('aria-expanded') === 'true';

  this.setAttribute('aria-expanded', isOpen ? 'false' : 'true');
  menu.classList.toggle('hidden', isOpen);
});

$('#account-menu-profile').addEventListener('click', function () {
  closeAccountMenu();
  toast(currentUser ? (currentUser.email || currentUser.name) : '尚未登入。');
});

$('#logout-button').addEventListener('click', function () {
  closeAccountMenu();
  signOut();
});

$('#guest-button').addEventListener('click', function () {
  go('home');
  toast('已以訪客身分繼續；資料只保存在這台裝置。');
});

document.addEventListener('click', function (event) {
  var tab = event.target.closest('[data-auth-mode]');
  var mode;

  if (!tab) {
    if (!event.target.closest('.account-menu-wrap')) {
      closeAccountMenu();
    }
    return;
  }

  mode = tab.getAttribute('data-auth-mode');
  $('#login-tab').classList.toggle('is-active', mode === 'login');
  $('#register-tab').classList.toggle('is-active', mode === 'register');
  $('#login-tab').setAttribute('aria-selected', mode === 'login' ? 'true' : 'false');
  $('#register-tab').setAttribute('aria-selected', mode === 'register' ? 'true' : 'false');
  $('#login-title').textContent = mode === 'login' ? '歡迎回來' : '建立帳號';
  $('#email-auth-submit').textContent = mode === 'login' ? '登入' : '註冊';
  $('#login-intro').textContent = '登入 Google 帳號；使用者資料只保存在這台裝置。';
  $('#auth-password').setAttribute(
    'autocomplete',
    mode === 'login' ? 'current-password' : 'new-password'
  );
});

$('#password-toggle').addEventListener('click', function () {
  var password = $('#auth-password');
  var shouldShow = password.type === 'password';

  password.type = shouldShow ? 'text' : 'password';
  this.textContent = shouldShow ? '隱藏' : '顯示';
  this.setAttribute('aria-label', shouldShow ? '隱藏密碼' : '顯示密碼');
});

$('#email-auth-form').addEventListener('submit', function (event) {
  event.preventDefault();
  toast('Email／密碼登入尚未開放，請使用 Google 登入。');
});

$('#forgot-password').addEventListener('click', function () {
  toast('Email／密碼登入尚未開放，忘記密碼功能也尚未提供。');
});

fetch('/api/config').then(function (response) {
  if (!response.ok) {
    throw new Error('無法讀取登入設定。');
  }
  return response.json();
}).then(function (config) {
  googleClientId = config.google_client_id || '';
  if (googleClientId) {
    loadGoogleIdentityLibrary();
  } else {
    $('#google-signin-button').textContent = 'Google 登入尚未設定。';
  }
  updateAccountUI();
  updateHomeListCounts();
  return restoreSignedInUser();
}).catch(function (error) {
  console.error('載入登入設定或帳號資料失敗。', error);
  updateAccountUI();
});
