// Content script for Google Meet Extension
console.log('Google Meet Extension content script loaded');

// Function to interact with Google Meet page
function initializeExtension() {
  // Add your Google Meet specific functionality here
  console.log('Extension initialized on Google Meet page');
}

// Initialize when page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeExtension);
} else {
  initializeExtension();
}

// Listen for messages from popup or background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getPageInfo') {
    sendResponse({
      url: window.location.href,
      title: document.title
    });
  }
});