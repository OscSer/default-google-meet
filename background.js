// Background script for Google Meet Extension
chrome.runtime.onInstalled.addListener(() => {
  console.log('Google Meet Extension installed');
});

// Handle messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getData') {
    // Handle data requests
    sendResponse({success: true});
  }
});