/* 這個檔案負責自訂轉盤類型與餐廳的新增、移除和畫面更新。 */
function renderCustomCategories() {
  var list = $('#custom-category-list');
  var typeSelect = $('#restaurant-type');
  var categoryEmpty = $('#custom-category-empty');
  var submitButton = $('#restaurant-submit');
  var help = $('#restaurant-form-help');
  var i;
  var item;
  var label;
  var removeButton;
  var option;

  list.textContent = '';
  typeSelect.textContent = '';
  option = document.createElement('option');
  option.value = '';
  option.textContent = S.cust.length ? '請選擇類型' : '請先新增類型';
  typeSelect.appendChild(option);

  for (i = 0; i < S.cust.length; i += 1) {
    item = document.createElement('li');
    item.className = 'entry-card';

    label = document.createElement('div');
    label.className = 'entry-copy';
    label.textContent = S.cust[i];

    removeButton = document.createElement('button');
    removeButton.className = 'entry-action';
    removeButton.type = 'button';
    removeButton.textContent = '刪除';
    removeButton.setAttribute('data-category-remove', String(i));
    removeButton.setAttribute('aria-label', '刪除類型 ' + S.cust[i]);

    item.appendChild(label);
    item.appendChild(removeButton);
    list.appendChild(item);

    option = document.createElement('option');
    option.value = S.cust[i];
    option.textContent = S.cust[i];
    typeSelect.appendChild(option);
  }

  setHidden('custom-category-empty', S.cust.length > 0);
  submitButton.disabled = S.cust.length === 0;
  help.textContent = S.cust.length
    ? '填好店名、地址和類型，就能加入你的自訂餐廳。'
    : '先新增一個自訂類型，才能新增餐廳。';
}

function renderCustomRestaurants() {
  var list = $('#custom-restaurant-list');
  var i;
  var restaurant;
  var item;
  var copy;
  var name;
  var details;
  var removeButton;
  var descriptions;

  list.textContent = '';

  for (i = 0; i < S.custR.length; i += 1) {
    restaurant = S.custR[i];
    item = document.createElement('li');
    item.className = 'entry-card';

    copy = document.createElement('div');
    copy.className = 'entry-copy';

    name = document.createElement('strong');
    name.textContent = restaurant.name || '未命名餐廳';
    copy.appendChild(name);

    descriptions = [];
    if (restaurant.type) {
      descriptions.push(restaurant.type);
    }
    if (restaurant.address) {
      descriptions.push(restaurant.address);
    }
    descriptions.push(restaurant.vegetarian ? '提供素食' : '未標記素食');

    details = document.createElement('p');
    details.textContent = descriptions.join('・');
    copy.appendChild(details);

    removeButton = document.createElement('button');
    removeButton.className = 'entry-action';
    removeButton.type = 'button';
    removeButton.textContent = '刪除';
    removeButton.setAttribute('data-restaurant-remove', String(i));
    removeButton.setAttribute('aria-label', '刪除餐廳 ' + (restaurant.name || '未命名餐廳'));

    item.appendChild(copy);
    item.appendChild(removeButton);
    list.appendChild(item);
  }

  setHidden('custom-restaurant-empty', S.custR.length > 0);
}

function addCustomCategory(name) {
  var normalizedName = name.trim();
  var i;

  if (!normalizedName) {
    toast('請輸入類型名稱。');
    return false;
  }

  for (i = 0; i < S.cust.length; i += 1) {
    if (S.cust[i].toLocaleLowerCase() === normalizedName.toLocaleLowerCase()) {
      toast('這個類型已經存在。');
      return false;
    }
  }

  S.cust.push(normalizedName);
  save();
  renderCustomCategories();
  toast('已新增類型：' + normalizedName);
  return true;
}

document.addEventListener('submit', function (event) {
  var form = event.target;
  var formData;
  var restaurant;

  if (form.id === 'category-form') {
    event.preventDefault();
    if (addCustomCategory($('#category-name').value)) {
      form.reset();
    }
    return;
  }

  if (form.id !== 'restaurant-form') {
    return;
  }

  event.preventDefault();
  formData = new FormData(form);
  restaurant = {
    name: String(formData.get('name') || '').trim(),
    type: String(formData.get('type') || ''),
    address: String(formData.get('address') || '').trim(),
    vegetarian: $('#restaurant-vegetarian').checked
  };

  if (!restaurant.name || !restaurant.type || !restaurant.address) {
    toast('請填寫店名、類型和地址。');
    return;
  }

  S.custR.push(restaurant);
  save();
  renderCustomRestaurants();
  form.reset();
  toast('已新增餐廳：' + restaurant.name);
});

document.addEventListener('click', function (event) {
  var target = event.target;
  var categoryIndex;
  var restaurantIndex;
  var category;
  var i;

  if (target.hasAttribute('data-category-remove')) {
    categoryIndex = Number(target.getAttribute('data-category-remove'));
    category = S.cust[categoryIndex];

    for (i = 0; i < S.custR.length; i += 1) {
      if (S.custR[i].type === category) {
        toast('這個類型還有自訂餐廳，請先刪除相關餐廳。');
        return;
      }
    }

    S.cust.splice(categoryIndex, 1);
    save();
    renderCustomCategories();
    toast('已刪除類型：' + category);
    return;
  }

  if (target.hasAttribute('data-restaurant-remove')) {
    restaurantIndex = Number(target.getAttribute('data-restaurant-remove'));
    S.custR.splice(restaurantIndex, 1);
    save();
    renderCustomRestaurants();
    toast('已刪除自訂餐廳。');
  }
});

renderCustomCategories();
renderCustomRestaurants();
