/* 這個檔案負責篩選條件按鈕，並將目前選擇更新到共用狀態 F。 */
function selectSingleChoice(group, value, clickedButton) {
  var buttons = document.querySelectorAll('[data-filter-group="' + group + '"]');
  var i;
  var isSelected;

  for (i = 0; i < buttons.length; i += 1) {
    isSelected = buttons[i] === clickedButton;
    buttons[i].classList.toggle('is-selected', isSelected);
    buttons[i].setAttribute('aria-pressed', isSelected ? 'true' : 'false');
  }

  if (group === 'meat') {
    F.meat = value;
  } else if (group === 'rng') {
    F.rng = Number(value);
  }
}

function toggleStapleChoice(button) {
  var selected;
  var selectedButtons;
  var i;

  selected = !button.classList.contains('is-selected');
  button.classList.toggle('is-selected', selected);
  button.setAttribute('aria-pressed', selected ? 'true' : 'false');

  selectedButtons = document.querySelectorAll('[data-filter-group="stp"].is-selected');
  F.stp = [];

  for (i = 0; i < selectedButtons.length; i += 1) {
    F.stp.push(selectedButtons[i].getAttribute('data-value'));
  }
}

document.addEventListener('click', function (event) {
  var button = event.target;
  var group;
  var value;

  while (button && button !== document && !button.hasAttribute('data-filter-group')) {
    button = button.parentNode;
  }

  if (!button || button === document) {
    return;
  }

  group = button.getAttribute('data-filter-group');
  value = button.getAttribute('data-value');

  if (group === 'stp') {
    toggleStapleChoice(button);
  } else {
    selectSingleChoice(group, value, button);
  }
});
