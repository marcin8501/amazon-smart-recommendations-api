// Amazon Smart Recommendations Popup Logic v2.0.0

document.addEventListener('DOMContentLoaded', function() {
  // Get UI elements
  const statusElement = document.querySelector('.status');
  
  // Check if we're on an Amazon page
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    if (tabs[0] && tabs[0].url && tabs[0].url.includes('amazon.com')) {
      // Check if it's a product page
      const isProductPage = tabs[0].url.includes('/dp/') || 
                           tabs[0].url.includes('/gp/product/');
      
      if (isProductPage) {
        statusElement.innerHTML = 'You\'re on an Amazon product page!<br>The recommendations panel should be visible on the right side.';
        statusElement.className = 'status active';
      } else {
        statusElement.innerHTML = 'You\'re on Amazon, but not on a product page.<br>Visit a product page to see recommendations.';
        statusElement.className = 'status';
      }
    } else {
      statusElement.innerHTML = 'You\'re not on Amazon right now.<br>Visit any Amazon product page to see recommendations.';
      statusElement.className = 'status';
    }
  });
  
  // Listen for clicks on links
  document.addEventListener('click', function(e) {
    if (e.target.tagName === 'A') {
      // Open links in new tabs
      chrome.tabs.create({url: e.target.href});
      return false;
    }
  });
}); 