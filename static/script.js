/*
 *  This script fetches configuration data (API keys), initializes Firebase with App Check, loads
 *  the Google Maps JavaScript API, handles map interactions, and displays markers representing
 *  places fetched from a backend API.
 */

let mapsApiKey, recaptchaKey; // API keys
let currentAppCheckToken = null; // AppCheck token

async function init() {
  try {
    await fetchConfig(); // Load API keys from .env variable

    /////////// REPLACE with your Firebase configuration details
    const firebaseConfig = {
      apiKey: "AIza.......",
      authDomain: "places.......",
      projectId: "places.......",
      storageBucket: "places.......",
      messagingSenderId: "17.......",
      appId: "1:175.......",
      measurementId: "G-CPQ.......",
    };
    /////////// REPLACE 

    // Initialize Firebase and App Check
    await firebase.initializeApp(firebaseConfig);
    await firebase.appCheck().activate(recaptchaKey);

    // Get the initial App Check token
    currentAppCheckToken = await firebase.appCheck().getToken();
    console.log(currentAppCheckToken)

    // Load the Maps JavaScript API dynamically
    const scriptMaps = document.createElement("script");
    scriptMaps.src = `https://maps.googleapis.com/maps/api/js?key=${mapsApiKey}&libraries=marker,places`;
    scriptMaps.async = true;
    scriptMaps.defer = true;
    scriptMaps.onload = initMap; // Create the map after the script loads
    document.head.appendChild(scriptMaps);
  } catch (error) {
    console.error("Firebase initialization error:", error);
    // Handle the error appropriately (e.g., display an error message)
  }
}
window.onload = init()

// Fetch configuration data from the backend API
async function fetchConfig() {
  const url = "/api/config";

  try {
    const response = await fetch(url);
    const config = await response.json();
    mapsApiKey = config.mapsApiKey;
    recaptchaKey = config.recaptchaKey;
  } catch (error) {
    console.error("Error fetching configuration:", error);
    // Handle the error (e.g., show a user-friendly message)
  }
}

// Initialize the map when the Maps API script loads
let map; // Dynamic Map
let center = { lat: 48.85557501, lng: 2.34565006 };
async function initMap() {
  map = new google.maps.Map(document.getElementById("map"), {
    center: center,
    zoom: 13,
    mapId: "b93f5cef6674c1ff",
    zoomControlOptions: {
      position: google.maps.ControlPosition.RIGHT_TOP,
    },
    streetViewControl: false,
    mapTypeControl: false,
    clickableIcons: false,
    fullscreenControlOptions: {
      position: google.maps.ControlPosition.LEFT_TOP,
    },
  });

  // Initialize the info window for markers
  infoWindow = new google.maps.InfoWindow({});

  // Initial request
  getData(center.lat, center.lng)

  // Add a click listener to the map
  map.addListener("click", async (event) => {
    // Update the center for the Places API query
    center.lat = event.latLng.lat();
    center.lng = event.latLng.lng();

    getData(center.lat, center.lng)
  });
}

async function getData(){
  try {
    // Get a fresh App Check token on each click
    const appCheckToken = await firebase.appCheck().getToken();
    currentAppCheckToken = appCheckToken;
    console.log(currentAppCheckToken)

    // Query for places with the new token and center
    queryPlaces();
  } catch (error) {
    console.error("Error getting App Check token:", error);
  }
}
function queryPlaces() {
  const url = '/api/data'; // "http://localhost:3000/api/data"

  const body = {
    request: {
      includedTypes: ['restaurant', 'park', 'bar'],
      excludedTypes: [],
      maxResultCount: 20,
      locationRestriction: {
        circle: {
          center: {
            latitude: center.lat,
            longitude: center.lng,
          },
          radius: 4000,
        },
      },
    },
  };


  // Provides token to the backend using header: X-Firebase-AppCheck

  fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Firebase-AppCheck': currentAppCheckToken.token,
    },
    body: JSON.stringify(body),
  })
    .then((response) => response.json())
    .then((data) => {
      // display if response successful
      displayMarkers(data.places);
    })
    .catch((error) => {
      alert('No places');
      console.error('Error:', error);
    });
}


//// display places markers on map

let markersArray = [];
let advMarkers = [];
let idsArray = [];
let labelArray = [];
const collisionBehavior = 'OPTIONAL_AND_HIDES_LOWER_PRIORITY';
let infoWindow;

function displayMarkers(data) {
  // Clear existing markers before adding new ones
  clearMarkers();

  const keys = Object.keys(data);
  for (let i = 0; i < keys.length; i++) {
    if (!idsArray.includes(data[keys[i]].id)) {
      createMarker(data[keys[i]]);
      markersArray.push(data[keys[i]]);
      idsArray.push(data[keys[i]].id);
    }
  }
}
function clearMarkers() {
  for (let i = 0; i < advMarkers.length; i++) {
    advMarkers[i].setMap(null);
  }
  advMarkers = []; // Clear the array
  markersArray = [];
  idsArray = [];
  labelArray = [];
}

async function createMarker(place) {
  const location = { lat: place.location.latitude, lng: place.location.longitude };
  // console.log(location)
  const { AdvancedMarkerElement } = await google.maps.importLibrary('marker');

  const label = document.createElement('div');

  const name = place.displayName.text.substring(0, 20) || place.displayName.text;
  const iconsBg = place.iconBackgroundColor || 'white';
  label.className = 'label-container';

  label.innerHTML =
    '<div>' +
    '<div class="label">' +
    name +
    ' ' +
    `<img src="${place.iconMaskBaseUri}.svg" style="background-color:${iconsBg}" class="icons"/>` +
    '</div>' +
    `<div class="label-dot" style="display:block !important ;background-color:${iconsBg}"></div>` +
    '</div>';

  labelArray.push(label.firstElementChild.firstChild);

  const marker = new AdvancedMarkerElement({
    map,
    position: location,
    content: label,
    collisionBehavior,
  });
  advMarkers.push(marker);

  // Create an info window to share between markers.
  // const { InfoWindow } = await google.maps.importLibrary("maps");
  // const infoWindow = new InfoWindow();

  // Add a click listener for each marker, and set up the info window.
  marker.addListener('click', ({ domEvent, latLng }) => {
    const { target } = domEvent;
    const details = library.json.prettyPrint(place);
    const content =
      '<div class="infowindow-content">' +
      place.displayName.text +
      `<pre><code class="electric">${details}</code></pre>` +
      '</div>';
    infoWindow.close();
    infoWindow.setContent(content);
    infoWindow.open(marker.map, marker);
  });
}

//// pretty print marker infowindow
// 
if (!library) {
  var library = {};
}

library.json = {
  replacer(match, pIndent, pKey, pVal, pEnd) {
    const key = '<span class=json-key>';
    const val = '<span class=json-value>';
    const str = '<span class=json-string>';
    let r = pIndent || '';
    if (pKey) r = `${r + key + pKey.replace(/[": ]/g, '')}</span>: `;
    if (pVal) r += `${pVal[0] === '"' ? str : val}${pVal}</span>`;
    return r + (pEnd || '');
  },
  prettyPrint(obj) {
    const jsonLine = /^( *)("[\w]+": )?("[^"]*"|[\w.+-]*)?([,[{])?$/gm;
    return JSON.stringify(obj, null, 3)
      .replace(/&/g, '&amp;')
      .replace(/\\"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(jsonLine, library.json.replacer);
  },
};

