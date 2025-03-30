let mapData;

fetch("/data.json")
  .then((response) => response.json())
  .then((data) => {
    mapData = data;
  })
  .catch((error) => {
    console.error("Error loading Map data:", error);
    alert("Failed to load map data. Please check the network connection.");
  });

// --- Map Initialization ---
// Function to get URL parameters
function getQueryParam(param) {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(param);
}

// Initialize map
const map = L.map("map"); // Assuming your map div has id 'map'

// Add tile layer (example)
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: "© OpenStreetMap contributors",
}).addTo(map);

// Check for bounds parameter
const boundsParam = getQueryParam("bounds");
let initialBounds = null;

if (boundsParam) {
  try {
    // Parse the JSON string back into an array
    initialBounds = JSON.parse(decodeURIComponent(boundsParam));
    // Validate bounds format [[lat, lon], [lat, lon]]
    if (
      Array.isArray(initialBounds) &&
      initialBounds.length === 2 &&
      Array.isArray(initialBounds[0]) &&
      initialBounds[0].length === 2 &&
      Array.isArray(initialBounds[1]) &&
      initialBounds[1].length === 2 &&
      typeof initialBounds[0][0] === "number" &&
      typeof initialBounds[0][1] === "number" &&
      typeof initialBounds[1][0] === "number" &&
      typeof initialBounds[1][1] === "number"
    ) {
      // Use fitBounds for potentially better results than setView+zoom
      map.fitBounds(initialBounds);
    } else {
      console.warn("Invalid bounds parameter format. Using default view.");
      initialBounds = null;
      // Default view
      map.setView([40, 0], 3);
    }
  } catch (e) {
    console.error("Error parsing bounds parameter:", e);
    initialBounds = null;
    // Default view
    map.setView([40, 0], 3);
  }
} else {
  // Default view if no parameter
  map.setView([40, 0], 3);
}

// --- Styling and Coloring ---
const defaultStyle = {
  fillColor: "#D3D3D3", // Grey for countries/states with no data
  weight: 1,
  opacity: 1,
  color: "white", // Border color
  fillOpacity: 0.5,
};

const highlightStyle = {
  weight: 3,
  color: "#666", // Darker border on hover/click
  dashArray: "",
  fillOpacity: 0.9,
};

// Vibrant colors for features with data
const vibrantColors = [
  "#1f77b4",
  "#ff7f0e",
  "#2ca02c",
  "#d62728",
  "#9467bd",
  "#8c564b",
  "#e377c2",
  "#7f7f7f",
  "#bcbd22",
  "#17becf",
  "#aec7e8",
  "#ffbb78",
  "#98df8a",
  "#ff9896",
  "#c5b0d5",
  "#c49c94",
  "#f7b6d2",
  "#c7c7c7",
  "#dbdb8d",
  "#9edae5",
  "#e41a1c", // Bright Red
  "#377eb8", // Vivid Blue
  "#4daf4a", //Strong Green
  "#984ea3", // Rich Purple
  "#ff7f00", // Vibrant Orange
  "#ffff33", // Bright Yellow
  "#a65628", // Warm Brown
  "#f781bf", // Vibrant Pink
  "#66c2a5", // Aqua Green
  "#fc8d62", // Coral Orange
  "#8da0cb", // Soft Indigo
  "#e78ac3", // Pink Lavender
  "#a6d854", // Lime Green
  "#ffd92f", // Sunny Yellow
  "#e5c494", // Tan
];
let colorIndex = 0;
const featureColors = {}; // Store assigned color for each feature with data

function getFeatureStyle(feature) {
  const featureName = feature.properties.name || feature.properties.ADMIN;
  const countryName = feature.properties.ADMIN; // Use for country matching
  const stateName = feature.properties.name; // Use for state matching

  const data = getFeatureData(countryName, stateName);

  if (data && data.length > 0) {
    if (!featureColors[featureName]) {
      featureColors[featureName] =
        vibrantColors[colorIndex++ % vibrantColors.length];
    }
    return {
      fillColor: featureColors[featureName],
      weight: 1,
      opacity: 1,
      color: "white",
      fillOpacity: 0.7,
    };
  } else {
    return defaultStyle;
  }
}

// --- Data Retrieval Logic ---
function getFeatureData(countryName, stateName) {
  let items = [];
  let featureIdentifier = countryName; // Default to country name

  // Check US States first
  if (stateName) {
    featureIdentifier = stateName;
    if (mapData.US.states[stateName]) {
      items = items.concat(
        mapData.US.states[stateName].map((item) => ({
          ...item,
          source: stateName,
        }))
      );
    }
    // Add shared US data for states
    if (mapData.US.shared) {
      items = items.concat(
        mapData.US.shared.map((item) => ({ ...item, source: "USA" }))
      );
    }
  }
  // Check Countries
  else if (mapData.countries[countryName]) {
    items = items.concat(
      mapData.countries[countryName].map((item) => ({
        ...item,
        source: countryName,
      }))
    );
  }

  // Check Regions
  for (const regionName in mapData.regions) {
    const regionData = mapData.regions[regionName];
    if (regionData.members.includes(featureIdentifier)) {
      items = items.concat(
        regionData.items.map((item) => ({ ...item, source: regionName }))
      );
    }
    // add the data to the state if the USA is in the region
    if (stateName && regionData.members.includes("United States of America")) {
      items = items.concat(
        regionData.items.map((item) => ({ ...item, source: regionName }))
      );
    }
  }

  // Remove duplicates based on title and link (optional but good practice)
  const uniqueItems = [];
  const seen = new Set();
  for (const item of items) {
    const key = `${item.title}|${item.link}`;
    if (!seen.has(key)) {
      uniqueItems.push(item);
      seen.add(key);
    }
  }
  return uniqueItems;
}

// --- Popup Content Generation ---
function createPopupContent(featureName, items) {
  if (!items || items.length === 0) {
    return `<div class="popup-title">${featureName}</div>No specific information available.`;
  }

  let content = `<div class="popup-title">${featureName}</div>`;

  // Group items by source (Country, State, Region, Shared)
  const groupedItems = items.reduce((acc, item) => {
    const source = item.source || "General"; // Default group
    if (!acc[source]) {
      acc[source] = [];
    }
    acc[source].push(item);
    return acc;
  }, {});

  const groupOrder = ["State", "Country"]; // Add other regions as needed

  const sortedGroups = Object.keys(groupedItems).sort((a, b) => {
    const indexA = groupOrder.indexOf(a);
    const indexB = groupOrder.indexOf(b);
    if (indexA === -1 && indexB === -1) return a.localeCompare(b); // Sort alphabetically if not in predefined order
    if (indexA === -1) return 1; // Put non-ordered groups at the end
    if (indexB === -1) return -1;
    return indexA - indexB; // Sort by predefined order
  });

  sortedGroups.forEach((source) => {
    let sourceTitle = source;
    if (source === featureName) {
      sourceTitle = `${featureName} Specific`;
    } else if (mapData.US.states[source]) {
      sourceTitle = `${source} State Specific`;
    } else if (mapData.countries[source]) {
      sourceTitle = `${source} Specific`;
    }

    content += `<div class="info-section-title">${sourceTitle}</div>`;
    content += `<ul class="popup-list">`;
    groupedItems[source].forEach((item) => {
      content += `<li><a href="${item.link}" target="_blank">${item.title}</a></li>`;
    });
    content += `</ul>`;
  });

  return content;
}

// --- Interaction Logic ---
let countriesLayer;
let statesLayer;
let clickedLayer = null;
let originalStyle = null;

function highlightFeature(e) {
  const layer = e.target;

  // Don't highlight if a layer is already clicked (unless it's the clicked layer itself)
  if (clickedLayer && clickedLayer !== layer) return;

  layer.setStyle(highlightStyle);

  if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
    layer.bringToFront();
  }

  // Show temporary popup only on hover if nothing is clicked
  if (!clickedLayer) {
    const feature = layer.feature;
    const countryName = feature.properties.ADMIN || feature.properties.name;
    const stateName = feature.properties.name;
    const featureName = stateName ? stateName : countryName;
    const data = getFeatureData(countryName, stateName);
    const popupContent = createPopupContent(featureName, data);

    // Use a temporary tooltip-like popup for hover
    layer
      .bindTooltip(popupContent, { sticky: true, direction: "auto" })
      .openTooltip();
  }
}

function resetHighlight(e) {
  const layer = e.target;

  // Close temporary tooltip
  if (layer.getTooltip()) {
    layer.closeTooltip().unbindTooltip();
  }

  // Only reset style if this layer is NOT the currently clicked layer
  if (clickedLayer !== layer) {
    // Determine which geojson layer this feature belongs to
    if (countriesLayer && countriesLayer.hasLayer(layer)) {
      countriesLayer.resetStyle(layer);
    } else if (statesLayer && statesLayer.hasLayer(layer)) {
      statesLayer.resetStyle(layer);
    }
  }
}

function handleClick(e) {
  const layer = e.target;

  // Close any existing tooltips first
  layer.closeTooltip().unbindTooltip();

  // Reset previous clicked layer if exists
  if (clickedLayer && clickedLayer !== layer) {
    if (countriesLayer && countriesLayer.hasLayer(clickedLayer)) {
      countriesLayer.resetStyle(clickedLayer);
    } else if (statesLayer && statesLayer.hasLayer(clickedLayer)) {
      statesLayer.resetStyle(clickedLayer);
    }
    clickedLayer.closePopup(); // Close the popup of the previously clicked layer
  }

  // Set new clicked layer
  clickedLayer = layer;
  originalStyle = getFeatureStyle(layer.feature); // Store its original style for map click reset

  // Apply highlight style persistently
  layer.setStyle(highlightStyle);
  if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
    layer.bringToFront();
  }

  // Bind and open persistent popup
  const feature = layer.feature;
  const countryName = feature.properties.ADMIN;
  const stateName = feature.properties.name;
  const featureName = stateName ? stateName : countryName;
  const data = getFeatureData(countryName, stateName);
  const popupContent = createPopupContent(featureName, data);

  // Use a permanent popup on click
  layer
    .bindPopup(popupContent, { closeOnClick: false, autoClose: false }) // Prevent closing on map click
    .openPopup();

  // Stop propagation to prevent map click handler from firing immediately
  L.DomEvent.stopPropagation(e);
}

function onMapClick(e) {
  if (clickedLayer) {
    // Reset the style of the previously clicked layer
    if (countriesLayer && countriesLayer.hasLayer(clickedLayer)) {
      countriesLayer.resetStyle(clickedLayer);
    } else if (statesLayer && statesLayer.hasLayer(clickedLayer)) {
      statesLayer.resetStyle(clickedLayer);
    }
    clickedLayer.closePopup();
    clickedLayer = null;
    originalStyle = null;
  }
}

map.on("click", onMapClick);

function onEachFeature(feature, layer) {
  layer.on({
    mouseover: highlightFeature,
    mouseout: resetHighlight,
    click: handleClick,
  });
}

// --- Load GeoJSON Data ---
const countriesUrl = "/geojson/world-countries.geojson"; // USA is deleted from this file
const statesUrl = "/geojson/us-states.geojson";

// Fetch and add Countries Layer
fetch(countriesUrl)
  .then((response) => response.json())
  .then((data) => {
    countriesLayer = L.geoJson(data, {
      style: getFeatureStyle,
      onEachFeature: onEachFeature,
    }).addTo(map);
    console.log("Countries layer loaded.");

    // Fetch and add US States Layer after countries layer
    return fetch(statesUrl);
  })
  .then((response) => response.json())
  .then((data) => {
    statesLayer = L.geoJson(data, {
      style: getFeatureStyle,
      onEachFeature: onEachFeature,
    }).addTo(map);
    console.log("US States layer loaded.");
    if (statesLayer) statesLayer.bringToFront();
  })
  .catch((error) => {
    console.error("Error loading GeoJSON data:", error);
    alert(
      "Failed to load map data. Please check the GeoJSON URLs and network connection."
    );
  });
