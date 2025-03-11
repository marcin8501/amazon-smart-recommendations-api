// Amazon Smart Recommendations Panel
// Standalone version 2.0.0
// This version is completely independent and avoids all extension APIs

(function() {
  console.log('Standalone Amazon Panel v2.0.0 - Starting');

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
    if (!price) return 'Price not available';
    return `$${parseFloat(price).toFixed(2)}`;
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
  
  // Generate mockup recommendations based on the current product
  function generateRecommendations(productData) {
    try {
      if (!productData || !productData.title) return [];
      
      return [
        {
          title: `Better Value Alternative - ${productData.title.substring(0, 30)}...`,
          reason: '15% cheaper with similar features',
          price: productData.price ? productData.price * 0.85 : 29.99
        },
        {
          title: `Premium Option - ${productData.brand || 'Brand'} Deluxe`,
          reason: 'Higher rated with better quality',
          price: productData.price ? productData.price * 1.15 : 39.99
        },
        {
          title: `Best Seller in ${productData.brand || 'this'} Category`,
          reason: 'Most popular among Amazon customers',
          price: productData.price ? productData.price * 1.05 : 34.99
        }
      ];
    } catch (e) {
      console.error('Error generating recommendations:', e);
      return [];
    }
  }
  
  // Create and show the recommendations panel
  function createStandalonePanel() {
    try {
      // Check if panel already exists
      if (document.getElementById('amazon-standalone-panel')) {
        console.log('Panel already exists');
        return;
      }
      
      console.log('Creating standalone panel...');
      
      // Extract product data
      const productData = extractProductData();
      
      // Create panel container
      const panel = document.createElement('div');
      panel.id = 'amazon-standalone-panel';
      
      // Style the panel
      panel.style.position = 'fixed';
      panel.style.top = '80px';
      panel.style.right = '0';
      panel.style.width = '320px';
      panel.style.maxHeight = '80vh';
      panel.style.backgroundColor = '#1c3146';
      panel.style.color = 'white';
      panel.style.fontFamily = 'Arial, sans-serif';
      panel.style.zIndex = '2147483647';
      panel.style.boxShadow = '0 0 10px rgba(0,0,0,0.5)';
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
      title.textContent = 'Amazon Recommendations';
      title.style.margin = '0';
      title.style.fontSize = '18px';
      title.style.color = 'white';
      
      const closeButton = document.createElement('button');
      closeButton.textContent = 'X';
      closeButton.style.background = 'transparent';
      closeButton.style.border = 'none';
      closeButton.style.color = 'white';
      closeButton.style.fontSize = '16px';
      closeButton.style.cursor = 'pointer';
      closeButton.onclick = function() {
        panel.style.display = 'none';
        toggleButton.style.right = '0';
      };
      
      header.appendChild(title);
      header.appendChild(closeButton);
      
      // Create content area
      const content = document.createElement('div');
      content.style.flex = '1';
      content.style.backgroundColor = 'white';
      content.style.padding = '15px';
      content.style.borderRadius = '4px';
      content.style.color = 'black';
      content.style.overflowY = 'auto';
      
      // Populate content
      if (productData && productData.title) {
        // Show product info
        let html = `
          <div style="margin-bottom: 15px;">
            <h3 style="margin: 0 0 8px 0; font-size: 16px; color: #0066c0;">${productData.title}</h3>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
              <span style="font-size: 18px; color: #B12704; font-weight: bold;">${formatPrice(productData.price)}</span>
        `;
        
        // Add rating if available
        if (productData.rating) {
          html += `<div style="color: #FFA41C; font-size: 14px;">`;
          
          // Add stars based on rating
          const fullStars = Math.floor(productData.rating);
          const hasHalfStar = productData.rating % 1 >= 0.5;
          
          for (let i = 0; i < fullStars; i++) {
            html += '★';
          }
          
          if (hasHalfStar) {
            html += '★';
          }
          
          for (let i = 0; i < (5 - fullStars - (hasHalfStar ? 1 : 0)); i++) {
            html += '☆';
          }
          
          html += ` (${productData.reviewCount?.toLocaleString() || '0'})</div>`;
        }
        
        html += `</div>`;
        
        // Add ASIN and brand info if available
        if (productData.asin || productData.brand) {
          html += `<div style="font-size: 13px; color: #565959; margin-bottom: 15px;">`;
          if (productData.brand) {
            html += `<div>Brand: ${productData.brand}</div>`;
          }
          if (productData.asin) {
            html += `<div>ASIN: ${productData.asin}</div>`;
          }
          html += `</div>`;
        }
        
        // Add recommendations
        html += `
          <div style="margin: 15px 0; padding: 10px; background-color: #f8f8f8; border-radius: 4px;">
            <h4 style="margin: 0 0 10px 0; font-size: 14px; color: #333;">Recommended Alternatives:</h4>
            <div id="recommendations-list">
        `;
        
        // Add mockup recommendations
        const recommendations = generateRecommendations(productData);
        
        recommendations.forEach((item, index) => {
          html += `
            <div style="margin-bottom: ${index < recommendations.length - 1 ? '12px' : '0'}; padding-bottom: 8px; ${index < recommendations.length - 1 ? 'border-bottom: 1px solid #ddd;' : ''}">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 3px;">
                <div style="font-weight: bold; color: #0066c0;">${item.title}</div>
                <div style="font-weight: bold; color: #B12704;">${formatPrice(item.price)}</div>
              </div>
              <div style="color: #067D62; font-size: 12px; font-style: italic;">${item.reason}</div>
            </div>
          `;
        });
        
        html += `
            </div>
          </div>
          <div style="font-size: 11px; color: #565959; text-align: center; margin-top: 15px;">
            Powered by Amazon Smart Recommendations v2.0
          </div>
        `;
        
        content.innerHTML = html;
      } else {
        // Show error message if product data couldn't be extracted
        content.innerHTML = `
          <p style="color: #C40000;">Sorry, we couldn't extract product information from this page.</p>
          <p>This might not be a product page, or the product data might be in an unexpected format.</p>
        `;
      }
      
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
      
      // Assemble panel
      panel.appendChild(header);
      panel.appendChild(content);
      
      // Add to document
      document.body.appendChild(panel);
      document.body.appendChild(toggleButton);
      
      console.log('Standalone Amazon panel created successfully');
    } catch (e) {
      console.error('Error creating panel:', e);
    }
  }
  
  // Main initialization function
  function initialize() {
    try {
      console.log('Initializing standalone Amazon panel...');
      
      // Only run on product pages
      if (isProductPage()) {
        console.log('Amazon product page detected, creating panel');
        createStandalonePanel();
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
  
  console.log('Standalone Amazon Panel v2.0.0 - Setup complete');
})();
