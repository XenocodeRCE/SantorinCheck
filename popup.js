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
      establishment.salles.add(copy.nomSalle || 'Non définie');
      establishment.juries.add(copy.numeroJury);

      // Compter par zone géographique
      zones.set(copy.codeZG, (zones.get(copy.codeZG) || 0) + 1);
      
      // Compter par division
      divisions.set(copy.codeDivisionClasse, (divisions.get(copy.codeDivisionClasse) || 0) + 1);
        // Compter par salle (gérer les salles vides/undefined et distinguer par zone)
      const salleName = copy.nomSalle || 'Non définie';
      const salleZoneKey = `${salleName}_${copy.codeZG}`; // Clé unique : salle + zone
      salles.set(salleZoneKey, (salles.get(salleZoneKey) || 0) + 1);
      
      // Compter par jury
      juries.set(copy.numeroJury, (juries.get(copy.numeroJury) || 0) + 1);
    });    return {
      totalCopies: copiesData.length,
      establishments: Array.from(establishments.values()),
      zones: Array.from(zones.entries()).sort((a, b) => b[1] - a[1]),
      divisions: Array.from(divisions.entries()).sort((a, b) => b[1] - a[1]),
      salles: Array.from(salles.entries()).sort((a, b) => b[1] - a[1]),
      juries: Array.from(juries.entries()).sort((a, b) => b[1] - a[1]),
      copiesData: copiesData // Ajouter les données des copies pour les détails
    };
  }

  displayStats(stats) {
    const html = `
      <div class="stats-container">
        <h3>📊 Analyse du lot de correction</h3>        <div class="stat-section">
          <h4>📋 Résumé général</h4>
          <p><strong>Total des copies analysées :</strong> ${stats.totalCopies}</p>
          <p><strong>Nombre d'établissements différents :</strong> ${stats.establishments.length}</p>
          <p><strong>Zones géographiques :</strong> ${stats.zones.length}</p>
          <p><strong>Divisions/classes :</strong> ${stats.divisions.length}</p>
          <p><strong>Salles d'examen :</strong> ${stats.salles.length}</p>
          ${stats.salles.some(([salle]) => salle === 'Non définie') ? 
            `<p><small style="color: #dc3545;">⚠️ ${stats.salles.find(([salle]) => salle === 'Non définie')?.[1] || 0} copies sans salle définie</small></p>` : 
            ''}
        </div>        <div class="stat-section">
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
              <br>
              <div class="establishment-salles">
                <small><strong>Salles:</strong> ${Array.from(etab.salles).filter(s => s !== 'Non définie').sort().join(', ')}${Array.from(etab.salles).includes('Non définie') ? ' + salles non définies' : ''}</small>
              </div>
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
        </div>        <div class="stat-section">
          <h4>🎓 Répartition par division/classe</h4>
          ${stats.divisions.map(([division, count]) => `
            <div class="division-item">
              <span>${division}</span>
              <span class="count">${count} copies</span>
            </div>
          `).join('')}
        </div>

        <div class="stat-section">
          <h4>📈 Analyse avancée par division</h4>
          ${this.generateDivisionAnalysis(stats)}
        </div><div class="stat-section">
          <h4>🏫 Répartition par salle d'examen</h4>
          ${stats.salles.map(([salleZoneKey, count]) => {
            // Extraire le nom de la salle et la zone de la clé
            const lastUnderscoreIndex = salleZoneKey.lastIndexOf('_');
            const salleName = salleZoneKey.substring(0, lastUnderscoreIndex);
            const zone = salleZoneKey.substring(lastUnderscoreIndex + 1);
            
            const salleLabel = salleName === 'Non définie' ? '⚠️ Salle non définie' : `Salle ${salleName}`;
            const zoneLabel = ` (${zone})`;
            
            return `
              <div class="salle-item">
                <div class="salle-header" data-salle="${salleZoneKey}">
                  <span>${salleLabel}${zoneLabel}</span>
                  <div class="salle-controls">
                    <span class="count">${count} copies</span>
                    <span class="toggle-icon" id="icon-${salleZoneKey.replace(/[^a-zA-Z0-9]/g, '_')}">▼</span>
                  </div>
                </div>
                <div class="salle-details" id="details-${salleZoneKey.replace(/[^a-zA-Z0-9]/g, '_')}" style="display: none;">
                  ${this.getSalleDetailsUnique(salleName, zone, stats.copiesData)}
                </div>
              </div>
            `;
          }).join('')}
        </div>

        <div class="buttons-container">
          <button id="clearData" class="clear-button">🗑️ Effacer les données</button>
          <button id="exportData" class="export-button">📄 Exporter les données</button>
        </div>
      </div>
    `;

    this.statsDiv.innerHTML = html;    // Ajouter les gestionnaires d'événements
    document.getElementById('clearData')?.addEventListener('click', () => this.clearData());
    document.getElementById('exportData')?.addEventListener('click', () => this.exportData(stats));    // Ajouter les event listeners pour les menus déroulants des salles
    document.querySelectorAll('.salle-header').forEach(header => {
      header.addEventListener('click', () => {
        const salleKey = header.getAttribute('data-salle');
        this.toggleSalleDetails(salleKey);
      });
    });
      // Ajouter les event listeners pour les liens de copies sans URL
    document.querySelectorAll('.copy-link[data-copy-id]').forEach(link => {
      link.addEventListener('click', async (e) => {
        e.preventDefault();
        const copyId = link.getAttribute('data-copy-id');
        
        // Récupérer l'URL actuelle pour construire l'URL de la copie
        try {
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
          if (tab?.url) {
            const currentUrl = tab.url;
            const urlParts = currentUrl.split('/');
            if (urlParts.length >= 2) {
              // Prendre tout sauf le dernier élément et ajouter l'ID de la copie
              const baseUrl = urlParts.slice(0, -1).join('/');
              const copyUrl = `${baseUrl}/${copyId}`;
              window.open(copyUrl, '_blank');
            } else {
              alert('Impossible de construire l\'URL de la copie');
            }
          }
        } catch (error) {
          console.error('Erreur lors de la construction de l\'URL:', error);
          alert('Erreur lors de l\'ouverture de la copie');
        }
      });
    });
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
  }  getSalleDetails(salle, copiesData) {
    const copiesInSalle = copiesData.filter(copy => (copy.nomSalle || 'Non définie') === salle);
    
    return copiesInSalle.map(copy => {
      return `
        <div class="copy-item">
          <a href="#" 
             class="copy-link"
             title="Ouvrir la copie ${copy.libelleAnonymat}"
             data-copy-id="${copy.id}">
            📄 ${copy.libelleAnonymat || copy.id}
          </a>
          <div class="copy-info">
            <small>
              ${copy.codeDivisionClasse} | 
              Note: ${copy.note} | 
              ${copy.nombrePages} pages
            </small>
          </div>
        </div>
      `;
    }).join('');
  }

  getSalleDetailsUnique(salleName, zone, copiesData) {
    const copiesInSalle = copiesData.filter(copy => 
      (copy.nomSalle || 'Non définie') === salleName && copy.codeZG === zone
    );
    
    return copiesInSalle.map(copy => {
      return `
        <div class="copy-item">
          <a href="#" 
             class="copy-link"
             title="Ouvrir la copie ${copy.libelleAnonymat}"
             data-copy-id="${copy.id}">
            📄 ${copy.libelleAnonymat || copy.id}
          </a>
          <div class="copy-info">
            <small>
              ${copy.codeDivisionClasse} | 
              Note: ${copy.note} | 
              ${copy.nombrePages} pages
            </small>
          </div>
        </div>
      `;
    }).join('');
  }
  toggleSalleDetails(salleKey) {
    const detailsId = 'details-' + salleKey.replace(/[^a-zA-Z0-9]/g, '_');
    const iconId = 'icon-' + salleKey.replace(/[^a-zA-Z0-9]/g, '_');
    
    const details = document.getElementById(detailsId);
    const icon = document.getElementById(iconId);
    
    if (details && icon) {
      const isVisible = details.style.display !== 'none';
      details.style.display = isVisible ? 'none' : 'block';
      icon.textContent = isVisible ? '▼' : '▲';
    }
  }

  getSalleZoneInfo(salle, copiesData) {
    const copiesInSalle = copiesData.filter(copy => (copy.nomSalle || 'Non définie') === salle);
    const zones = [...new Set(copiesInSalle.map(copy => copy.codeZG))];
    return { zones };
  }

  generateDivisionAnalysis(stats) {
    const divisionDetails = new Map();
    
    // Analyser chaque copie pour collecter les détails par division
    stats.copiesData.forEach(copy => {
      const division = copy.codeDivisionClasse;
      
      if (!divisionDetails.has(division)) {
        divisionDetails.set(division, {
          copies: [],
          zones: new Set(),
          salles: new Set(),
          etablissements: new Set(),
          juries: new Set(),
          notes: [],
          totalPages: 0
        });
      }
      
      const detail = divisionDetails.get(division);
      detail.copies.push(copy);
      detail.zones.add(copy.codeZG);
      detail.salles.add(copy.nomSalle || 'Non définie');
      detail.etablissements.add(copy.etablissementLibelle || 'Inconnu');
      detail.juries.add(copy.numeroJury);
      
      // Analyser les notes (si elles existent et sont numériques)
      if (copy.note && !isNaN(parseFloat(copy.note))) {
        detail.notes.push(parseFloat(copy.note));
      }
      
      // Compter les pages
      if (copy.nombrePages && !isNaN(parseInt(copy.nombrePages))) {
        detail.totalPages += parseInt(copy.nombrePages);
      }
    });
    
    // Créer le HTML pour l'analyse
    const sortedDivisions = Array.from(divisionDetails.entries())
      .sort((a, b) => b[1].copies.length - a[1].copies.length);
    
    return sortedDivisions.map(([division, detail]) => {
      // Calculer les statistiques des notes
      let noteStats = '';
      if (detail.notes.length > 0) {
        const moyenne = (detail.notes.reduce((sum, note) => sum + note, 0) / detail.notes.length).toFixed(2);
        const min = Math.min(...detail.notes);
        const max = Math.max(...detail.notes);
        noteStats = `
          <div class="note-stats">
            <small><strong>Notes:</strong> Moyenne: ${moyenne} | Min: ${min} | Max: ${max} (${detail.notes.length} notées)</small>
          </div>
        `;
      }
      
      // Calculer la moyenne de pages par copie
      const avgPages = detail.totalPages > 0 ? (detail.totalPages / detail.copies.length).toFixed(1) : 'N/A';
      
      return `
        <div class="division-analysis-item">
          <div class="division-header">
            <h5>📚 ${division}</h5>
            <span class="division-count">${detail.copies.length} copies</span>
          </div>
          <div class="division-details">
            <div class="division-stats-grid">
              <div class="stat-item">
                <span class="stat-label">🗺️ Zones:</span>
                <span class="stat-value">${detail.zones.size}</span>
                <small>(${Array.from(detail.zones).sort().join(', ')})</small>
              </div>
              <div class="stat-item">
                <span class="stat-label">🏫 Établissements:</span>
                <span class="stat-value">${detail.etablissements.size}</span>
                <small>(${Array.from(detail.etablissements).filter(e => e !== 'Inconnu').join(', ')})</small>
              </div>
              <div class="stat-item">
                <span class="stat-label">🚪 Salles:</span>
                <span class="stat-value">${detail.salles.size}</span>
                <small>(${Array.from(detail.salles).filter(s => s !== 'Non définie').sort().join(', ')})</small>
              </div>
              <div class="stat-item">
                <span class="stat-label">👥 Jurys:</span>
                <span class="stat-value">${detail.juries.size}</span>
                <small>(${Array.from(detail.juries).sort().join(', ')})</small>
              </div>
              <div class="stat-item">
                <span class="stat-label">📄 Pages moy.:</span>
                <span class="stat-value">${avgPages}</span>
                <small>(${detail.totalPages} total)</small>
              </div>
            </div>
            ${noteStats}
            <div class="division-distribution">
              <small><strong>Répartition géographique:</strong></small>
              <div class="zone-distribution">
                ${Array.from(detail.zones).map(zone => {
                  const copiesInZone = detail.copies.filter(c => c.codeZG === zone).length;
                  const percentage = ((copiesInZone / detail.copies.length) * 100).toFixed(1);
                  return `<span class="zone-badge">Zone ${zone}: ${copiesInZone} (${percentage}%)</span>`;
                }).join('')}
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');
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