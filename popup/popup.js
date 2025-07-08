// Popup script for Google Meet Extension
document.addEventListener('DOMContentLoaded', function() {
    const actionBtn = document.getElementById('actionBtn');
    
    actionBtn.addEventListener('click', function() {
        // Send message to content script
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            chrome.tabs.sendMessage(tabs[0].id, {action: 'getPageInfo'}, function(response) {
                if (response) {
                    console.log('Page info:', response);
                }
            });
        });
    });
    
    // Initialize popup
    console.log('Popup initialized');
});