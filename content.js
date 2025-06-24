(function() {
  'use strict';

  // Configuration spécifique Edge
  const EDGE_CONFIG = {
    indicatorDelay: 3000,
    checkInterval: 1000,
    maxRetries: 5
  };

  function addExtensionIndicator() {
    if (document.getElementById('santorin-extension-indicator')) return;
    
    const indicator = document.createElement('div');
    indicator.id = 'santorin-extension-indicator';
    indicator.innerHTML = '🤖 SANTORIN Auto-Annotateur (Edge)';
    indicator.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      background: linear-gradient(135deg, #000091, #0066cc);
      color: white;
      padding: 8px 15px;
      border-radius: 20px;
      font-size: 12px;
      z-index: 999999999;
      font-family: 'Segoe UI', Arial, sans-serif;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      border: 1px solid rgba(255,255,255,0.2);
      backdrop-filter: blur(10px);
      transition: all 0.3s ease;
    `;
    
    document.body.appendChild(indicator);
    
    // Animation d'entrée
    setTimeout(() => {
      indicator.style.transform = 'translateY(-5px)';
    }, 100);
    
    // Masquer après délai
    setTimeout(() => {
      indicator.style.opacity = '0';
      indicator.style.transform = 'translateY(-20px)';
      setTimeout(() => indicator.remove(), 300);
    }, EDGE_CONFIG.indicatorDelay);
  }

  function checkSantorinPage() {
    const santorinElements = [
      '[_nghost-ng-c566120931]',
      'app-correction-copie',
      'app-editeur-canvas'
    ];
    
    return santorinElements.some(selector => document.querySelector(selector));
  }
  function initializeExtension() {
    if (checkSantorinPage()) {
      addExtensionIndicator();
      
      // Améliorer la compatibilité des sélecteurs
      if (!HTMLElement.prototype.contains) {
        HTMLElement.prototype.contains = function(text) {
          return this.textContent && this.textContent.includes(text);
        };
      }

      // Ajouter des métadonnées pour l'extension
      const meta = document.createElement('meta');
      meta.name = 'santorin-extension-active';
      meta.content = 'true';
      document.head.appendChild(meta);
      
      // Collecter automatiquement les métadonnées si on est sur une page de copie
      if (window.location.pathname.includes('/lots/') && window.location.pathname.split('/').length >= 5) {
        setTimeout(() => {
          collectCopyMetadata();
        }, 2000); // Attendre que la page soit complètement chargée
      }
      
      console.log('SANTORIN Auto-Annotateur: Extension initialisée pour Edge');
    }
  }

  // Initialisation avec retry pour Edge
  let retryCount = 0;
  function tryInitialize() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initializeExtension);
    } else if (checkSantorinPage()) {
      initializeExtension();
    } else if (retryCount < EDGE_CONFIG.maxRetries) {
      retryCount++;
      setTimeout(tryInitialize, EDGE_CONFIG.checkInterval);
    }
  }

  tryInitialize();
  // Observer pour les changements de page SPA
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.addedNodes.length > 0) {
        const hasCanvas = Array.from(mutation.addedNodes).some(node => 
          node.nodeType === 1 && node.querySelector && node.querySelector('app-editeur-canvas')
        );
        
        if (hasCanvas && !document.getElementById('santorin-extension-indicator')) {
          setTimeout(addExtensionIndicator, 500);
          
          // Collecter les métadonnées si on détecte une nouvelle page de copie
          if (window.location.pathname.includes('/lots/') && window.location.pathname.split('/').length >= 5) {
            setTimeout(() => {
              collectCopyMetadata();
            }, 1500);
          }
        }
      }
    });
  });

  if (checkSantorinPage()) {
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  // Observer les changements d'URL pour les SPA
  let currentUrl = window.location.href;
  const urlObserver = new MutationObserver(() => {
    if (window.location.href !== currentUrl) {
      currentUrl = window.location.href;
      console.log('[SantorinCheck] Changement d\'URL détecté:', currentUrl);
      
      // Si on arrive sur une nouvelle page de copie, collecter les métadonnées
      if (window.location.pathname.includes('/lots/') && window.location.pathname.split('/').length >= 5) {
        setTimeout(() => {
          collectCopyMetadata();
        }, 2000);
      }
    }
  });

  urlObserver.observe(document.body, {
    childList: true,
    subtree: true
  });

  async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async function addClickMarker(x, y) {
    const marker = document.createElement('div');
    marker.style.position = 'fixed';
    marker.style.left = `${x - 10}px`;
    marker.style.top = `${y - 10}px`;
    marker.style.width = '20px';
    marker.style.height = '20px';
    marker.style.border = '2px solid red';
    marker.style.borderRadius = '50%';
    marker.style.zIndex = 99999;
    marker.style.pointerEvents = 'none';
    marker.style.background = 'rgba(255,0,0,0.2)';
    document.body.appendChild(marker);
    setTimeout(() => marker.remove(), 1200);
  }

  async function main() {
    console.log('[SantorinCheck] Début annotation page actuelle');

    // 1. Trouver la zone du canvas
    const rel = document.querySelector('.relative.d-inline-block');
    if (!rel) {
        console.error('[SantorinCheck] Zone .relative.d-inline-block non trouvée');
        return;
    }
    console.log('[SantorinCheck] Zone .relative.d-inline-block trouvée', rel);

    const canvas = rel.querySelector('canvas');
    if (!canvas) {
        console.error('[SantorinCheck] Canvas non trouvé dans la zone');
        return;
    }
    console.log('[SantorinCheck] Canvas trouvé', canvas);

    // 2. Cliquer dans le canvas pour faire apparaître le textarea
    const canvasRect = canvas.getBoundingClientRect();
    const x = canvasRect.left + canvasRect.width * 0.5;
    const y = canvasRect.top + canvasRect.height * 0.5;
    console.log('[SantorinCheck] Clic sur le canvas aux coordonnées', x, y);
    await addClickMarker(x, y);
    canvas.dispatchEvent(new MouseEvent('mousedown', {bubbles: true, clientX: x, clientY: y}));
    canvas.dispatchEvent(new MouseEvent('mouseup', {bubbles: true, clientX: x, clientY: y}));
    canvas.dispatchEvent(new MouseEvent('click', {bubbles: true, clientX: x, clientY: y}));
    await sleep(400);

    // 3. Attendre et trouver le textarea qui apparaît sur la copie
    let textarea;
    for (let i = 0; i < 10; i++) {
        textarea = Array.from(rel.querySelectorAll('textarea')).find(t => t.offsetParent !== null && !t.hasAttribute('hidden'));
        if (textarea) break;
        await sleep(200);
    }
    if (!textarea) {
        console.error('[SantorinCheck] Textarea overlay non trouvé après clic sur le canvas');
        return;
    }
    console.log('[SantorinCheck] Textarea overlay trouvé', textarea);

    // 4. Écrire "lu" dans ce textarea
    textarea.focus();
    textarea.value = 'lu';
    textarea.dispatchEvent(new Event('input', {bubbles: true}));
    textarea.dispatchEvent(new Event('change', {bubbles: true}));
    console.log('[SantorinCheck] "lu" écrit dans le textarea');
    await sleep(200);

    // 5. Cliquer ailleurs sur le canvas pour valider
    const exitX = x + 100;
    const exitY = y + 50;
    await addClickMarker(exitX, exitY);
    console.log('[SantorinCheck] Clic de validation sur le canvas aux coordonnées', exitX, exitY);
    canvas.dispatchEvent(new MouseEvent('click', {bubbles: true, clientX: exitX, clientY: exitY}));
    await sleep(400);

    console.log('[SantorinCheck] Annotation page actuelle réussie');
}

main();

/**
 * Nettoie un objet pour ne garder que les propriétés sérialisables (pas d'objets DOM, pas de fonctions).
 */
function cleanForPostMessage(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    if (obj instanceof Node || obj instanceof Window || typeof obj === 'function') return undefined;
    if (Array.isArray(obj)) return obj.map(cleanForPostMessage);
    const result = {};
    for (const key in obj) {
        const value = obj[key];
        if (value instanceof Node || value instanceof Window || typeof value === 'function') continue;
        result[key] = cleanForPostMessage(value);
    }
    return result;
}

// Exemple d'utilisation dans l'annotation :
function annotatePage(config) {
    // ...existing code...
    const safeConfig = cleanForPostMessage(config);
    window.postMessage({
        action: 'annotate',
        config: safeConfig
    }, '*');
    // ...existing code...
}

async function collectCopyMetadata() {
    try {
      console.log('[SantorinCheck] Collecte automatique des métadonnées...');
      
      // Récupérer l'ID de la copie depuis l'URL
      const copyId = window.location.pathname.split('/').pop();
      
      if (!copyId) {
        console.log('[SantorinCheck] ID de copie non trouvé dans l\'URL');
        return;
      }

      // Faire l'appel API pour récupérer les métadonnées
      const response = await fetch(window.location.origin + '/th/epreuveCandidat/' + copyId + '/epcCorrection', {
        method: 'GET',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        console.log('[SantorinCheck] Erreur lors de l\'appel API:', response.status);
        return;
      }

      const data = await response.json();
      
      const copyMetadata = {
        id: data.id,
        codeZG: data.codeZG,
        codeDivisionClasse: data.codeDivisionClasse,
        nomSalle: data.nomSalle,
        numeroJury: data.numeroJury,
        libelleAnonymat: data.libelleAnonymat,
        etablissementCode: data.etablissementInscription?.code || 'Inconnu',
        etablissementLibelle: data.etablissementInscription?.libelle || 'Inconnu',
        centreEpreuve: data.centreEpreuve?.libelle || 'Inconnu',
        qualificationPresentee: data.qualificationPresentee?.libelle || 'Inconnu',
        dateEpreuve: data.dateEpreuveFormatted,
        nombrePages: data.metaData?.nombreDePage || 0,
        note: data.notation?.note || 'Non notée',
        dateCollecte: new Date().toISOString()
      };

      console.log('[SantorinCheck] Métadonnées collectées:', copyMetadata);

      // Envoyer les métadonnées au background script pour sauvegarde
      if (typeof chrome !== 'undefined' && chrome.runtime) {
        chrome.runtime.sendMessage({
          action: 'saveCopyMetadata',
          metadata: copyMetadata
        });
      }

      // Afficher une notification discrète
      showMetadataNotification(copyMetadata);

    } catch (error) {
      console.error('[SantorinCheck] Erreur lors de la collecte des métadonnées:', error);
    }
  }

  function showMetadataNotification(metadata) {
    // Créer une notification discrète
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 60px;
      right: 10px;
      background: linear-gradient(135deg, #28a745, #20c997);
      color: white;
      padding: 8px 12px;
      border-radius: 15px;
      font-size: 11px;
      z-index: 999999998;
      font-family: 'Segoe UI', Arial, sans-serif;
      box-shadow: 0 3px 10px rgba(0,0,0,0.2);
      max-width: 250px;
      word-wrap: break-word;
      opacity: 0;
      transform: translateX(100%);
      transition: all 0.3s ease;
    `;
    
    notification.innerHTML = `
      📊 Métadonnées collectées<br>
      <small>Zone: ${metadata.codeZG} | ${metadata.libelleAnonymat}</small>
    `;
    
    document.body.appendChild(notification);
    
    // Animation d'entrée
    setTimeout(() => {
      notification.style.opacity = '1';
      notification.style.transform = 'translateX(0)';
    }, 100);
    
    // Masquer après quelques secondes
    setTimeout(() => {
      notification.style.opacity = '0';
      notification.style.transform = 'translateX(100%)';
      setTimeout(() => notification.remove(), 300);
    }, 4000);
  }
})();