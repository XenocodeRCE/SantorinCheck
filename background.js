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
  
  if (request.action === 'saveCopyMetadata') {
    // Sauvegarder les métadonnées de la copie
    chrome.storage.local.get('copiesData', (result) => {
      const copiesData = result.copiesData || [];
      
      // Vérifier si cette copie n'est pas déjà enregistrée
      const existingIndex = copiesData.findIndex(copy => copy.id === request.metadata.id);
      
      if (existingIndex !== -1) {
        // Mettre à jour la copie existante
        copiesData[existingIndex] = request.metadata;
        console.log('SANTORIN: Métadonnées mises à jour pour la copie', request.metadata.id);
      } else {
        // Ajouter une nouvelle copie
        copiesData.push(request.metadata);
        console.log('SANTORIN: Nouvelles métadonnées sauvegardées pour la copie', request.metadata.id);
      }
      
      // Sauvegarder les données
      chrome.storage.local.set({ copiesData: copiesData }, () => {
        console.log('SANTORIN: Total des copies en mémoire:', copiesData.length);
        sendResponse({ success: true, totalCopies: copiesData.length });
      });
    });
    return true;
  }
});