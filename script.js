let map;
let directionsService;
let currentLocation;
let routeRenderers = []; // To store multiple DirectionsRenderer instances
let routeLabels = []; // To store route labels
let currentWeatherMarker = null; // Track the current weather marker
let currentWeatherInfoWindow = null; // Track the current weather info window

const openWeatherAPIKey = '9743c676f0895b4b3e2272c45e7dc45d'; // OpenWeatherMap API key

// Initialize the Google Map
function initMap() {
  map = new google.maps.Map(document.getElementById('map'), {
    zoom: 8,
    center: { lat: 17.6411, lng: 78.4952 }, // Centered in Hyderabad, India
  });

  directionsService = new google.maps.DirectionsService();

  // Get the user's current location
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(position => {
      currentLocation = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      };
      map.setCenter(currentLocation);
      new google.maps.Marker({
        position: currentLocation,
        map: map,
        title: "Your location",
      });
    });
  } else {
    alert("Geolocation is not supported by this browser.");
  }
}

// Fetch weather data using OpenWeatherMap API
function getWeather(lat, lng, mapPosition, label = "Weather") {
  const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&appid=${openWeatherAPIKey}&units=metric`;

  axios.get(weatherUrl)
    .then(response => {
      const weather = response.data;
      const iconCode = weather.weather[0].icon;  // Get the weather icon code from the response
      const iconUrl = `http://openweathermap.org/img/w/${iconCode}.png`;  // Construct the icon URL
      const weatherDescription = weather.weather[0].description;  // Get weather description
      const temperature = weather.main.temp; // Get temperature


const weatherContent = `
  <div style="display: flex; align-items: center; padding: 2px; margin: 0; width: 150px;"> <!-- Adjusted width and minimal padding -->
    <img src="${iconUrl}" alt="${weatherDescription}" style="width: 50px; height: 50px;"> <!-- Icon size remains the same -->
    <span style="margin-left: 5px; font-size: 16px; line-height: 1.2;"><strong>${label}</strong>: ${weatherDescription} (${temperature}°C)</span> <!-- Keep font size and margin -->
  </div>
`;

      // Remove the previous weather info window if exists
      if (currentWeatherInfoWindow) {
        currentWeatherInfoWindow.close();
      }

      // Display the weather icon and description in an info window
      currentWeatherInfoWindow = new google.maps.InfoWindow({
        content: weatherContent,
        position: mapPosition,
      });

      currentWeatherInfoWindow.open(map);

    })
    .catch(error => {
      console.error('Error fetching weather data:', error);
      document.getElementById('weather').textContent = 'Weather information not available.';
    });
}

// Calculate and display routes
function calculateRoute() {
  const destination = document.getElementById('destination').value;
  const mode = document.getElementById('mode').value;

  if (!currentLocation) {
    alert("Current location not found.");
    return;
  }

  if (!destination) {
    alert("Please enter a destination.");
    return;
  }

  const request = {
    origin: currentLocation,
    destination: destination,
    travelMode: google.maps.TravelMode[mode],
    provideRouteAlternatives: true, // Request alternative routes
  };

  if (mode === 'DRIVING') {
    request.drivingOptions = {
      departureTime: new Date(), // Current time for live traffic info
      trafficModel: 'bestguess',
    };
  }

  directionsService.route(request, (response, status) => {
    if (status === 'OK') {
      const routes = response.routes;
      const routeCount = Math.min(routes.length, 4); // Limit to 4 routes

      // Clear previous renderers and labels
      clearRoutesAndLabels();

      if (routeCount === 1) {
        alert("Only one route is available.");
        renderRoute(response, 0); // Display the single route
        return;
      }

      // Display up to 4 routes with the same color (blue)
      for (let i = 0; i < routeCount; i++) {
        renderRoute(response, i);
      }

      // Get weather data for the destination after routes are rendered
      const destinationLatLng = routes[0].legs[0].end_location;
      getWeather(destinationLatLng.lat(), destinationLatLng.lng(), destinationLatLng, "Destination Weather");

    } else {
      alert('Directions request failed due to ' + status);
    }
  });
}

// Clear previous routes and labels
function clearRoutesAndLabels() {
  routeRenderers.forEach(renderer => renderer.setMap(null));
  routeLabels.forEach(label => label.setMap(null));
  routeRenderers = [];
  routeLabels = [];
  clearRouteInfo();
}

// Render a specific route with the same color (blue) and add route label
function renderRoute(response, routeIndex) {
  const routeRenderer = new google.maps.DirectionsRenderer({
    map: map,
    directions: response,
    routeIndex: routeIndex, // Index of the route to render
    polylineOptions: {
      strokeColor: '#0000FF', // Blue color for all routes
      strokeOpacity: 0.7,
      strokeWeight: 5,
    },
    suppressMarkers: false, // Keep markers for each route
    clickable: true, // Allow user to click on the route
  });

  // Add click listener to the route renderer for selecting the route
  google.maps.event.addListener(routeRenderer, 'click', () => {
    selectRoute(response, routeIndex);
  });

  routeRenderers.push(routeRenderer); // Store the renderer for future reference

  // Assign a route label like "A", "B", "C", etc.
  const routeLabel = String.fromCharCode(65 + routeIndex); // 'A', 'B', 'C'
  const routeMidpoint = getRouteMidpoint(response.routes[routeIndex].overview_path);

  // Add label marker at the midpoint of the route
  const labelMarker = new google.maps.Marker({
    position: routeMidpoint,
    map: map,
    label: routeLabel,
    clickable: true,
  });

  // Add click listener to the label for selecting the route
  labelMarker.addListener('click', () => {
    selectRoute(response, routeIndex);
  });

  routeLabels.push(labelMarker); // Store the label marker for future reference
}

// Select and display only the chosen route, and show distance, duration, and weather at the midpoint
function selectRoute(response, selectedRouteIndex) {
  routeRenderers.forEach((renderer, routeIndex) => {
    if (routeIndex === selectedRouteIndex) {
      renderer.setOptions({
        polylineOptions: {
          strokeColor: '#0000FF', // Blue color for the selected route
          strokeOpacity: 0.9,
          strokeWeight: 7, // Thicker line for the selected route
        },
        map: map,
      });
    } else {
      renderer.setOptions({
        polylineOptions: {
          strokeColor: '#cdd8ff', // Light blue for non-selected routes
          strokeOpacity: 0.7,
          strokeWeight: 5, // Thinner line for non-selected routes
        },
        map: map,
      });
    }
  });

  // Get the selected route's distance and duration
  const route = response.routes[selectedRouteIndex].legs[0];
  displayRouteInfo(route, selectedRouteIndex);

  // Get the midpoint coordinates of the selected route
  const routeMidpoint = getRouteMidpoint(response.routes[selectedRouteIndex].overview_path);

  // Fetch weather for the midpoint
  getWeather(routeMidpoint.lat(), routeMidpoint.lng(), routeMidpoint); // Pass mapPosition (routeMidpoint) to getWeather
}

// Function to get the midpoint of a route (unchanged)
function getRouteMidpoint(path) {
  const midpointIndex = Math.floor(path.length / 2);
  return path[midpointIndex];
}

// Display the selected route's distance and time
function displayRouteInfo(route, index) {
  const routeLabel = String.fromCharCode(65 + index); // 'A', 'B', 'C', 'D'
  const distance = route.distance.text;
  const duration = route.duration.text;

  document.getElementById('distance').textContent = `Route ${routeLabel} Distance: ${distance}`;
  document.getElementById('duration').textContent = `Route ${routeLabel} Duration: ${duration}`;
}

// Clear previous route information
function clearRouteInfo() {
  document.getElementById('distance').textContent = '';
  document.getElementById('duration').textContent = '';
}
