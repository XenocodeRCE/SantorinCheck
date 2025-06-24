class SantorinAnnotator {
  constructor() {
    this.startButton = document.getElementById('startAnnotation');
    this.statusDiv = document.getElementById('status');
    this.analyzeButton = document.getElementById('analyzeButton');
    this.statsDiv = document.getElementById('stats');
    this.startButton.addEventListener('click', () => this.run());
    this.analyzeButton.addEventListener('click', () => this.analyzeEstablishments());
    this.copiesData = []; // Stockage des métadonnées des copies
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
  }  async annotateAllPagesLu(authValue) {
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

  async analyzeEstablishments() {
    this.analyzeButton.disabled = true;
    this.setStatus('Chargement des données...');

    try {
      // Charger les données sauvegardées
      const result = await chrome.storage.local.get('copiesData');
      const copiesData = result.copiesData || [];

      if (copiesData.length === 0) {
        this.setStatus('Aucune donnée trouvée. Annotez d\'abord quelques copies.', true);
        return;
      }

      // Analyser les établissements
      const stats = this.calculateEstablishmentStats(copiesData);
      this.displayStats(stats);
      this.setStatus(`Analyse terminée pour ${copiesData.length} copies.`);

    } catch (error) {
      this.setStatus(`Erreur : ${error.message}`, true);
    } finally {
      this.analyzeButton.disabled = false;
    }
  }

  calculateEstablishmentStats(copiesData) {
    const establishments = new Map();
    const zones = new Map();
    const divisions = new Map();
    const salles = new Map();
    const juries = new Map();

    copiesData.forEach(copy => {
      // Créer une signature d'établissement
      const establishmentKey = `${copy.codeZG}_${copy.etablissementCode}_${copy.centreEpreuve}`;
      
      if (!establishments.has(establishmentKey)) {
        establishments.set(establishmentKey, {
          codeZG: copy.codeZG,
          etablissementCode: copy.etablissementCode,
          etablissementLibelle: copy.etablissementLibelle,
          centreEpreuve: copy.centreEpreuve,
          copies: [],
          divisions: new Set(),
          salles: new Set(),
          juries: new Set()
        });
      }

      const establishment = establishments.get(establishmentKey);
      establishment.copies.push(copy);
      establishment.divisions.add(copy.codeDivisionClasse);
      establishment.salles.add(copy.nomSalle);
      establishment.juries.add(copy.numeroJury);

      // Compter par zone géographique
      zones.set(copy.codeZG, (zones.get(copy.codeZG) || 0) + 1);
      
      // Compter par division
      divisions.set(copy.codeDivisionClasse, (divisions.get(copy.codeDivisionClasse) || 0) + 1);
      
      // Compter par salle
      salles.set(copy.nomSalle, (salles.get(copy.nomSalle) || 0) + 1);
      
      // Compter par jury
      juries.set(copy.numeroJury, (juries.get(copy.numeroJury) || 0) + 1);
    });

    return {
      totalCopies: copiesData.length,
      establishments: Array.from(establishments.values()),
      zones: Array.from(zones.entries()).sort((a, b) => b[1] - a[1]),
      divisions: Array.from(divisions.entries()).sort((a, b) => b[1] - a[1]),
      salles: Array.from(salles.entries()).sort((a, b) => b[1] - a[1]),
      juries: Array.from(juries.entries()).sort((a, b) => b[1] - a[1])
    };
  }

  displayStats(stats) {
    const html = `
      <div class="stats-container">
        <h3>📊 Analyse du lot de correction</h3>
        
        <div class="stat-section">
          <h4>📋 Résumé général</h4>
          <p><strong>Total des copies analysées :</strong> ${stats.totalCopies}</p>
          <p><strong>Nombre d'établissements différents :</strong> ${stats.establishments.length}</p>
          <p><strong>Zones géographiques :</strong> ${stats.zones.length}</p>
          <p><strong>Divisions/classes :</strong> ${stats.divisions.length}</p>
        </div>

        <div class="stat-section">
          <h4>🏫 Établissements représentés</h4>
          ${stats.establishments.map(etab => `
            <div class="establishment-item">
              <strong>${etab.etablissementLibelle || 'Établissement inconnu'}</strong>
              <br>
              <small>Zone: ${etab.codeZG} | Centre: ${etab.centreEpreuve}</small>
              <br>
              <span class="badge">${etab.copies.length} copies</span>
              <span class="badge">${etab.divisions.size} divisions</span>
              <span class="badge">${etab.salles.size} salles</span>
            </div>
          `).join('')}
        </div>

        <div class="stat-section">
          <h4>🗺️ Répartition par zone géographique</h4>
          ${stats.zones.map(([zone, count]) => `
            <div class="zone-item">
              <span>Zone ${zone}</span>
              <span class="count">${count} copies</span>
            </div>
          `).join('')}
        </div>

        <div class="stat-section">
          <h4>🎓 Répartition par division/classe</h4>
          ${stats.divisions.map(([division, count]) => `
            <div class="division-item">
              <span>${division}</span>
              <span class="count">${count} copies</span>
            </div>
          `).join('')}
        </div>

        <div class="buttons-container">
          <button id="clearData" class="clear-button">🗑️ Effacer les données</button>
          <button id="exportData" class="export-button">📄 Exporter les données</button>
        </div>
      </div>
    `;

    this.statsDiv.innerHTML = html;

    // Ajouter les gestionnaires d'événements
    document.getElementById('clearData')?.addEventListener('click', () => this.clearData());
    document.getElementById('exportData')?.addEventListener('click', () => this.exportData(stats));
  }

  async clearData() {
    if (confirm('Êtes-vous sûr de vouloir effacer toutes les données collectées ?')) {
      await chrome.storage.local.remove('copiesData');
      this.copiesData = [];
      this.statsDiv.innerHTML = '<p>Données effacées.</p>';
      this.setStatus('Données effacées.');
    }
  }

  exportData(stats) {
    const dataToExport = {
      dateExport: new Date().toLocaleString('fr-FR'),
      statistiques: stats,
      detailsCopies: this.copiesData
    };

    const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `santorin-analyse-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    this.setStatus('Données exportées.');
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  const annotator = new SantorinAnnotator();
  
  // Charger les données existantes au démarrage
  const result = await chrome.storage.local.get('copiesData');
  annotator.copiesData = result.copiesData || [];
  
  if (annotator.copiesData.length > 0) {
    annotator.setStatus(`${annotator.copiesData.length} copies en mémoire. Prêt à analyser.`);
  }
});