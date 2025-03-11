// Amazon Smart Recommendations Extension - Background Script v3.0.1
// Handles API communication and data processing

console.log('Amazon Smart Recommendations Extension - Background Script v3.0.2 Starting');

// API Configuration
const API_URL = "https://amazon-smart-recommendations-hoi29sblt-marcin8501s-projects.vercel.app/api/recommendations";
const CORS_PROXIES = [
  "https://cors-anywhere.herokuapp.com/",
  "https://api.allorigins.win/raw?url=",
  "https://cors-proxy.htmldriven.com/?url=",
  "https://corsproxy.io/?"
];

// Cache configuration
const CACHE_EXPIRATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
const cache = new Map();

// Initialize extension when installed
chrome.runtime.onInstalled.addListener(() => {
  console.log('Extension installed');
});

// Listen for content script messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "getRecommendations") {
    console.log("Background: Received request for recommendations", message.productData);
    
    // Process product data from content script
    const productData = message.productData || {};
    
    // Get recommendations from API
    getRecommendationsFromAPI(productData)
      .then(data => {
        console.log("Background: Recommendations fetched successfully", data);
        sendResponse({ success: true, data });
      })
      .catch(error => {
        console.error("Background: Error fetching recommendations", error);
        sendResponse({ 
          success: false, 
          error: error.message,
          usingMockData: true
        });
      });
    
    // Return true to indicate we will send an async response
    return true;
  }
  
  if (message.action === "testAPIConnection") {
    console.log("Background: Testing API connection");
    
    // Simple test request to the API
    testAPIConnection()
      .then(result => {
        console.log("Background: API test completed", result);
        sendResponse(result);
      })
      .catch(error => {
        console.error("Background: API test failed", error);
        sendResponse({ 
          success: false, 
          error: error.message,
          connected: false
        });
      });
    
    // Return true to indicate we will send an async response
    return true;
  }
});

// Function to fetch recommendations from the API
async function getRecommendationsFromAPI(productData) {
  console.log("Attempting to fetch recommendations from API:", API_URL);
  
  try {
    // Attempt direct API call first without problematic headers
    console.log("Trying direct API call without X-Requested-With header...");
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
        // Removed X-Requested-With header that was causing CORS issues
      },
      body: JSON.stringify(productData),
    });
    
    // Check if response is ok
    if (!response.ok) {
      console.error(`Direct API call failed with status: ${response.status}`);
      throw new Error(`Direct API call failed with status: ${response.status}`);
    }
    
    // Parse the response
    const data = await response.json();
    console.log("API response received:", data);
    
    // Validate response format
    if (!data.recommendations || !Array.isArray(data.recommendations)) {
      console.error("Invalid API response format:", data);
      throw new Error("Invalid API response format: missing recommendations array");
    }
    
    return {
      recommendations: data.recommendations,
      source: data.source || "API",
      usingMockData: data.usingMockData || false,
      apiConnected: true
    };
  } catch (directError) {
    console.error("Direct API call failed:", directError);
    
    // Try each CORS proxy in sequence
    for (const proxy of CORS_PROXIES) {
      try {
        console.log(`Trying CORS proxy: ${proxy}`);
        let proxyUrl, requestOptions;
        
        // Different handling for different proxy formats
        if (proxy.includes('allorigins')) {
          proxyUrl = `${proxy}${encodeURIComponent(API_URL)}`;
          requestOptions = {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(productData)
          };
        } else if (proxy.includes('htmldriven')) {
          proxyUrl = `${proxy}${encodeURIComponent(API_URL)}`;
          requestOptions = {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(productData)
          };
        } else {
          // Standard proxy format
          proxyUrl = `${proxy}${API_URL}`;
          requestOptions = {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Requested-With': 'XMLHttpRequest'
            },
            body: JSON.stringify(productData)
          };
        }
        
        const proxyResponse = await fetch(proxyUrl, requestOptions);
        
        if (!proxyResponse.ok) {
          throw new Error(`Proxy request failed with status: ${proxyResponse.status}`);
        }
        
        const proxyData = await proxyResponse.json();
        
        // Validate response format
        if (!proxyData.recommendations || !Array.isArray(proxyData.recommendations)) {
          throw new Error("Invalid proxy API response format");
        }
        
        return {
          recommendations: proxyData.recommendations,
          source: proxyData.source || "API via proxy",
          usingMockData: proxyData.usingMockData || false,
          apiConnected: true,
          usedProxy: proxy
        };
      } catch (proxyError) {
        console.error(`CORS proxy ${proxy} failed:`, proxyError);
        // Continue to next proxy
      }
    }
    
    // If all API attempts failed, throw the original error
    throw new Error(`Could not connect to the recommendations API: ${directError.message}`);
  }
}

// Function to test API connection
async function testAPIConnection() {
  try {
    // Test direct connection first
    console.log("Testing direct API connection...");
    const startTime = Date.now();
    
    const response = await fetch(API_URL, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
        // Removed X-Requested-With header that was causing CORS issues
      }
    });
    
    const duration = Date.now() - startTime;
    
    if (!response.ok) {
      throw new Error(`Direct API call failed with status: ${response.status}`);
    }
    
    const data = await response.json();
    
    return {
      success: true,
      connected: true,
      method: 'direct',
      status: response.status,
      duration: `${duration}ms`,
      responseData: data,
      recommendations: data.recommendations || []
    };
  } catch (error) {
    console.error("API connection test failed:", error);
    
    return {
      success: false,
      connected: false,
      error: error.message,
      recommendations: []
    };
  }
}

console.log('Amazon Smart Recommendations Extension - Background Script v3.0.2 Ready'); 