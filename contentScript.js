// Amazon Smart Recommendations Extension
// Content Script v2.0.1
// This minimal version directly injects our standalone panel script without inline script

console.log('Amazon Smart Recommendations Extension - Content Script v2.0.1 Starting');

// Check if we're on an Amazon domain
if (window.location.hostname.includes('amazon')) {
  console.log('Amazon domain detected, injecting panel script');
  
  try {
    // Create a new script element directly for amazonPanel.js
    const scriptElement = document.createElement('script');
    
    // Set its source to the amazonPanel.js file
    scriptElement.src = chrome.runtime.getURL('amazonPanel.js');
    
    // Add it to the document head
    (document.head || document.documentElement).appendChild(scriptElement);
    
    // Remove the script element after it loads (optional)
    scriptElement.onload = function() {
      scriptElement.remove();
    };
    
    console.log('Panel script injection successful');
  } catch (e) {
    console.error('Error injecting panel script:', e);
  }
} else {
  console.log('Not an Amazon domain, extension not active');
}

console.log('Amazon Smart Recommendations Extension - Content Script v2.0.1 Complete');
