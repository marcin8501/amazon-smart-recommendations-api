// Amazon Smart Recommendations Extension - Panel Script v3.0.0
// This script manages the Amazon Recommendations panel UI

console.log('Amazon Smart Recommendations Panel Script loaded');

// Store product data
let currentProductData = null;

// Listen for messages from the content script
window.addEventListener('message', function(event) {
  // Only accept messages from our window
  if (event.source !== window) return;
  
  // Check if it's a message from our content script
  if (event.data.type && event.data.type === 'FROM_CONTENT_SCRIPT') {
    console.log('Panel received message from content script:', event.data.action);
    
    // Handle initialization
    if (event.data.action === 'init') {
      currentProductData = event.data.productData;
      console.log('Panel initialized with product data:', currentProductData);
    }
    
    // Handle recommendations result
    if (event.data.action === 'recommendationsResult') {
      updatePanelContent(event.data.data);
    }
    
    // Handle API connection test result
    if (event.data.action === 'apiConnectionResult') {
      // This is handled by the content script directly
      console.log('API connection test result:', event.data.data);
    }
    
    // Handle the request to show recommendations
    if (event.data.action === 'showRecommendations') {
      const panelElement = document.getElementById('amazon-smart-recommendations');
      if (panelElement) {
        // Reset the panel content
        const content = panelElement.querySelector('.panel-content');
        content.innerHTML = `
          <div class="loading" style="text-align: center; padding: 20px;">
            <p>Loading recommendations...</p>
          </div>
        `;
        
        // Request recommendations
        getRecommendations(currentProductData || event.data.productData);
      }
    }
  }
});

// Function to get recommendations
function getRecommendations(productData) {
  console.log('Panel requesting recommendations for:', productData);
  
  // Send message to content script to get recommendations
  window.postMessage({
    type: 'FROM_AMAZON_PANEL',
    action: 'getRecommendations',
    productData: productData
  }, '*');
}

// Function to test API connection
function testAPIConnection() {
  console.log('Panel testing API connection');
  
  // Send message to content script to test API connection
  window.postMessage({
    type: 'FROM_AMAZON_PANEL',
    action: 'testAPIConnection'
  }, '*');
}

// Update the panel content with recommendations
function updatePanelContent(data) {
  console.log('Updating panel content with data:', data);
  
  // Get the panel content element
  const panelElement = document.getElementById('amazon-smart-recommendations');
  if (!panelElement) return;
  
  const content = panelElement.querySelector('.panel-content');
  if (!content) return;
  
  // Check if there's an error or no recommendations
  if (!data.success || !data.data || !data.data.recommendations || data.data.recommendations.length === 0) {
    // Create error message
    const errorMessage = data.error || 'Unable to load recommendations. Please try again later.';
    
    content.innerHTML = `
      <div class="error" style="padding: 15px; color: #721c24; background-color: #f8d7da; border: 1px solid #f5c6cb; border-radius: 5px; margin-bottom: 15px;">
        <p style="margin: 0;"><strong>Error:</strong> ${errorMessage}</p>
        <button id="retry-btn" style="margin-top: 10px; padding: 5px 10px; background-color: #f8d7da; border: 1px solid #f5c6cb; border-radius: 3px; cursor: pointer;">Retry</button>
      </div>
      <div class="mock-data-warning" style="padding: 15px; color: #856404; background-color: #fff3cd; border: 1px solid #ffeeba; border-radius: 5px;">
        <p style="margin: 0;"><strong>Note:</strong> Showing simulated product alternatives.</p>
        <p style="margin: 5px 0 0 0; font-size: 0.9em;">These are not real Amazon recommendations.</p>
      </div>
    `;
    
    // Add event listener for retry button
    document.getElementById('retry-btn').addEventListener('click', () => {
      content.innerHTML = `
        <div class="loading" style="text-align: center; padding: 20px;">
          <p>Loading recommendations...</p>
        </div>
      `;
      getRecommendations(currentProductData);
    });
    
    return;
  }
  
  // Extract recommendations from the response
  const recommendations = data.data.recommendations;
  const usingMockData = data.data.usingMockData || data.mock || false;
  
  // Clear the content
  content.innerHTML = '';
  
  // Add a connection banner if using mock data
  if (usingMockData) {
    const mockBanner = document.createElement('div');
    mockBanner.className = 'mock-banner';
    mockBanner.style.padding = '10px 15px';
    mockBanner.style.backgroundColor = '#fff3cd';
    mockBanner.style.color = '#856404';
    mockBanner.style.borderRadius = '5px';
    mockBanner.style.marginBottom = '15px';
    mockBanner.style.fontSize = '0.9em';
    mockBanner.innerHTML = `
      <p style="margin: 0;"><strong>Note:</strong> Using sample data.</p>
      <p style="margin: 5px 0 0 0; font-size: 0.9em;">Unable to connect to recommendation service.</p>
    `;
    content.appendChild(mockBanner);
  }
  
  // Create recommendations list
  const recommendationsList = document.createElement('div');
  recommendationsList.className = 'recommendations-list';
  
  // Add each recommendation to the list
  recommendations.forEach((rec, index) => {
    const recItem = document.createElement('div');
    recItem.className = 'recommendation-item';
    recItem.style.borderBottom = index < recommendations.length - 1 ? '1px solid #eee' : 'none';
    recItem.style.paddingBottom = '15px';
    recItem.style.marginBottom = '15px';
    
    // Determine the label based on index
    let label = '';
    if (index === 0) label = 'Premium Option';
    else if (index === 1) label = 'Better Value';
    else if (index === 2) label = 'Most Popular';
    else label = `Alternative ${index + 1}`;
    
    // Create recommendation HTML
    recItem.innerHTML = `
      <div style="display: flex; align-items: flex-start;">
        <div class="rec-image" style="width: 80px; margin-right: 15px;">
          <img src="${rec.imageUrl || 'https://via.placeholder.com/80'}" alt="${rec.title}" style="max-width: 100%; border: 1px solid #ddd;">
        </div>
        <div class="rec-details" style="flex: 1;">
          <div class="rec-label" style="font-size: 0.8em; font-weight: bold; color: #e47911; margin-bottom: 5px;">${label}</div>
          <div class="rec-title" style="font-weight: bold; margin-bottom: 5px;">${rec.title}</div>
          <div class="rec-price" style="color: #B12704; margin-bottom: 5px;">$${rec.price}</div>
          <div class="rec-ratings" style="font-size: 0.8em; color: #007185; margin-bottom: 5px;">
            ${rec.rating ? `${rec.rating} stars (${rec.reviewCount || '0 reviews'})` : ''}
          </div>
          <div class="rec-reason" style="font-size: 0.9em; color: #565959;">${rec.reason || ''}</div>
          <a href="#" class="view-button" style="display: inline-block; margin-top: 10px; padding: 5px 10px; background-color: #f0c14b; border: 1px solid #a88734; border-radius: 3px; text-decoration: none; color: #111; font-size: 0.9em;">View Product</a>
        </div>
      </div>
    `;
    
    recommendationsList.appendChild(recItem);
  });
  
  content.appendChild(recommendationsList);
  
  // Add footer with source information
  const footer = document.createElement('div');
  footer.className = 'recommendations-footer';
  footer.style.marginTop = '15px';
  footer.style.paddingTop = '10px';
  footer.style.borderTop = '1px solid #eee';
  footer.style.fontSize = '0.8em';
  footer.style.color = '#565959';
  footer.style.textAlign = 'center';
  
  // Update footer text based on data source
  if (usingMockData) {
    footer.textContent = "Powered by Amazon Smart Recommendations (Sample Data)";
  } else if (data.data.source && data.data.source.includes("API")) {
    footer.textContent = "Powered by Amazon Smart Recommendations API";
  } else if (data.data.usingMockData) {
    footer.textContent = "Using sample data from our API";
  } else {
    footer.textContent = "Powered by Perplexity API";
  }
  
  content.appendChild(footer);
  
  // Add event listeners for view buttons
  const viewButtons = content.querySelectorAll('.view-button');
  viewButtons.forEach((button, index) => {
    button.addEventListener('click', (e) => {
      e.preventDefault();
      // In a real extension, this would navigate to the product page
      alert(`This would navigate to the product: ${recommendations[index].title}`);
    });
  });
}

// Make updatePanelContent available to the window for diagnostics
window.updatePanelContent = updatePanelContent; 