/* 這個檔案負責手動選擇縣市與行政區；自動定位會在後續階段加入。 */
function updateDistrictOptions(city) {
  var districtSelect = $('#dist-select');
  var placeholder = document.createElement('option');
  var districts = TW[city] || [];
  var i;
  var option;

  districtSelect.textContent = '';
  placeholder.value = '';
  placeholder.textContent = '鄉鎮市區';
  districtSelect.appendChild(placeholder);

  for (i = 0; i < districts.length; i += 1) {
    option = document.createElement('option');
    option.value = districts[i];
    option.textContent = districts[i];
    districtSelect.appendChild(option);
  }

  districtSelect.disabled = districts.length === 0;
  F.city = city;
  F.dist = '';
  F.auto = false;
}

document.addEventListener('change', function (event) {
  if (event.target.id === 'city-select') {
    updateDistrictOptions(event.target.value);
  } else if (event.target.id === 'dist-select') {
    F.dist = event.target.value;
    F.auto = false;
  }
});
