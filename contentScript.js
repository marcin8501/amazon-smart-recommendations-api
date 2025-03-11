// Amazon Smart Recommendations Extension
// Content Script v3.0.0
// This version directly manipulates the DOM without injecting external scripts

console.log('Amazon Smart Recommendations Extension - Content Script v3.0.0 Starting');

// Only run on Amazon domain
if (window.location.hostname.includes('amazon')) {
  console.log('Amazon domain detected, initializing panel');
  
  // Helper for generating mock recommendations as a fallback
  function generateMockRecommendations(productData) {
    if (!productData || !productData.title) return [];
    
    // Get the category or type of product from the title
    const productType = getProductTypeFromTitle(productData.title);
    const brand = productData.brand || getRandomBrand(productType);
    
    return [
      {
        title: `${brand} ${productType} ${getRandomModel(1)}`,
        reason: '15% cheaper with similar features',
        price: productData.price ? productData.price * 0.85 : 29.99
      },
      {
        title: `${getRandomBrand(productType)} ${productType} ${getRandomModel(2)}`,
        reason: 'Higher rated with better quality',
        price: productData.price ? productData.price * 1.15 : 39.99
      },
      {
        title: `${getRandomBrand(productType)} ${productType} ${getRandomModel(3)}`,
        reason: 'Most popular among Amazon customers',
        price: productData.price ? productData.price * 1.05 : 34.99
      }
    ];
  }
  
  // Helper function to extract product type from title
  function getProductTypeFromTitle(title) {
    const commonProductTypes = ['Headphones', 'Earbuds', 'Speaker', 'Camera', 'Laptop', 
                              'Monitor', 'Keyboard', 'Mouse', 'Tablet', 'Watch', 'Phone'];
    
    for (const type of commonProductTypes) {
      if (title.includes(type)) return type;
    }
    
    // Return a default type if none found
    return 'Model';
  }
  
  // Helper function to get random brand name
  function getRandomBrand(productType) {
    const brandsByType = {
      'Headphones': ['Sony', 'Bose', 'Sennheiser', 'Audio-Technica', 'JBL'],
      'Earbuds': ['Samsung', 'Apple', 'Jabra', 'Anker', 'Skullcandy'],
      'Speaker': ['Sonos', 'Bose', 'JBL', 'Ultimate Ears', 'Harman Kardon'],
      'Camera': ['Canon', 'Nikon', 'Sony', 'Fujifilm', 'Panasonic'],
      'Laptop': ['Dell', 'HP', 'Lenovo', 'Asus', 'Acer'],
      'Monitor': ['LG', 'Samsung', 'Dell', 'BenQ', 'Acer'],
      'Keyboard': ['Logitech', 'Corsair', 'Razer', 'HyperX', 'SteelSeries'],
      'Mouse': ['Logitech', 'Razer', 'SteelSeries', 'Corsair', 'Glorious'],
      'Tablet': ['Apple', 'Samsung', 'Microsoft', 'Lenovo', 'Amazon'],
      'Watch': ['Apple', 'Samsung', 'Garmin', 'Fitbit', 'Fossil'],
      'Phone': ['Apple', 'Samsung', 'Google', 'OnePlus', 'Xiaomi'],
      'Model': ['TechPro', 'NextGen', 'PrimeTech', 'ValueMax', 'EliteTech']
    };
    
    const brands = brandsByType[productType] || brandsByType['Model'];
    return brands[Math.floor(Math.random() * brands.length)];
  }
  
  // Helper function to get random model number/name
  function getRandomModel(variant) {
    const models = [
      ['A100', 'X200', 'T300', 'E50', 'Z75', 'M85', 'P95'],
      ['Pro', 'Max', 'Ultra', 'Elite', 'Plus', 'Premium', 'Advanced'],
      ['2022', '2023', 'V2', 'MK3', 'Gen 4', '5th Gen', 'Series 7']
    ];
    
    const modelNumber = models[0][Math.floor(Math.random() * models[0].length)];
    const modelSuffix = models[1][Math.floor(Math.random() * models[1].length)];
    const modelGen = models[2][Math.floor(Math.random() * models[2].length)];
    
    // Create different patterns based on variant to ensure we get different models
    if (variant === 1) return `${modelNumber}`;
    if (variant === 2) return `${modelSuffix} ${modelNumber}`;
    return `${modelNumber} ${modelGen}`;
  }

  // Only run on Amazon product pages
  function isProductPage() {
    try {
      const url = window.location.href;
      return url.includes('amazon.com') && 
             (url.includes('/dp/') || url.includes('/gp/product/')) && 
             !!document.getElementById('productTitle');
    } catch (e) {
      console.error('Error checking if product page:', e);
      return false;
    }
  }
  
  // Format price with currency symbol
  function formatPrice(price) {
    if (!price) return '$0.00';
    return '$' + parseFloat(price).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }
  
  // Extract product information from the page
  function extractProductData() {
    try {
      // Extract ASIN from URL
      let asin = null;
      try {
        const match = window.location.pathname.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/);
        asin = match ? match[1] : null;
      } catch (e) {
        console.warn('Error extracting ASIN:', e);
      }
      
      // Extract product title
      let title = null;
      try {
        const titleElement = document.getElementById('productTitle');
        title = titleElement ? titleElement.textContent.trim() : null;
      } catch (e) {
        console.warn('Error extracting title:', e);
      }
      
      // Extract price
      let price = null;
      try {
        const priceSelectors = [
          '.priceToPay .a-offscreen', 
          '.a-price .a-offscreen',
          '#priceblock_ourprice',
          '#priceblock_dealprice',
          '#price_inside_buybox'
        ];
        
        for (const selector of priceSelectors) {
          try {
            const element = document.querySelector(selector);
            if (element) {
              const priceText = element.textContent.trim();
              const priceValue = parseFloat(priceText.replace(/[^\d.]/g, ''));
              if (!isNaN(priceValue) && priceValue > 0) {
                price = priceValue;
                break;
              }
            }
          } catch (e) { /* continue to next selector */ }
        }
      } catch (e) {
        console.warn('Error extracting price:', e);
      }
      
      // Extract image
      let imageUrl = null;
      try {
        const imgElement = document.getElementById('landingImage');
        imageUrl = imgElement ? imgElement.src : null;
      } catch (e) {
        console.warn('Error extracting image:', e);
      }
      
      // Extract rating
      let rating = null;
      try {
        const ratingText = document.querySelector('#averageCustomerReviews .a-icon-alt');
        if (ratingText) {
          const match = ratingText.textContent.match(/([0-9\.]+) out of/);
          if (match) rating = parseFloat(match[1]);
        }
      } catch (e) {
        console.warn('Error extracting rating:', e);
      }
      
      // Extract review count
      let reviewCount = null;
      try {
        const reviewElement = document.getElementById('acrCustomerReviewText');
        if (reviewElement) {
          const match = reviewElement.textContent.match(/([0-9,]+)/);
          if (match) reviewCount = parseInt(match[1].replace(/,/g, ''));
        }
      } catch (e) {
        console.warn('Error extracting review count:', e);
      }
      
      // Extract brand
      let brand = null;
      try {
        const brandElement = document.querySelector('#bylineInfo');
        if (brandElement) {
          brand = brandElement.textContent
                  .replace('Visit the ', '')
                  .replace(' Store', '')
                  .replace('Brand: ', '')
                  .trim();
        }
      } catch (e) {
        console.warn('Error extracting brand:', e);
      }
      
      const productData = {
        asin,
        title,
        price,
        imageUrl,
        rating,
        reviewCount,
        brand,
        url: window.location.href
      };
      
      console.log('Extracted product data:', productData);
      return productData;
    } catch (e) {
      console.error('Error in extractProductData:', e);
      return null;
    }
  }
  
  // Get recommendations from the API via the background script
  async function getRecommendations(productData) {
    try {
      console.log('Requesting recommendations from background script...');
      
      // Using chrome.runtime.sendMessage directly from the content script
      return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({
          action: 'getRecommendations',
          productData: productData
        }, function(response) {
          if (chrome.runtime.lastError) {
            console.error('Chrome runtime error:', chrome.runtime.lastError);
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          
          // Check if we got a valid response with recommendations
          if (response && response.success && response.data && 
              response.data.recommendations && 
              Array.isArray(response.data.recommendations)) {
            console.log('Received recommendations from background script:', response.data);
            resolve({ 
              recommendations: response.data.recommendations,
              isReal: !response.mock, // Check if this is mock data
              isMock: response.mock || response.data.source === 'mock' // Check both flags
            });
          } else {
            console.log('No valid recommendations from background script:', response);
            resolve({ 
              recommendations: [], 
              isReal: false,
              error: response?.error || 'Failed to get real recommendations'
            });
          }
        });
      });
    } catch (e) {
      console.error('Error in getRecommendations:', e);
      return { 
        recommendations: [],
        isReal: false,
        error: e.message 
      };
    }
  }

  // Test the API connection and show diagnostic information
  async function testAPIConnection(content, productData) {
    // Create the "Testing API Connection" panel
    content.innerHTML = `
        <div class="smart-recommendations-container">
            <div class="amazon-panel-header">
                <h2>Amazon Smart Recommendations - API Diagnostics</h2>
            </div>
            <div class="amazon-panel-content">
                <div class="diagnostic-panel">
                    <h3>Step 1: Testing communication with extension background script</h3>
                    <div id="comm-test-result">Testing...</div>
                    
                    <h3>Step 2: Testing API connection from background script</h3>
                    <div id="api-test-result">Waiting for step 1...</div>
                    
                    <h3>API Information:</h3>
                    <div class="api-info">
                        <p><strong>API URL:</strong> <span id="api-url">https://amazon-smart-recommendations-hoi29sblt-marcin8501s-projects.vercel.app/api/recommendations</span></p>
                        <p><strong>Connection Status:</strong> <span id="api-status">Testing...</span></p>
                        <p><strong>Data Source:</strong> <span id="data-source">Unknown</span></p>
                    </div>
                    
                    <div class="button-container">
                        <button id="show-recommendations-btn">Show Recommendations</button>
                        <button id="retry-connection-btn">Retry Connection</button>
                    </div>

                    <h3>Direct API Testing:</h3>
                    <div class="direct-testing">
                        <p>Try different connection methods:</p>
                        <div class="button-container">
                            <button id="test-direct-btn">Test Direct</button>
                            <button id="test-proxy1-btn">Test CORS Proxy</button>
                            <button id="test-proxy2-btn">Test AllOrigins</button>
                        </div>
                        <div id="direct-test-result" class="test-result">
                            Click a button to test
                        </div>
                    </div>

                    <h3>Standalone API Test Tool:</h3>
                    <p>For more detailed API testing outside of the extension:</p>
                    <div class="button-container">
                        <button id="open-api-test-btn">Open API Test Tool</button>
                    </div>
                    <p class="small-text">This will open our API test tool in a new tab where you can diagnose connection issues in more detail.</p>
                </div>
            </div>
            <div class="amazon-panel-footer">
                <p>Amazon Smart Recommendations - Diagnostics Mode</p>
            </div>
        </div>
    `;

    // Add CSS for the diagnostics panel
    const style = document.createElement('style');
    style.textContent = `
        .diagnostic-panel {
            padding: 15px;
            line-height: 1.5;
        }
        .diagnostic-panel h3 {
            margin-top: 20px;
            color: #232f3e;
            border-bottom: 1px solid #e7e7e7;
            padding-bottom: 8px;
        }
        .diagnostic-panel .api-info {
            background-color: #f8f8f8;
            padding: 10px;
            border-radius: 4px;
            margin: 10px 0;
        }
        .diagnostic-panel .button-container {
            margin: 15px 0;
            display: flex;
            gap: 10px;
        }
        .diagnostic-panel button {
            background-color: #ff9900;
            color: white;
            border: none;
            padding: 8px 15px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
        }
        .diagnostic-panel button:hover {
            background-color: #e88a00;
        }
        .diagnostic-panel .success {
            color: green;
            font-weight: bold;
        }
        .diagnostic-panel .error {
            color: red;
            font-weight: bold;
        }
        .diagnostic-panel .warning {
            color: orange;
            font-weight: bold;
        }
        .diagnostic-panel .test-result {
            background-color: #f8f8f8;
            padding: 10px;
            border-radius: 4px;
            margin: 10px 0;
            max-height: 200px;
            overflow-y: auto;
            font-family: monospace;
            font-size: 12px;
            white-space: pre-wrap;
        }
        .diagnostic-panel .small-text {
            font-size: 12px;
            color: #555;
        }
    `;
    document.head.appendChild(style);

    // Test communication with the background script
    const commTestResult = document.getElementById('comm-test-result');
    
    // First test: can we communicate with the background script?
    try {
        commTestResult.innerHTML = "Testing communication with background script...";
        
        chrome.runtime.sendMessage({ action: 'testConnection' }, response => {
            if (chrome.runtime.lastError) {
                commTestResult.innerHTML = `<span class="error">FAILED: ${chrome.runtime.lastError.message}</span>`;
                document.getElementById('api-test-result').innerHTML = `<span class="error">Skipped - Background script communication failed</span>`;
                document.getElementById('api-status').innerHTML = `<span class="error">Unreachable</span>`;
                document.getElementById('data-source').innerText = "Using simulated data (mock)";
                return;
            }
            
            commTestResult.innerHTML = `<span class="success">SUCCESS: Connected to background script</span>`;
            
            // Second test: can the background script connect to the API?
            const apiTestResult = document.getElementById('api-test-result');
            apiTestResult.innerHTML = "Testing API connection...";
            
            chrome.runtime.sendMessage({ 
                action: 'getRecommendations', 
                productData: productData 
            }, response => {
                if (chrome.runtime.lastError) {
                    apiTestResult.innerHTML = `<span class="error">FAILED: ${chrome.runtime.lastError.message}</span>`;
                    document.getElementById('api-status').innerHTML = `<span class="error">Error</span>`;
                    document.getElementById('data-source').innerText = "Using simulated data (mock)";
                    return;
                }
                
                if (response.success) {
                    if (response.data && (response.data.source === 'mock' || response.data.usingMockData)) {
                        apiTestResult.innerHTML = `<span class="warning">WARNING: API returning sample data</span>`;
                        document.getElementById('api-status').innerHTML = `<span class="warning">Connected</span>`;
                        document.getElementById('data-source').innerText = "Using sample data from API";
                    } else {
                        apiTestResult.innerHTML = `<span class="success">SUCCESS: Received ${response.data?.recommendations?.length || 0} recommendations from API</span>`;
                        document.getElementById('api-status').innerHTML = `<span class="success">Connected</span>`;
                        document.getElementById('data-source').innerText = "Real data from Perplexity API";
                    }
                } else {
                    apiTestResult.innerHTML = `<span class="error">FAILED: ${response.error || 'Unknown error'}</span>`;
                    document.getElementById('api-status').innerHTML = `<span class="error">Error</span>`;
                    document.getElementById('data-source').innerText = "Using simulated data (mock)";
                }
            });
        });
    } catch (error) {
        commTestResult.innerHTML = `<span class="error">FAILED: ${error.message}</span>`;
        document.getElementById('api-test-result').innerHTML = `<span class="error">Skipped - Background script communication failed</span>`;
        document.getElementById('api-status').innerHTML = `<span class="error">Unreachable</span>`;
        document.getElementById('data-source').innerText = "Using simulated data (mock)";
    }
    
    // Add event listeners for buttons
    document.getElementById('show-recommendations-btn').addEventListener('click', () => {
        // Get recommendations and update the panel
        chrome.runtime.sendMessage({ 
            action: 'getRecommendations', 
            productData: productData 
        }, response => {
            // Handle the response from the background script
            if (chrome.runtime.lastError) {
                console.error('Error getting recommendations:', chrome.runtime.lastError);
                return;
            }
            
            if (response.success) {
                // Replace test panel with recommendations panel
                const smartPanel = document.querySelector('.amazon-smart-recommendations');
                if (smartPanel) {
                    // Re-create the panel structure
                    smartPanel.innerHTML = `
                        <div class="amazon-panel-header">
                            <h2>Amazon Smart Recommendations</h2>
                        </div>
                        <div class="amazon-panel-content"></div>
                        <div class="amazon-panel-footer"></div>
                    `;
                    
                    // Get the content area
                    const content = smartPanel.querySelector('.amazon-panel-content');
                    
                    // Call the function in amazonPanel.js to update the content
                    if (content && window.updatePanelContent) {
                        window.updatePanelContent(response.data);
                    }
                }
            }
        });
    });
    
    document.getElementById('retry-connection-btn').addEventListener('click', () => {
        testAPIConnection(content, productData);
    });
    
    // API testing buttons
    document.getElementById('test-direct-btn').addEventListener('click', () => {
        const resultElement = document.getElementById('direct-test-result');
        resultElement.innerText = 'Testing direct API connection...';
        
        chrome.runtime.sendMessage({ 
            action: 'testAPI', 
            productData: { product: productData },
            method: 'direct'
        }, response => {
            if (chrome.runtime.lastError) {
                resultElement.innerHTML = `<span class="error">FAILED: ${chrome.runtime.lastError.message}</span>`;
                return;
            }
            
            if (response.success) {
                const result = response.result;
                resultElement.innerHTML = `
Method: ${result.method}
Duration: ${result.duration}ms
Status: ${result.status}
Success: ${result.success}

Response:
${typeof result.response === 'object' ? JSON.stringify(result.response, null, 2) : result.response}
                `;
            } else {
                resultElement.innerHTML = `<span class="error">Error: ${response.error}</span>`;
            }
        });
    });
    
    document.getElementById('test-proxy1-btn').addEventListener('click', () => {
        const resultElement = document.getElementById('direct-test-result');
        resultElement.innerText = 'Testing via CORS Anywhere proxy...';
        
        chrome.runtime.sendMessage({ 
            action: 'testAPI', 
            productData: { product: productData },
            method: 'proxy1'
        }, response => {
            if (chrome.runtime.lastError) {
                resultElement.innerHTML = `<span class="error">FAILED: ${chrome.runtime.lastError.message}</span>`;
                return;
            }
            
            if (response.success) {
                const result = response.result;
                resultElement.innerHTML = `
Method: ${result.method} (CORS Anywhere)
Duration: ${result.duration}ms
Status: ${result.status}
Success: ${result.success}

Response:
${typeof result.response === 'object' ? JSON.stringify(result.response, null, 2) : result.response}
                `;
            } else {
                resultElement.innerHTML = `<span class="error">Error: ${response.error}</span>`;
            }
        });
    });
    
    document.getElementById('test-proxy2-btn').addEventListener('click', () => {
        const resultElement = document.getElementById('direct-test-result');
        resultElement.innerText = 'Testing via AllOrigins proxy...';
        
        chrome.runtime.sendMessage({ 
            action: 'testAPI', 
            productData: { product: productData },
            method: 'proxy2'
        }, response => {
            if (chrome.runtime.lastError) {
                resultElement.innerHTML = `<span class="error">FAILED: ${chrome.runtime.lastError.message}</span>`;
                return;
            }
            
            if (response.success) {
                const result = response.result;
                resultElement.innerHTML = `
Method: ${result.method} (AllOrigins)
Duration: ${result.duration}ms
Status: ${result.status}
Success: ${result.success}

Response:
${typeof result.response === 'object' ? JSON.stringify(result.response, null, 2) : result.response}
                `;
            } else {
                resultElement.innerHTML = `<span class="error">Error: ${response.error}</span>`;
            }
        });
    });
    
    // Open the API test tool in a new tab
    document.getElementById('open-api-test-btn').addEventListener('click', () => {
        window.open(
            'https://amazon-smart-recommendations-hoi29sblt-marcin8501s-projects.vercel.app/api-test.html',
            '_blank'
        );
    });

    // Find and update any API URL references
    document.getElementById('api-url').textContent = "https://amazon-smart-recommendations-hoi29sblt-marcin8501s-projects.vercel.app/api/recommendations";
}
  
  // Update panel content with product info and recommendations
  function updatePanelContent(content, productData, result) {
    try {
      if (!productData || !productData.title) {
        content.innerHTML = '<div style="color: red; padding: 10px;">No product data available</div>';
        return;
      }
      
      // Extract recommendations from the result object
      const recommendations = result.recommendations || [];
      const isRealData = result.isReal === true;
      const isMockData = result.isMock === true;
      const errorMessage = result.error || '';
      
      // If we encountered an error and don't have recommendations, show an error
      if (recommendations.length === 0 || (!isRealData && !isMockData)) {
        content.innerHTML = `
          <div style="padding: 20px; background-color: #FFF4F4; border: 1px solid #FF9494; border-radius: 4px; color: #D8000C; text-align: center;">
            <h3 style="margin: 0 0 15px 0;">⚠️ No connection to Perplexity API</h3>
            <p style="margin: 5px 0;">This extension requires a connection to the Perplexity API to provide real recommendations.</p>
            <p style="margin: 10px 0; font-weight: bold;">Error: ${errorMessage}</p>
            <div style="margin-top: 15px; padding: 10px; background-color: #f5f5f5; border-radius: 4px; text-align: left;">
              <p style="margin: 0 0 10px 0; font-weight: bold;">Troubleshooting:</p>
              <ol style="margin: 0; padding-left: 20px;">
                <li>Check your extension permissions</li>
                <li>Verify your Perplexity API key is valid</li>
                <li>Check network connectivity to the API endpoint</li>
                <li>Reload the extension and try again</li>
              </ol>
            </div>
          </div>
        `;
        return;
      }
      
      // If using mock data, show a notification banner
      let mockBanner = '';
      if (isMockData) {
        mockBanner = `
          <div style="padding: 10px; background-color: #fff8e1; border: 1px solid #ffe082; border-radius: 4px; margin-bottom: 15px; font-size: 12px; color: #ff6f00; text-align: center;">
            <p style="margin: 0;">⚠️ Using simulated recommendations - API connection unavailable</p>
          </div>
        `;
      }
      
      let html = '';
      
      // Add mock banner if needed
      html += mockBanner;
      
      // Add recommendations section
      html += `
        <div style="margin: 0; padding: 15px; background-color: #fafafa; border-radius: 4px; border: 1px solid #eee;">
          <h4 style="margin: 0 0 15px 0; font-size: 15px; color: #232F3E; border-bottom: 1px solid #ddd; padding-bottom: 8px;">Similar Products You Might Prefer:</h4>
          <div id="recommendations-list">
      `;
      
      // Check if we have recommendations
      if (recommendations && recommendations.length > 0) {
        // Add recommendations
        recommendations.forEach((item, index) => {
          const isEven = index % 2 === 0;
          
          // Clean up the title to remove unwanted phrases
          let cleanTitle = item.title || 'Alternative Product';
          cleanTitle = cleanTitle
            .replace(/Better Value\s*(Alternative)?\s*-?\s*/i, '')
            .replace(/Premium Option\s*-?\s*/i, '')
            .replace(/Best Seller\s*(in)?\s*([^-]+)?\s*-?\s*/i, '')
            .trim();
          
          html += `
            <div style="margin-bottom: ${index < recommendations.length - 1 ? '15px' : '0'}; padding: 10px; ${index < recommendations.length - 1 ? 'border-bottom: 1px solid #eee;' : ''}; background-color: ${isEven ? '#f5f5f5' : '#ffffff'}; border-radius: 4px;">
              <div style="margin-bottom: 8px;">
                <div style="font-weight: bold; color: #0066c0; font-size: 15px;">
                  ${cleanTitle}
                </div>
              </div>
              <div style="color: #333; font-size: 13px; margin-left: 5px;">
                <ul style="margin: 5px 0 0 15px; padding: 0; list-style-type: square;">
                  <li style="margin-bottom: 4px;">${item.reason || 'Recommended alternative'}</li>
                  <li style="margin-bottom: 4px;">${index === 0 ? 'More affordable option with essential features' : 
                                                index === 1 ? 'Enhanced features include better durability and performance' : 
                                                'Highly rated by Amazon customers with proven reliability'}</li>
                </ul>
              </div>
            </div>
          `;
        });
      } else {
        // No recommendations found
        html += `<p style="color: #555; font-style: italic;">No recommendations available for this product.</p>`;
      }
      
      html += `
          </div>
        </div>
        <div style="font-size: 11px; color: #565959; text-align: center; margin-top: 15px; padding: 5px;">
          <p style="margin: 0;">${isRealData ? 'Powered by Perplexity API' : isMockData ? 'Using simulated recommendations' : 'No recommendations available'}</p>
        </div>
      `;
      
      // Update content
      content.innerHTML = html;
    } catch (e) {
      console.error('Error updating panel content:', e);
      content.innerHTML = `<div style="color: red; padding: 10px;">Error displaying recommendations: ${e.message}</div>`;
    }
  }
  
  // Create and show the recommendations panel
  function createPanel() {
    try {
      console.log('Creating panel');
      
      // Check if panel already exists
      if (document.getElementById('amazon-standalone-panel')) {
        console.log('Panel already exists, skipping creation');
        return;
      }
      
      // Extract product data
      const productData = extractProductData();
      if (!productData || !productData.title) {
        console.log('Could not extract product data, aborting panel creation');
        return;
      }
      
      // Create panel container
      const panel = document.createElement('div');
      panel.id = 'amazon-standalone-panel';
      panel.style.position = 'fixed';
      panel.style.top = '100px';
      panel.style.right = '20px';
      panel.style.width = '300px';
      panel.style.maxHeight = '80vh';
      panel.style.backgroundColor = '#fff';
      panel.style.border = '1px solid #ddd';
      panel.style.borderRadius = '4px';
      panel.style.boxShadow = '0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24)';
      panel.style.zIndex = '2147483646';
      panel.style.padding = '20px';
      panel.style.display = 'flex';
      panel.style.flexDirection = 'column';
      panel.style.overflowY = 'auto';
      
      // Create header
      const header = document.createElement('div');
      header.style.display = 'flex';
      header.style.justifyContent = 'space-between';
      header.style.alignItems = 'center';
      header.style.marginBottom = '15px';
      
      const title = document.createElement('h2');
      title.textContent = 'Alternative Products';
      title.style.margin = '0';
      title.style.fontSize = '18px';
      title.style.color = '#232F3E'; // Amazon navy blue
      
      const closeButton = document.createElement('button');
      closeButton.textContent = 'X';
      closeButton.style.background = 'transparent';
      closeButton.style.border = 'none';
      closeButton.style.color = '#232F3E';
      closeButton.style.fontSize = '16px';
      closeButton.style.cursor = 'pointer';
      closeButton.onclick = function() {
        panel.style.display = 'none';
        toggleButton.style.right = '0';
      };
      
      // Add diagnostic button
      const diagButton = document.createElement('button');
      diagButton.textContent = '🔍';
      diagButton.title = 'Test API Connection';
      diagButton.style.position = 'absolute';
      diagButton.style.right = '40px';
      diagButton.style.background = 'transparent';
      diagButton.style.border = 'none';
      diagButton.style.color = '#232F3E';
      diagButton.style.fontSize = '16px';
      diagButton.style.cursor = 'pointer';
      diagButton.onclick = function() {
        testAPIConnection(content, productData);
      };
      
      header.appendChild(title);
      header.appendChild(closeButton);
      header.appendChild(diagButton);
      
      // Create content area
      const content = document.createElement('div');
      content.style.flex = '1';
      content.style.backgroundColor = 'white';
      content.style.padding = '15px';
      content.style.borderRadius = '4px';
      content.style.color = 'black';
      content.style.overflowY = 'auto';
      
      // Initially show loading message
      content.innerHTML = '<div style="text-align: center; padding: 20px;">Loading recommendations...</div>';
      
      // Assemble panel
      panel.appendChild(header);
      panel.appendChild(content);
      
      // Create toggle button
      const toggleButton = document.createElement('button');
      toggleButton.id = 'amazon-standalone-toggle';
      toggleButton.style.position = 'fixed';
      toggleButton.style.top = '100px';
      toggleButton.style.right = '320px';
      toggleButton.style.width = '30px';
      toggleButton.style.height = '60px';
      toggleButton.style.backgroundColor = '#FEBD69'; // Amazon yellow
      toggleButton.style.border = '1px solid #a88734';
      toggleButton.style.borderRight = 'none';
      toggleButton.style.borderRadius = '4px 0 0 4px';
      toggleButton.style.cursor = 'pointer';
      toggleButton.style.zIndex = '2147483647';
      toggleButton.style.fontSize = '14px';
      toggleButton.textContent = '↔';
      toggleButton.onclick = function() {
        if (panel.style.display === 'none') {
          panel.style.display = 'flex';
          toggleButton.style.right = '320px';
        } else {
          panel.style.display = 'none';
          toggleButton.style.right = '0';
        }
      };
      
      // Add to document
      document.body.appendChild(panel);
      document.body.appendChild(toggleButton);
      
      console.log('Amazon panel created successfully');
      
      // Fetch and display recommendations
      getRecommendations(productData)
        .then(result => {
          updatePanelContent(content, productData, result);
        })
        .catch(error => {
          content.innerHTML = `<div style="color: red; padding: 10px;">Error loading recommendations: ${error.message}</div>`;
        });
    } catch (e) {
      console.error('Error creating panel:', e);
    }
  }
  
  // Main initialization function
  function initialize() {
    try {
      console.log('Initializing Amazon panel...');
      
      // Only run on product pages
      if (isProductPage()) {
        console.log('Amazon product page detected, creating panel');
        createPanel();
      } else {
        console.log('Not an Amazon product page, exiting');
      }
    } catch (e) {
      console.error('Error in initialize:', e);
    }
  }
  
  // Wait for page to be fully loaded
  if (document.readyState === 'complete') {
    console.log('Document already complete, initializing now');
    setTimeout(initialize, 500);
  } else {
    console.log('Waiting for document to be ready...');
    window.addEventListener('load', function() {
      setTimeout(initialize, 500);
    });
  }
  
} else {
  console.log('Not an Amazon domain, extension not active');
}

// Listen for messages from the Amazon panel script
window.addEventListener('message', (event) => {
  // Only accept messages from our window
  if (event.source !== window) return;
  
  // Handle the recommendations request
  if (event.data.type === 'AMAZON_RECOMMENDATIONS_REQUEST') {
    console.log('Content script: Received message from panel for recommendations');
    handleRecommendationsRequest(event.data.productData);
  }
  
  // Handle the diagnostics request
  if (event.data.type === 'AMAZON_RECOMMENDATIONS_DIAGNOSTICS') {
    console.log('Content script: Received message from panel for diagnostics');
    const productData = event.data.productData;
    const panel = document.querySelector('.amazon-smart-recommendations');
    
    if (panel) {
      const content = panel.querySelector('.amazon-panel-content');
      if (content) {
        // Replace content with diagnostics panel
        testAPIConnection(content, productData);
      }
    }
  }
});

console.log('Amazon Smart Recommendations Extension - Content Script v3.0.0 Complete'); 