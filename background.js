// Amazon Smart Recommendations - Background Script
// This script handles communication between content script and API

// API endpoint URL - updated to use Gemini API
const API_ENDPOINT = "https://amazon-smart-recommendations-api.vercel.app/api/gemini";
// const API_ENDPOINT = "https://amazon-smart-recommendations-api.vercel.app/api/recommendations"; // Old Perplexity endpoint

// Fallback test mode setting
const TEST_MODE = false;

// In-memory cache for recommendations
const recommendationsCache = new Map();

// Settings with default values
let settings = {
  autoShow: true,
  maxRecommendations: 3,
  priority: 'price', // 'price', 'ratings', or 'features'
  theme: 'light',
  animationSpeed: 'normal',
  apiKey: '' // User can provide their own Google API key
};

// Initialize
chrome.runtime.onInstalled.addListener(() => {
  console.log("Amazon Smart Recommendations extension installed");
  
  // Load settings from storage
  loadSettings();
});

// Load settings from chrome storage
function loadSettings() {
  chrome.storage.local.get('amazonSmartRecsSettings', (result) => {
    if (result.amazonSmartRecsSettings) {
      settings = { ...settings, ...result.amazonSmartRecsSettings };
      console.log("Loaded settings:", settings);
    } else {
      // Save default settings if none exist
      saveSettings();
    }
  });
}

// Save settings to chrome storage
function saveSettings() {
  chrome.storage.local.set({ 'amazonSmartRecsSettings': settings }, () => {
    console.log("Saved settings:", settings);
  });
}

// Clear recommendations cache
function clearCache() {
  recommendationsCache.clear();
  console.log("Cache cleared");
}

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("Background received message:", request.action);
  
  // Handle different message types
  switch (request.action) {
    case 'getRecommendations':
      getRecommendations(request.product)
        .then(data => {
          sendResponse({ success: true, data });
        })
        .catch(error => {
          console.error("Error fetching recommendations:", error);
          sendResponse({ success: false, error: error.message });
        });
      return true; // Keep channel open for async response
      
    case 'getSettings':
      sendResponse({ success: true, settings });
      return false;
      
    case 'saveSettings':
      settings = { ...settings, ...request.settings };
      saveSettings();
      sendResponse({ success: true });
      return false;
      
    case 'clearCache':
      clearCache();
      sendResponse({ success: true });
      return false;
      
    default:
      console.log("Unknown action:", request.action);
      sendResponse({ success: false, error: 'Unknown action' });
      return false;
  }
});

// Fetch recommendations from API or cache
async function getRecommendations(product) {
  try {
    console.log("Getting recommendations for:", product);
    
    // Check if we have a valid product object
    if (!product || !product.title) {
      throw new Error('Invalid product data');
    }
    
    // Create cache key from product ASIN or title
    const cacheKey = product.asin || product.title.substring(0, 50).toLowerCase().replace(/\s+/g, '_');
    
    // Check cache first
    if (recommendationsCache.has(cacheKey)) {
      const cachedData = recommendationsCache.get(cacheKey);
      console.log("Cache hit! Using cached recommendations");
      return { ...cachedData, cached: true };
    }
    
    // Include API key if available in settings
    const apiKey = settings.apiKey || '';
    
    // Call API with product data
    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Preferences': JSON.stringify({
          priority: settings.priority,
          maxRecommendations: settings.maxRecommendations
        })
      },
      body: JSON.stringify({ 
        product,
        apiKey // Pass the API key if the user has provided one
      })
    });
    
    if (!response.ok) {
      console.error(`API error: ${response.status}`);
      
      // Try to get error details from response
      const errorText = await response.text();
      throw new Error(`API returned ${response.status}: ${errorText}`);
    }
    
    // Parse API response
    const data = await response.json();
    
    // Cache the results (unless they're mock data)
    if (!data.usingMockData) {
      recommendationsCache.set(cacheKey, data);
      console.log("Cached recommendations for:", cacheKey);
    }
    
    return data;
  } catch (error) {
    console.error("Error in getRecommendations:", error);
    throw error;
  }
} 