class SantorinAnnotator {
  constructor() {
    this.startButton = document.getElementById('startAnnotation');
    this.statusDiv = document.getElementById('status');
    this.startButton.addEventListener('click', () => this.run());
  }

  async run() {
    this.startButton.disabled = true;
    this.setStatus('Lecture de l\'authentification...');

    try {
      // 1. Récupérer et sauvegarder l'authentification
      const authValue = await this.getSessionAuth();
      if (!authValue) {
        this.setStatus('Authentification non trouvée.', true);
        return;
      }
      this.setStatus('Authentification lue.');

      // 2. Lancer l'annotation
      await this.annotateAllPagesLu(authValue);

    } catch (error) {
      this.setStatus(`Erreur : ${error.message}`, true);
    } finally {
      this.startButton.disabled = false;
    }
  }

  setStatus(message, isError = false) {
    this.statusDiv.textContent = message;
    this.statusDiv.style.color = isError ? 'red' : 'black';
  }

  async getSessionAuth() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => sessionStorage.getItem('authentification'),
    });
    const value = results[0]?.result;
    if (value) {
      await chrome.storage.local.set({ authentification: value });
    }
    return value;
  }

  async annotateAllPagesLu(authValue) {
    this.setStatus('Annotation en cours...');
    const user = JSON.parse(authValue).user;
    const { nomPrenom, userId } = user;

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // Récupérer XSRF-TOKEN
    const xsrfTokenResult = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => document.cookie.split('; ').find(r => r.startsWith('XSRF-TOKEN='))?.split('=')[1] || null,
    });
    const xsrfToken = xsrfTokenResult[0]?.result;
    if (!xsrfToken) throw new Error('XSRF-TOKEN introuvable.');

    // Récupérer les pageIds
    const pageIdsResult = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => Array.from(document.querySelectorAll('app-editeur-canvas[id^="canvas"]')).map(el => el.id.replace(/^canvas/, '')),
    });
    const pageIds = pageIdsResult[0]?.result?.filter(Boolean);
    if (!pageIds || pageIds.length === 0) throw new Error('Aucune page à annoter.');

    // Annoter chaque page
    let count = 0;
    for (const pageId of pageIds) {
      const timeStamp = Date.now();
      const annotation = { type: "text", tint: "red", opacity: 1, fontSize: 20, rotation: 0, position: { type: "point", tint: "red", opacity: 1, x: 59.6, y: 411.0, radius: 0 }, width: 15.0, height: 38.7, text: "lu" };
      const bodyString = `{"change":{"pageId":"${pageId}","userId":"${userId}","timeStamp":${timeStamp},"nomPrenom":"${nomPrenom}","annotation":${JSON.stringify(annotation)}}}`;

      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (body, token) => {
          fetch(window.location.origin + '/th/epc/' + window.location.pathname.split('/').pop() + '/annotationChangelog', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json', 'x-xsrf-token': token, 'xsrf-token': token },
            body: body,
          });
        },
        args: [bodyString, xsrfToken],
      });
      count++;
      this.setStatus(`Annotation: ${count}/${pageIds.length}...`);
      await new Promise(r => setTimeout(r, 200)); // Pause
    }
    this.setStatus(`Annotation terminée pour ${count} pages !`);
  }
}

document.addEventListener('DOMContentLoaded', () => new SantorinAnnotator());