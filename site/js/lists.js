/* 這個檔案負責我的最愛與黑名單清單的顯示、移除和儲存。 */
function getListEntryName(entry) {
  if (typeof entry === 'string') {
    return entry;
  }

  if (entry && typeof entry === 'object') {
    return entry.name || entry.title || entry.restaurant || '未命名餐廳';
  }

  return '未命名餐廳';
}

function renderSavedList(listName) {
  var isFavorite = listName === 'fav';
  var entries = isFavorite ? S.fav : S.bl;
  var elementId = isFavorite ? 'favorites-list' : 'blacklist-list';
  var emptyId = isFavorite ? 'favorites-empty' : 'blacklist-empty';
  var list = document.getElementById(elementId);
  var i;
  var item;
  var copy;
  var title;
  var details;
  var removeButton;
  var entry;
  var description;

  list.textContent = '';

  for (i = 0; i < entries.length; i += 1) {
    entry = entries[i];
    item = document.createElement('li');
    item.className = 'entry-card';

    copy = document.createElement('div');
    copy.className = 'entry-copy';
    title = document.createElement('strong');
    title.textContent = getListEntryName(entry);
    copy.appendChild(title);

    description = entry && typeof entry === 'object'
      ? [entry.type, entry.address].filter(Boolean).join('・')
      : '';
    if (description) {
      details = document.createElement('p');
      details.textContent = description;
      copy.appendChild(details);
    }

    removeButton = document.createElement('button');
    removeButton.className = 'entry-action';
    removeButton.type = 'button';
    removeButton.textContent = '移除';
    removeButton.setAttribute('data-list-remove', listName);
    removeButton.setAttribute('data-index', String(i));
    removeButton.setAttribute('aria-label', '從清單移除 ' + getListEntryName(entry));

    item.appendChild(copy);
    item.appendChild(removeButton);
    list.appendChild(item);
  }

  setHidden(emptyId, entries.length > 0);
}

document.addEventListener('click', function (event) {
  var button = event.target;
  var listName;
  var index;
  var entries;

  if (!button.hasAttribute('data-list-remove')) {
    return;
  }

  listName = button.getAttribute('data-list-remove');
  index = Number(button.getAttribute('data-index'));
  entries = listName === 'fav' ? S.fav : S.bl;

  if (index < 0 || index >= entries.length || Math.floor(index) !== index) {
    console.error('清單項目索引無效。');
    return;
  }

  entries.splice(index, 1);
  save();
  renderSavedList(listName);
  toast(listName === 'fav' ? '已從我的最愛移除。' : '已從黑名單移除。');
});

document.addEventListener('click', function (event) {
  var target = event.target;

  while (target && target !== document) {
    if (target.getAttribute('data-go') === 'favorites') {
      renderSavedList('fav');
      return;
    }
    if (target.getAttribute('data-go') === 'blacklist') {
      renderSavedList('bl');
      return;
    }
    target = target.parentNode;
  }
});

renderSavedList('fav');
renderSavedList('bl');
