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
  
  // Display recommendations in the UI
  function displayRecommendations(recommendations, metadata = {}) {
    const recommendationsContainer = document.getElementById('amazon-smart-recommendations-list');
    
    if (!recommendationsContainer) {
      console.error('Recommendations container not found');
      return;
    }
    
    // Clear existing recommendations
    recommendationsContainer.innerHTML = '';
    
    // Sort recommendations if needed based on extension settings
    // For now, we'll just display them as they come from the API
    
    // Check if we have recommendations to display
    if (!recommendations || recommendations.length === 0) {
      recommendationsContainer.innerHTML = '<p class="no-recommendations">No recommendations available</p>';
      return;
    }
    
    // Category labels for the recommendations
    const categoryLabels = [
      'Premium Alternative',
      'Best Value Option', 
      'Most Popular Choice'
    ];
    
    // Display each recommendation
    recommendations.slice(0, 3).forEach((item, index) => {
      // Clean up title if needed (remove excessive whitespace, etc.)
      const cleanTitle = item.title.replace(/\s+/g, ' ').trim();
      
      // Use type if available, otherwise fall back to category label
      const categoryLabel = item.type || categoryLabels[index % categoryLabels.length];
      
      // Create HTML for the recommendation
      const recommendationHTML = `
        <div class="amazon-smart-recommendation">
          <div class="recommendation-category">${categoryLabel}</div>
          <div class="recommendation-content">
            <div class="recommendation-image">
              <img src="${item.imageUrl || 'https://via.placeholder.com/80'}" alt="${cleanTitle}">
            </div>
            <div class="recommendation-details">
              <h4>${cleanTitle}</h4>
              <div class="recommendation-price">$${item.price}</div>
              ${item.rating ? `<div class="recommendation-rating">
                ${item.rating} ★ ${item.reviewCount ? `<span class="review-count">(${item.reviewCount})</span>` : ''}
              </div>` : ''}
              <p class="recommendation-reason">${item.reason || 'Alternative product recommendation'}</p>
            </div>
          </div>
          <a href="${item.affiliateLink || '#'}" class="recommendation-link" target="_blank">View on Amazon</a>
        </div>
      `;
      
      // Add the HTML to the container
      recommendationsContainer.innerHTML += recommendationHTML;
    });
    
    // Update footer text to show data source
    const footer = document.querySelector('.amazon-smart-recommendations-footer');
    if (footer) {
      const usingMockData = metadata.usingMockData;
      const source = metadata.source || 'Google Gemini';
      
      if (usingMockData) {
        footer.innerHTML = '⚠️ Using simulated recommendations';
      } else if (metadata.cached) {
        footer.innerHTML = '📊 Showing cached recommendations';
      } else if (source.includes('Gemini')) {
        footer.innerHTML = '✨ Real recommendations from Google Gemini AI';
      } else {
        footer.innerHTML = '✨ Smart product recommendations';
      }
    }
    
    // Set up click listeners for the links
    setupLinkTracking();
  }

  // Extract product details from Amazon page
  function extractProductDetails() {
    try {
      console.log('Extracting product details from Amazon page');
      
      // Get product title
      const titleElement = document.querySelector('#productTitle') || 
                         document.querySelector('.product-title') ||
                         document.querySelector('.a-size-large.product-title-word-break');
      
      // Get product price
      const priceElement = document.querySelector('.a-price .a-offscreen') || 
                          document.querySelector('[data-asin-price]') ||
                          document.querySelector('.a-price') ||
                          document.querySelector('.a-color-price');
      
      // Get product image
      const imageElement = document.querySelector('#landingImage') || 
                          document.querySelector('#imgBlkFront') ||
                          document.querySelector('#main-image') ||
                          document.querySelector('#imgTagWrapperId img');
      
      // Get ASIN (Amazon Standard Identification Number)
      let asin = '';
      // Try to extract from URL first
      const asinMatch = window.location.pathname.match(/\/dp\/([A-Z0-9]{10})/);
      if (asinMatch && asinMatch[1]) {
        asin = asinMatch[1];
      } else {
        // Try to extract from a meta tag or data attribute
        const asinElement = document.querySelector('[data-asin]');
        if (asinElement && asinElement.dataset.asin) {
          asin = asinElement.dataset.asin;
        }
      }
      
      // Get product category
      const categoryElement = document.querySelector('#wayfinding-breadcrumbs_feature_div') || 
                             document.querySelector('#nav-subnav');
      
      // Get product brand
      const brandElement = document.querySelector('#bylineInfo') || 
                         document.querySelector('.a-color-secondary.a-size-base.prodDetAttrValue');
      
      // Get product rating
      const ratingElement = document.querySelector('#acrPopover') || 
                           document.querySelector('.a-icon-alt');
      
      // Get product reviews count
      const reviewsElement = document.querySelector('#acrCustomerReviewText') || 
                           document.querySelector('.a-size-base.a-color-secondary');
      
      // Parse and clean the extracted text
      const title = titleElement ? titleElement.textContent.trim() : '';
      
      let price = '';
      if (priceElement) {
        const priceText = priceElement.textContent;
        const priceMatch = priceText.match(/\$?([0-9]+(\.[0-9]+)?)/);
        price = priceMatch ? priceMatch[1] : '';
      }
      
      const imageUrl = imageElement ? (imageElement.src || '') : '';
      
      let category = '';
      if (categoryElement) {
        const categoryText = categoryElement.textContent.trim();
        // Extract the main category (usually the first item)
        const categoryParts = categoryText.split('>');
        if (categoryParts.length > 0) {
          category = categoryParts[categoryParts.length - 1].trim();
        } else {
          category = categoryText;
        }
      }
      
      const brand = brandElement ? brandElement.textContent.trim().replace('Brand: ', '').replace('Visit the ', '').replace(' Store', '') : '';
      
      let rating = '';
      if (ratingElement) {
        const ratingText = ratingElement.textContent;
        const ratingMatch = ratingText.match(/([0-9\.]+)/);
        rating = ratingMatch ? ratingMatch[1] : '';
      }
      
      let reviewsCount = '';
      if (reviewsElement) {
        const reviewsText = reviewsElement.textContent;
        const reviewsMatch = reviewsText.match(/([0-9,]+)/);
        reviewsCount = reviewsMatch ? reviewsMatch[1] : '';
      }
      
      console.log('Extracted product details:', {
        title,
        price,
        asin,
        category,
        brand,
        rating,
        reviewsCount,
        imageUrl
      });
      
      // Only return the product object if we have at least a title
      if (title) {
        return {
          title,
          price,
          asin,
          category,
          brand,
          rating,
          reviewsCount,
          imageUrl
        };
      } else {
        console.error('Could not extract product title');
        return null;
      }
    } catch (error) {
      console.error('Error extracting product details:', error);
      return null;
    }
  }

  // Fetch recommendations from background script
  function fetchRecommendations(product) {
    return new Promise((resolve, reject) => {
      try {
        // Show loading state
        updateLoadingState(true, 'Fetching smart recommendations...');
        
        console.log('Fetching recommendations for product:', product);
        
        // Send request to background script
        chrome.runtime.sendMessage(
          {
            action: 'getRecommendations',
            product: product
          },
          response => {
            // Hide loading state
            updateLoadingState(false);
            
            if (response && response.success) {
              console.log('Recommendations received:', response.data);
              resolve(response.data);
            } else {
              console.error('Error fetching recommendations:', response.error);
              
              // If we have mock data available, use it as fallback
              if (window.MOCK_RECOMMENDATIONS) {
                console.log('Using mock recommendations as fallback');
                resolve({
                  recommendations: window.MOCK_RECOMMENDATIONS,
                  source: 'Mock Data (Fallback)',
                  usingMockData: true
                });
              } else {
                reject(new Error(response.error || 'Unknown error'));
              }
            }
          }
        );
      } catch (error) {
        // Hide loading state
        updateLoadingState(false);
        
        console.error('Error in fetchRecommendations:', error);
        reject(error);
      }
    });
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
                        <p><strong>API URL:</strong> <span id="api-url">https://amazon-smart-recommendations-9re1orbea-marcin8501s-projects.vercel.app/api/recommendations</span></p>
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
            'https://amazon-smart-recommendations-9re1orbea-marcin8501s-projects.vercel.app/api-test.html',
            '_blank'
        );
    });

    // Find and update any API URL references
    document.getElementById('api-url').textContent = "https://amazon-smart-recommendations-9re1orbea-marcin8501s-projects.vercel.app/api/recommendations";
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
        // Define category labels based on index
        const categoryLabels = [
          "Premium Alternative",
          "Best Value Option",
          "Most Popular Choice"
        ];
        
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
          
          // Create affiliate link
          const affiliateLink = item.affiliateLink || 
            `https://www.amazon.com/s?k=${encodeURIComponent(cleanTitle)}&tag=smartrecs-20`;
          
          html += `
            <div style="margin-bottom: ${index < recommendations.length - 1 ? '15px' : '0'}; padding: 10px; ${index < recommendations.length - 1 ? 'border-bottom: 1px solid #eee;' : ''}; background-color: ${isEven ? '#f5f5f5' : '#ffffff'}; border-radius: 4px;">
              <div style="font-size: 11px; color: #0066c0; margin-bottom: 5px; text-transform: uppercase; font-weight: bold;">
                ${item.type || categoryLabels[index] || "Recommended Alternative"}
              </div>
              <div style="margin-bottom: 8px;">
                <div style="font-weight: bold; color: #0066c0; font-size: 15px;">
                  ${cleanTitle}
                </div>
                <div style="color: #B12704; font-size: 14px; margin-top: 4px;">
                  ${item.price ? '$' + item.price : ''}
                </div>
                ${item.rating ? `
                <div style="color: #007600; font-size: 12px; margin-top: 4px;">
                  ${item.rating} stars (${item.reviewCount || 'No reviews yet'})
                </div>` : ''}
              </div>
              <div style="color: #333; font-size: 13px; margin-left: 5px;">
                <ul style="margin: 5px 0 0 15px; padding: 0; list-style-type: square;">
                  <li style="margin-bottom: 4px;">${item.reason || 'Recommended alternative'}</li>
                </ul>
              </div>
              <div style="margin-top: 10px; text-align: right;">
                <a href="${affiliateLink}" target="_blank" style="display: inline-block; background-color: #FF9900; color: #fff; padding: 5px 10px; border-radius: 3px; text-decoration: none; font-size: 12px; font-weight: bold;">
                  Find on Amazon
                </a>
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
          <p style="margin: 0;">${isRealData ? '✨ Real recommendations from Perplexity AI' : isMockData ? '⚠️ Using simulated recommendations' : 'No recommendations available'}</p>
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
      const productData = extractProductDetails();
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
      fetchRecommendations(productData)
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