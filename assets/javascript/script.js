/**
 * IIFE to avoid polluting global scope
 */
(function(){
  const DateTime = luxon.DateTime;
  const ak = '3e0bc2bc17306f8b9a632d42c1b9d1c7';
  //html elements
  const $datalist = $('#possibles');
  const $searchInput = $('input[name="search"]');
  const $prevList = $('#prev-list');
  const $contentTarget = $('#content-target');

  //city data
  const possibleCities = [];
  console.log(localStorage);
  const lastCities = JSON.parse(localStorage.getItem('lastCities')) || {
    // '{lat}/{lon}': {lat:36.1672559,lon:-115.148516,fullName:'Las Vegas, Nevada, US',lastAccessed:0}
  };
  /**
   * Function copied from https://github.com/you-dont-need/You-Dont-Need-Lodash-Underscore#_debounce. Delays execution of a function until `wait` time has passed to prevent a function from being called too frequently.
   * @param {function} func - The function to call
   * @param {number} wait - Time to wait before calling in ms
   * @param {boolean} [leading = true] - Whether to fire immediately or not
   */
   function debounce(func, wait, immediate) {
    var timeout;
    return function() {
      var context = this, args = arguments;
      clearTimeout(timeout);
      timeout = setTimeout(function() {
        timeout = null;
        if (!immediate) func.apply(context, args);
      }, wait);
      if (immediate && !timeout) func.apply(context, args);
    };
  }

  /**
   * A function that calls the open weather api to get the current weather and forecast for the selected city.
   * @param {object} cityObj - Object describing the selected city
   */
  const getForecast = async(cityObj) => {
    const response = await fetch(`https://api.openweathermap.org/data/2.5/onecall?lat=${cityObj.lat}&lon=${cityObj.lon}&appid=${ak}&units=imperial`);
    const result = await response.json();
    console.log('result',result);
    $contentTarget.empty();
    result.daily.length = 5;

    [result.current,...result.daily].forEach((forecast,index) =>{
      const forecastDate = DateTime
        .fromSeconds(forecast.dt)
        .toLocaleString(DateTime.DATE_MED_WITH_WEEKDAY);
      const headerText = index ? 
        forecastDate :
        createFullCityName(cityObj);

      const $card = $(`<li class="${index ? '' : 'current '}card"></li>`);
      const $headRow = $('<div class="head-row">');

      const $h = $(`<h${index ? 3 : 2}>${headerText}</h${index ? 3 : 2}>`);
      const $icon = createWeatherImage(forecast.weather[0]);
      $headRow.append($h,$icon);
      $card.append($headRow);
      if(!index){
        const $subhead = $(`<span class="subhead">${forecastDate}</span>`)
        $card.append($subhead);
      }

      const $ul = $('<ul>');
      const displayNames = {
        temp:'Temp',
        wind:'Wind',
        humidity:'Humidity',
        uvi:'UV Index'
      };
      const weatherHandlers = {
        temp:tempDisplay,
        wind:windDisplay,
        humidity:humidityDisplay,
        uvi:uvDisplay
      };
      const props = ['temp','wind','humidity'];
      if(!index){
        props.push('uvi');
      }
      props.forEach(prop => {
        const $liEl = $('<li>');

        $h4 = $(`<h4>${displayNames[prop]}:</h4>`);
        $liEl.append($h4);
        weatherHandlers[prop]($liEl,forecast);
        $ul.append($liEl);
      });
      $card.append($ul);
      $contentTarget.append($card);
    })
  };

  /**
   * A function that creates the weather icon.
   * @param {HTMLDOMElement} $card - The card list item
   * @param {object} weatherObj - Object describing the weather icon to be used
   * @returns {HTMLDOMElement} image - The image that is created from the weather information.
   */
  const createWeatherImage = function(weatherObj){
    return $(`<img src="https://openweathermap.org/img/wn/${weatherObj.icon}@2x.png" alt="${weatherObj.description}">`);
  };

  //Weather property specific display outputs
  const genericOutput = ($liEl,value,units) => {
    const $spanEl = $(`<span>${value} ${units}</span>`);
    $liEl.append($spanEl);
  };
  const tempDisplay = ($liEl,forecast) => {
    if(typeof forecast.temp === 'object'){
      forecast.temp = forecast.temp.day;
    }
    genericOutput($liEl,forecast.temp,'\u2109');
  };
  const windDisplay = ($liEl,forecast) => {
    genericOutput($liEl,forecast.wind_speed,'MPH');
    const $degree = $(`<span class="material-icons" style="transform:rotate(${forecast.wind_deg - 45}deg);">near_me</span>`)
    $liEl.append($degree);
  };
  const humidityDisplay = ($liEl,forecast) => {
    genericOutput($liEl,forecast.humidity,'%');
  };
  const uvDisplay = ($liEl,forecast) => {
    const uvRatio = Math.max(
      270,
      270 + ((11-forecast.uvi) * 20)
    );
    const $spanEl = $(`<span class="uv-index" style="--uv-hue:${uvRatio};">${forecast.uvi}</span>`);
    $liEl.append($spanEl);
  };

  /**
   * Function that stores the selected city in localStorage and adds it to the list of recent cities.
   * @param {object} cityObj - Object describing the selected city
   */
  const rememberCity = (cityObj) => {
    $searchInput.val('');
    lastCities[`${cityObj.lat}/${cityObj.lon}`] = lastCities[`${cityObj.lat}/${cityObj.lon}`] || 
      {
        fullName:cityObj.fullName || createFullCityName(cityObj),
        lat:cityObj.lat,
        lon:cityObj.lon
      };
    lastCities[`${cityObj.lat}/${cityObj.lon}`].lastAccessed = Date.now();
    localStorage.setItem('lastCities',JSON.stringify(lastCities));
    listCities(true);
  };

  const cityFound = async (selectedCity)=>{
    await getForecast(selectedCity);
    rememberCity(selectedCity);
  };

  /**
   * Function that lists the remembered cities out on the page
   * @param {boolean} hideCurrent - Whether to hide the first button or not.
   */
  const listCities = function(hideFirst){
    $prevList.empty();
    Object
      .values(lastCities)
      .sort((a,b) => b.lastAccessed - a.lastAccessed)
      .forEach((city,index)=>{
        const $liEl = $('<li>');
        if(!index && hideFirst){
          $liEl.css({display:'none'});
        }

        const $cityButton = $(`<button class="card">${city.fullName}</button>`);

        $liEl.append($cityButton);
        $prevList.append($liEl);
      });
  };

  const createFullCityName = (obj) => `${obj.name}${obj.state ? `, ${obj.state}` :''}, ${obj.country}`;

  /**
   * Function that initiates a search of the cities using the Open Weather Geocoding API
   * @param {object} event - The event that fired the function
   */
  const searchCities = async (event) => {
    const searchText = validateInput();
    if(!searchText) return;
    const [city,state,country] = searchText.toLowerCase().match(/^(.+?),\s*(?:(.+?)(?:,|$)\s*)?(?:(.+)$)?/)?.slice(1) || [];
    const selectedCity = possibleCities.find(obj => 
      city === obj.name.toLowerCase() &&
        (
          (state === (obj.state || '').toLowerCase() && country === (obj.country || '').toLowerCase()) ||
          (!country && (state === (obj.state || '').toLowerCase() ||
            state === (obj.country || '').toLowerCase()))
        )
    );
    console.log('selectedCity',selectedCity);
    if(selectedCity){
      possibleCities.length = 0;
      possibleCities.push(selectedCity);
      cityFound(selectedCity);
      return;
    }
    
    const response = await fetch(`https://api.openweathermap.org/geo/1.0/direct?q=${searchText}&limit=5&appid=${ak}`);
    const results = await response.json();
    possibleCities.length = 0;
    $datalist.empty();
    if(results.length > 1){
      possibleCities.push(...results);
      possibleCities.forEach(result => {
        const locString = createFullCityName(result);
        const $option = $(`<option value="${locString}">${locString}</option`);
        $datalist.append($option);
      });
    }else if(results.length){
      cityFound(results[0]);
    }
  };
  //Debounce the search function to prevent excessive API calls
  const debouncedSearch = debounce(searchCities,250);

  //Validate that there are enough characters to search with
  const validateInput = ()=>{
    const text = $searchInput.val();
    return text.length >= 3 ?
      text :
      false;
  };

  $searchInput.on('input',debouncedSearch);
  $searchInput.change(debouncedSearch);

  $prevList.on('click','button',async (event)=>{
    const $button = $(event.target);
    const name = $button.text();
    const response = await fetch(`https://api.openweathermap.org/geo/1.0/direct?q=${name}&limit=5&appid=${ak}`);
    const selectedCity = await response.json();
    cityFound(selectedCity[0]);
  });

  //Create the display of previously searched cities
  listCities();
})();