// Amazon Smart Recommendations Extension - Background Script v2.0.0
// Simplified version with minimal functionality

console.log('Amazon Smart Recommendations Extension - Background Script v2.0.0 Starting');

// Initialize extension when installed
chrome.runtime.onInstalled.addListener(() => {
  console.log('Extension installed');
});

// Listen for messages from the content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Received message:', message);
  
  // If the message is just a notification, acknowledge it
  if (message.action === 'NOTIFICATION') {
    console.log('Notification received:', message.data);
    sendResponse({ status: 'acknowledged' });
    return;
  }
  
  // Handle any future message types here
  
  // Send a response to prevent connection error
  sendResponse({ status: 'received' });
});

console.log('Amazon Smart Recommendations Extension - Background Script v2.0.0 Ready'); 