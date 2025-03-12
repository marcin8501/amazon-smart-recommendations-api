// Amazon Smart Recommendations - Popup Script
// Handles the extension popup UI and settings management

document.addEventListener('DOMContentLoaded', function() {
  // DOM elements
  const apiKeyInput = document.getElementById('apiKey');
  const maxRecommendationsSelect = document.getElementById('maxRecommendations');
  const prioritySelect = document.getElementById('priority');
  const autoShowCheckbox = document.getElementById('autoShow');
  const themeSelect = document.getElementById('theme');
  const clearCacheButton = document.getElementById('clearCache');
  const saveSettingsButton = document.getElementById('saveSettings');
  const statusElement = document.getElementById('status');
  
  // Load current settings when popup opens
  loadSettings();
  
  // Add event listeners for buttons
  saveSettingsButton.addEventListener('click', saveSettings);
  clearCacheButton.addEventListener('click', clearCache);
  
  // Load settings from storage
  function loadSettings() {
    chrome.runtime.sendMessage({ action: 'getSettings' }, function(response) {
      if (response && response.success) {
        const settings = response.settings;
        
        // Update UI with current settings
        apiKeyInput.value = settings.apiKey || '';
        maxRecommendationsSelect.value = settings.maxRecommendations || '3';
        prioritySelect.value = settings.priority || 'price';
        autoShowCheckbox.checked = settings.autoShow !== false; // Default to true if undefined
        themeSelect.value = settings.theme || 'light';
        
        console.log('Settings loaded:', settings);
      } else {
        showStatus('Could not load settings', false);
      }
    });
  }
  
  // Save settings to storage
  function saveSettings() {
    // Collect settings from form
    const settings = {
      apiKey: apiKeyInput.value.trim(),
      maxRecommendations: parseInt(maxRecommendationsSelect.value, 10),
      priority: prioritySelect.value,
      autoShow: autoShowCheckbox.checked,
      theme: themeSelect.value
    };
    
    // Send to background script to save
    chrome.runtime.sendMessage({ 
      action: 'saveSettings',
      settings: settings
    }, function(response) {
      if (response && response.success) {
        showStatus('Settings saved successfully!', true);
        console.log('Settings saved:', settings);
      } else {
        showStatus('Error saving settings', false);
      }
    });
  }
  
  // Clear recommendations cache
  function clearCache() {
    chrome.runtime.sendMessage({ action: 'clearCache' }, function(response) {
      if (response && response.success) {
        showStatus('Cache cleared successfully!', true);
      } else {
        showStatus('Error clearing cache', false);
      }
    });
  }
  
  // Show status message with optional success state
  function showStatus(message, isSuccess) {
    statusElement.textContent = message;
    statusElement.className = 'status ' + (isSuccess ? 'success' : 'error');
    
    // Clear status after 3 seconds
    setTimeout(function() {
      statusElement.textContent = '';
      statusElement.className = 'status';
    }, 3000);
  }
}); 