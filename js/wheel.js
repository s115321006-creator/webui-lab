/* 這個檔案負責依照篩選條件整理料理類型、繪製轉盤與抽出結果。 */
var WHEEL_CATALOG = [
  { label: '台式', color: '#e83b2d', staples: ['rice', 'noodle', 'other'], vegetarian: true },
  { label: '日式', color: '#2da160', staples: ['rice', 'noodle', 'other'], vegetarian: true },
  { label: '韓式', color: '#7050a1', staples: ['rice', 'noodle', 'other'], vegetarian: true },
  { label: '義式', color: '#f5b82e', staples: ['rice', 'noodle', 'other'], vegetarian: true },
  { label: '美式', color: '#e83b2d', staples: ['other'], vegetarian: true },
  { label: '泰式', color: '#2da160', staples: ['rice', 'noodle'], vegetarian: true },
  { label: '越式', color: '#7050a1', staples: ['rice', 'noodle', 'other'] },
  { label: '港式', color: '#f5b82e', staples: ['rice', 'noodle', 'other'], vegetarian: true },
  { label: '火鍋', color: '#e83b2d', staples: ['rice', 'noodle', 'other'], vegetarian: true },
  { label: '燒烤', color: '#2da160', staples: ['rice', 'other'], vegetarian: true },
  { label: '速食', color: '#7050a1', staples: ['other'], vegetarian: true },
  { label: '鹽酥雞', color: '#f5b82e', staples: ['other'], vegetarian: true },
  { label: '滷味', color: '#e83b2d', staples: ['rice', 'noodle', 'other'], vegetarian: true },
  { label: '健康餐', color: '#2da160', staples: ['rice', 'other'], vegetarian: true },
  { label: '超商', color: '#7050a1', staples: ['rice', 'noodle', 'other'], vegetarian: true },
  {
    label: '蔬食料理',
    color: '#f5b82e',
    staples: ['rice', 'noodle', 'other'],
    vegetarian: true,
    meatOnly: true
  },
  { label: '中式', color: '#e83b2d', staples: ['rice', 'noodle', 'other'], vegetarian: true },
  { label: '咖哩', color: '#2da160', staples: ['rice', 'noodle'], vegetarian: true },
  { label: '早午餐', color: '#7050a1', staples: ['other'], vegetarian: true }
];
var WHEEL_OPTIONS = [];
var wheelRotation = 0;
var wheelIsSpinning = false;

function getWheelOptions() {
  var options = [];
  var i;
  var category;

  for (i = 0; i < WHEEL_CATALOG.length; i += 1) {
    category = WHEEL_CATALOG[i];
    if ((category.meatOnly && F.meat !== 'meat') ||
      (F.meat === 'veg' && !category.vegetarian)) {
      continue;
    }

    if (category.staples.some(function (staple) {
      return F.stp.indexOf(staple) !== -1;
    })) {
      options.push(category);
    }
  }

  return options;
}

function createSvgElement(name, attributes) {
  var element = document.createElementNS('http://www.w3.org/2000/svg', name);
  var attribute;

  for (attribute in attributes) {
    if (Object.prototype.hasOwnProperty.call(attributes, attribute)) {
      element.setAttribute(attribute, attributes[attribute]);
    }
  }

  return element;
}

function renderWheel() {
  var graphic = $('#wheel-graphic');
  var center = 180;
  var radius = 176;
  var segmentAngle = 360 / WHEEL_OPTIONS.length;
  var labelRadius = radius * 0.66;
  var i;
  var startAngle;
  var endAngle;
  var middleAngle;
  var uprightAngle;
  var startRadians;
  var endRadians;
  var labelRadians;
  var labelX;
  var labelY;
  var path;
  var label;
  var largeArc;

  graphic.textContent = '';

  for (i = 0; i < WHEEL_OPTIONS.length; i += 1) {
    startAngle = -90 + i * segmentAngle;
    endAngle = startAngle + segmentAngle;
    middleAngle = (startAngle + endAngle) / 2;
    uprightAngle = middleAngle > 90 && middleAngle < 270 ? middleAngle + 180 : middleAngle;
    startRadians = startAngle * Math.PI / 180;
    endRadians = endAngle * Math.PI / 180;
    labelRadians = middleAngle * Math.PI / 180;
    labelX = center + labelRadius * Math.cos(labelRadians);
    labelY = center + labelRadius * Math.sin(labelRadians);
    largeArc = segmentAngle > 180 ? 1 : 0;

    path = createSvgElement('path', {
      d: 'M ' + center + ' ' + center + ' L ' +
        (center + radius * Math.cos(startRadians)) + ' ' +
        (center + radius * Math.sin(startRadians)) +
        ' A ' + radius + ' ' + radius + ' 0 ' + largeArc + ' 1 ' +
        (center + radius * Math.cos(endRadians)) + ' ' +
        (center + radius * Math.sin(endRadians)) + ' Z',
      fill: WHEEL_OPTIONS[i].color,
      class: 'wheel-segment'
    });
    graphic.appendChild(path);

    label = createSvgElement('text', {
      x: labelX,
      y: labelY,
      class: 'wheel-label',
      'text-anchor': 'middle',
      'dominant-baseline': 'central',
      transform: 'rotate(' + uprightAngle + ' ' + labelX + ' ' + labelY + ')',
      'font-size': String(Math.min(15, (radius - labelRadius) * 1.8 / WHEEL_OPTIONS[i].label.length))
    });
    label.textContent = WHEEL_OPTIONS[i].label;
    graphic.appendChild(label);
  }

  graphic.appendChild(createSvgElement('circle', {
    cx: center,
    cy: center,
    r: 16,
    fill: '#17251f'
  }));
  graphic.setAttribute('aria-label', '餐點轉盤，共 ' + WHEEL_OPTIONS.length + ' 種料理類型');
}

function finishSpin(index, button, graphic, result) {
  var option = WHEEL_OPTIONS[index];

  graphic.classList.remove('is-spinning');
  button.disabled = false;
  button.textContent = '不喜歡，重轉';
  result.textContent = '今天吃：' + option.label + '！';
  graphic.setAttribute('aria-label', '抽中' + option.label);
  setHidden('wheel-result-actions', false);
  wheelIsSpinning = false;
}

function spinWheel() {
  var button = $('#spin-again');
  var graphic = $('#wheel-graphic');
  var result = $('#wheel-result');
  var selectedIndex;
  var currentRotation;
  var targetRotation;
  var adjustment;
  var completed = false;

  if (wheelIsSpinning || !WHEEL_OPTIONS.length) {
    return;
  }

  wheelIsSpinning = true;
  selectedIndex = Math.floor(Math.random() * WHEEL_OPTIONS.length);
  currentRotation = ((wheelRotation % 360) + 360) % 360;
  targetRotation = (360 - (selectedIndex + 0.5) * 360 / WHEEL_OPTIONS.length) % 360;
  adjustment = (targetRotation - currentRotation + 360) % 360;
  wheelRotation += 360 * 5 + adjustment;

  button.disabled = true;
  setHidden('wheel-result-actions', true);
  button.textContent = '轉盤旋轉中…';
  result.textContent = '正在幫你挑選…';
  graphic.setAttribute('aria-label', '轉盤旋轉中');
  graphic.classList.add('is-spinning');
  graphic.addEventListener('transitionend', function onSpinEnd(event) {
    if (event.target !== graphic || completed) {
      return;
    }

    completed = true;
    graphic.removeEventListener('transitionend', onSpinEnd);
    finishSpin(selectedIndex, button, graphic, result);
  });

  graphic.getBoundingClientRect();
  graphic.style.transform = 'rotate(' + wheelRotation + 'deg)';

  window.setTimeout(function () {
    if (!completed) {
      completed = true;
      finishSpin(selectedIndex, button, graphic, result);
    }
  }, 4600);
}

$('#start-spin').addEventListener('click', function () {
  var options = getWheelOptions();

  if (!F.stp.length) {
    toast('請至少選擇一種主食，再開始轉。');
    return;
  }

  if (!options.length) {
    toast('目前的葷素與主食條件找不到餐點，請調整篩選。');
    return;
  }

  WHEEL_OPTIONS = options;
  renderWheel();
  go('wheel');
  spinWheel();
});

$('#spin-again').addEventListener('click', spinWheel);
WHEEL_OPTIONS = getWheelOptions();
renderWheel();
