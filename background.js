// Service worker pour Edge
chrome.runtime.onInstalled.addListener(() => {
  console.log('SANTORIN Auto-Annotateur installé pour Edge');
});

// Gestion des mises à jour
chrome.runtime.onStartup.addListener(() => {
  console.log('Extension SANTORIN démarrée');
});

// Communication avec les content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getTabInfo') {
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
      sendResponse({
        url: tabs[0]?.url || '',
        title: tabs[0]?.title || ''
      });
    });
    return true;
  }
});