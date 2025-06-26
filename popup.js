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

      console.log('[SantorinCheck] Données chargées pour analyse:', copiesData);

      if (copiesData.length === 0) {
        this.setStatus('Aucune donnée trouvée. Visitez d\'abord quelques pages de copies.', true);
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
    const zones = new Map();
    const divisions = new Map();
    const piles = new Map();

    copiesData.forEach(copy => {
      // Compter par zone géographique
      zones.set(copy.codeZG, (zones.get(copy.codeZG) || 0) + 1);
      
      // Compter par division
      divisions.set(copy.codeDivisionClasse, (divisions.get(copy.codeDivisionClasse) || 0) + 1);
      
      // Compter par pile de numérisation
      const pileName = copy.pileNumerisation || 'Non définie';
      const pileZoneKey = `${pileName}_${copy.codeZG}`;
      piles.set(pileZoneKey, (piles.get(pileZoneKey) || 0) + 1);
    });

    return {
      totalCopies: copiesData.length,
      zones: Array.from(zones.entries()).sort((a, b) => b[1] - a[1]),
      divisions: Array.from(divisions.entries()).sort((a, b) => b[1] - a[1]),
      piles: Array.from(piles.entries()).sort((a, b) => b[1] - a[1]),
      copiesData: copiesData
    };
  }

  displayStats(stats) {
    const html = `
      <div class="stats-container">
        <h3>📊 Analyse intelligente du lot de correction</h3>
        
        <div class="stat-section">
          <h4>📋 Résumé général</h4>
          <p><strong>Total des copies analysées :</strong> ${stats.totalCopies}</p>
          <p><strong>Zones géographiques :</strong> ${stats.zones.length}</p>
          <p><strong>Divisions/classes :</strong> ${stats.divisions.length}</p>
          <p><strong>Piles de numérisation :</strong> ${stats.piles.length}</p>
          ${stats.piles.some(([pile]) => pile.includes('Non définie')) ? 
            `<p><small style="color: #dc3545;">⚠️ ${stats.piles.find(([pile]) => pile.includes('Non définie'))?.[1] || 0} copies sans pile définie</small></p>` : 
            ''}
        </div>

        <div class="stat-section">
          <h4>📦 Sessions de numérisation intelligentes</h4>
          ${this.generatePileAnalysis(stats)}
        </div>

        <div class="stat-section">
          <h4>🏫 Inférence des établissements</h4>
          ${this.generateEstablishmentInference(stats)}
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
  }  // ...existing code...

  groupPilesByProximity(pilesWithTimestamp, seuilMinutes = 30) {
    const sessions = [];
    const piles = [...pilesWithTimestamp];
    
    // Créer les détails enrichis pour chaque pile
    const enrichedPiles = piles.map(([pileKey, detail]) => ({
      pileKey,
      detail,
      pileName: detail.pileName,
      zone: detail.zone,
      timestamp: parseInt(detail.timestampNumerisation),
      copies: detail.copies,
      heureFormatee: new Date(parseInt(detail.timestampNumerisation)).toLocaleString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit'
      })
    }));
    
    // Trier par timestamp
    enrichedPiles.sort((a, b) => a.timestamp - b.timestamp);
    
    enrichedPiles.forEach(pile => {
      let sessionTrouvee = false;
      
      // Chercher une session existante dans la même zone et proche temporellement
      for (let session of sessions) {
        const diffTemps = Math.abs(pile.timestamp - session.timestampReference) / (1000 * 60);
        
        if (session.zones.has(pile.zone) && diffTemps <= seuilMinutes) {
          // Ajouter à cette session
          session.piles.push(pile);
          session.totalCopies += pile.copies.length;
          session.timestampMin = Math.min(session.timestampMin, pile.timestamp);
          session.timestampMax = Math.max(session.timestampMax, pile.timestamp);
          sessionTrouvee = true;
          break;
        }
      }
      
      if (!sessionTrouvee) {
        // Créer une nouvelle session
        sessions.push({
          timestampReference: pile.timestamp,
          timestampMin: pile.timestamp,
          timestampMax: pile.timestamp,
          zones: new Set([pile.zone]),
          piles: [pile],
          totalCopies: pile.copies.length
        });
      }
    });
    
    // Enrichir les sessions avec des informations formatées
    return sessions.map(session => {
      const dateDebut = new Date(session.timestampMin);
      const dateFin = new Date(session.timestampMax);
      
      // Calculer la durée
      const dureeMs = session.timestampMax - session.timestampMin;
      let dureeFormatee;
      
      if (dureeMs < 60000) { // Moins d'1 minute
        dureeFormatee = '< 1 min';
      } else if (dureeMs < 3600000) { // Moins d'1 heure
        dureeFormatee = `${Math.round(dureeMs / 60000)} min`;
      } else {
        const heures = Math.floor(dureeMs / 3600000);
        const minutes = Math.round((dureeMs % 3600000) / 60000);
        dureeFormatee = `${heures}h${minutes > 0 ? ` ${minutes}min` : ''}`;
      }
      
      // Trier les piles de la session par timestamp
      session.piles.sort((a, b) => a.timestamp - b.timestamp);
      
      return {
        ...session,
        dateDebut: dateDebut.toLocaleDateString('fr-FR', {
          weekday: 'short',
          day: '2-digit',
          month: '2-digit'
        }),
        dateFin: dateFin.toLocaleDateString('fr-FR', {
          weekday: 'short',
          day: '2-digit',
          month: '2-digit'
        }),
        heureDebut: dateDebut.toLocaleTimeString('fr-FR', {
          hour: '2-digit',
          minute: '2-digit'
        }),
        heureFin: dateFin.toLocaleTimeString('fr-FR', {
          hour: '2-digit',
          minute: '2-digit'
        }),
        dureeFormatee
      };
    }).sort((a, b) => a.timestampMin - b.timestampMin);
  }

  generatePileAnalysis(stats) {
    const pileDetails = new Map();
    const timestampStats = new Map();
    
    // Analyser chaque copie pour collecter les détails par pile
    stats.copiesData.forEach(copy => {
      const pileName = copy.pileNumerisation || 'Non définie';
      const pileKey = `${pileName}_${copy.codeZG}`;
      
      if (!pileDetails.has(pileKey)) {
        pileDetails.set(pileKey, {
          pileName: pileName,
          zone: copy.codeZG,
          numeroPile: copy.numeroPile,
          timestampNumerisation: copy.timestampNumerisation,
          copies: [],
          divisions: new Set(),
          etablissements: new Set(),
          juries: new Set(),
          notes: [],
          totalPages: 0
        });
      }
      
      const detail = pileDetails.get(pileKey);
      detail.copies.push(copy);
      detail.divisions.add(copy.codeDivisionClasse);
      detail.etablissements.add(copy.etablissementLibelle || 'Inconnu');
      detail.juries.add(copy.numeroJury);
      
      // Analyser les notes
      if (copy.note && !isNaN(parseFloat(copy.note))) {
        detail.notes.push(parseFloat(copy.note));
      }
      
      // Compter les pages
      if (copy.nombrePages && !isNaN(parseInt(copy.nombrePages))) {
        detail.totalPages += parseInt(copy.nombrePages);
      }
      
      // Compter les timestamps pour l'analyse temporelle
      if (copy.timestampNumerisation !== 'Inconnu') {
        const date = new Date(parseInt(copy.timestampNumerisation)).toDateString();
        timestampStats.set(date, (timestampStats.get(date) || 0) + 1);
      }
    });
    
    // Trier les piles par zone puis par nombre de copies
    const sortedPiles = Array.from(pileDetails.entries())
      .sort((a, b) => {
        // D'abord trier par zone
        if (a[1].zone !== b[1].zone) {
          return a[1].zone.localeCompare(b[1].zone);
        }
        // Puis par nombre de copies (décroissant)
        return b[1].copies.length - a[1].copies.length;
      });
    
    // Créer l'analyse temporelle avec regroupement intelligent
    let temporalAnalysis = '';
    if (timestampStats.size > 0) {
      // Trier les piles par timestamp pour regroupement intelligent
      const pilesWithTimestamp = Array.from(pileDetails.entries())
        .filter(([, detail]) => detail.timestampNumerisation !== 'Inconnu')
        .sort((a, b) => parseInt(a[1].timestampNumerisation) - parseInt(b[1].timestampNumerisation));
      
      if (pilesWithTimestamp.length > 0) {
        const sessions = this.groupPilesByProximity(pilesWithTimestamp);
        
        temporalAnalysis = `
          <div class="temporal-analysis">
            <h5>📅 Sessions de numérisation intelligentes</h5>
            <div class="timeline">
              ${sessions.map(session => `
                <div class="timeline-item">
                  <div class="session-header">
                    <span class="date">${session.dateDebut}</span>
                    ${session.dateFin !== session.dateDebut ? `<span class="date-fin"> → ${session.dateFin}</span>` : ''}
                    <span class="duree">(${session.dureeFormatee})</span>
                  </div>
                  <div class="session-stats">
                    <span class="timeline-count">${session.totalCopies} copies</span>
                    <span class="timeline-piles">${session.piles.length} piles</span>
                    <span class="timeline-zones">Zone${session.zones.size > 1 ? 's' : ''}: ${Array.from(session.zones).join(', ')}</span>
                  </div>
                  <div class="session-piles">
                    ${session.piles.map(pile => `
                      <small class="pile-in-session">
                        📦 ${pile.pileName} (Z${pile.zone}) - ${pile.copies.length}c - ${pile.heureFormatee}
                      </small>
                    `).join('')}
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        `;
      }
    }
    
    return `
      
      <div class="pile-summary">
        <div class="summary-grid">
          <div class="summary-item">
            <span class="summary-label">📦 Total piles:</span>
            <span class="summary-value">${pileDetails.size}</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">📄 Moy. copies/pile:</span>
            <span class="summary-value">${(stats.totalCopies / pileDetails.size).toFixed(1)}</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">🗓️ Jours de numérisation:</span>
            <span class="summary-value">${timestampStats.size}</span>
          </div>
        </div>
      </div>
      
      <div class="pile-details-list">
        ${sortedPiles.map(([pileKey, detail], index) => {
          // Calculer les statistiques
          let noteStats = '';
          if (detail.notes.length > 0) {
            const moyenne = (detail.notes.reduce((sum, note) => sum + note, 0) / detail.notes.length).toFixed(2);
            noteStats = `Moy: ${moyenne}`;
          }
          
          const avgPages = detail.totalPages > 0 ? (detail.totalPages / detail.copies.length).toFixed(1) : 'N/A';
          const dateNumerisation = detail.timestampNumerisation !== 'Inconnu' ? 
            new Date(parseInt(detail.timestampNumerisation)).toLocaleString('fr-FR', {
              day: '2-digit',
              month: '2-digit', 
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            }) : 'Inconnue';
          
          // Ajouter un séparateur de zone si c'est une nouvelle zone
          let zoneSeparator = '';
          if (index === 0 || detail.zone !== sortedPiles[index - 1][1].zone) {
            const zoneCount = sortedPiles.filter(([, d]) => d.zone === detail.zone).length;
            const zoneCopies = sortedPiles.filter(([, d]) => d.zone === detail.zone).reduce((sum, [, d]) => sum + d.copies.length, 0);
            zoneSeparator = `
              <div class="zone-separator">
                <h5>🗺️ Zone ${detail.zone} <small>(${zoneCount} piles, ${zoneCopies} copies)</small></h5>
              </div>
            `;
          }
          
          return `
            ${zoneSeparator}
            <div class="pile-detail-item">
              <div class="pile-detail-header">
                <h6>📦 ${detail.pileName} <small>(Zone ${detail.zone})</small></h6>
                <span class="pile-detail-count">${detail.copies.length} copies</span>
              </div>
              <div class="pile-detail-info">
                <small>
                  <strong>Numérisé:</strong> ${dateNumerisation} | 
                  <strong>Divisions:</strong> ${detail.divisions.size} | 
                  <strong>Pages moy:</strong> ${avgPages}
                  ${noteStats ? ` | <strong>Note:</strong> ${noteStats}` : ''}
                </small>
                <div class="pile-divisions">
                  ${Array.from(detail.divisions).slice(0, 3).map(div => 
                    `<span class="mini-badge">${div}</span>`
                  ).join('')}
                  ${detail.divisions.size > 3 ? `<span class="mini-badge">+${detail.divisions.size - 3}</span>` : ''}
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  analyzeZonePatterns(copies, zone) {
    // Grouper par timestamp de numérisation (par heure)
    const timeGroups = new Map();
    const pileGroups = new Map();
    const divisions = new Set();
    
    copies.forEach(copy => {
      divisions.add(copy.codeDivisionClasse);
      
      // Grouper par pile
      const pileKey = copy.pileNumerisation || 'Non définie';
      if (!pileGroups.has(pileKey)) {
        pileGroups.set(pileKey, {
          copies: [],
          timestamp: copy.timestampNumerisation,
          divisions: new Set()
        });
      }
      pileGroups.get(pileKey).copies.push(copy);
      pileGroups.get(pileKey).divisions.add(copy.codeDivisionClasse);
      
      // Grouper par heure de numérisation
      if (copy.timestampNumerisation && copy.timestampNumerisation !== 'Inconnu') {
        const timestamp = parseInt(copy.timestampNumerisation);
        const hourKey = Math.floor(timestamp / (1000 * 60 * 60)); // Grouper par heure
        
        if (!timeGroups.has(hourKey)) {
          timeGroups.set(hourKey, {
            copies: [],
            piles: new Set(),
            divisions: new Set(),
            timestamp: timestamp
          });
        }
        
        timeGroups.get(hourKey).copies.push(copy);
        timeGroups.get(hourKey).piles.add(pileKey);
        timeGroups.get(hourKey).divisions.add(copy.codeDivisionClasse);
      }
    });

    // Algorithme d'inférence intelligent
    const clusters = this.createIntelligentClusters(pileGroups, timeGroups, zone);
    const estimatedEstablishments = clusters.length;
    
    // Calculer un score de confiance
    let confidence = this.calculateConfidenceScore(clusters, copies.length, divisions.size, zone);
    
    return {
      totalPiles: pileGroups.size,
      estimatedEstablishments,
      clusters,
      divisions,
      confidence: Math.round(confidence)
    };
  }

  createIntelligentClusters(pileGroups, timeGroups, zone) {
    const clusters = [];
    const processedPiles = new Set();
    
    // Analyse dynamique des patterns basée sur les données réelles
    const pileArray = Array.from(pileGroups.values());
    const totalCopies = pileArray.reduce((sum, pile) => sum + pile.copies.length, 0);
    const avgCopiesPerPile = totalCopies / pileArray.length;
    
    // Analyser la distribution temporelle pour déterminer la fenêtre optimale
    const timestamps = pileArray.map(pile => parseInt(pile.timestamp || '0')).filter(t => t > 0).sort();
    let optimalTimeWindowHours = 3; // Valeur par défaut plus généreuse
    
    if (timestamps.length > 1) {
      const timeDiffs = [];
      for (let i = 1; i < timestamps.length; i++) {
        const diffHours = (timestamps[i] - timestamps[i-1]) / (1000 * 60 * 60);
        if (diffHours > 0 && diffHours <= 24) timeDiffs.push(diffHours);
      }
      
      if (timeDiffs.length > 0) {
        const avgTimeDiff = timeDiffs.reduce((sum, diff) => sum + diff, 0) / timeDiffs.length;
        // Fenêtre plus généreuse, surtout quand il y a peu de piles
        const generosityFactor = Math.max(2, 4 - (pileArray.length * 0.1));
        optimalTimeWindowHours = Math.max(1, Math.min(6, avgTimeDiff * generosityFactor));
      }
    }
    
    // Trier les piles par timestamp
    const sortedPiles = Array.from(pileGroups.entries()).sort((a, b) => {
      const timestampA = parseInt(a[1].timestamp || '0');
      const timestampB = parseInt(b[1].timestamp || '0');
      return timestampA - timestampB;
    });
    
    for (const [pileName, pileData] of sortedPiles) {
      if (processedPiles.has(pileName)) continue;
      
      const cluster = {
        copies: [...pileData.copies],
        piles: [pileName],
        divisions: new Set(pileData.divisions),
        timestamp: parseInt(pileData.timestamp || '0'),
        patternType: 'Isolé'
      };
      
      // Rechercher des piles similaires dans la fenêtre temporelle
      for (const [otherPileName, otherPileData] of sortedPiles) {
        if (processedPiles.has(otherPileName) || otherPileName === pileName) continue;
        
        const otherTimestamp = parseInt(otherPileData.timestamp || '0');
        const timeDiff = Math.abs(cluster.timestamp - otherTimestamp) / (1000 * 60 * 60); // en heures
        
        // Critères de regroupement intelligent avec priorité aux divisions identiques
        const sameTimeWindow = timeDiff <= optimalTimeWindowHours;
        const compatibleDivisions = this.areCompatibleDivisions(cluster.divisions, otherPileData.divisions);
        
        // Si les divisions sont exactement identiques, on peut être plus permissif sur le temps
        const identicalDivisions = cluster.divisions.size === otherPileData.divisions.size && 
                                  [...cluster.divisions].every(div => otherPileData.divisions.has(div));
        const extendedTimeWindow = identicalDivisions && (timeDiff <= optimalTimeWindowHours * 2);
        
        // NOUVEAU : Si très proche temporellement (< 1h), on accepte même des divisions différentes
        const veryCloseInTime = timeDiff <= 1; // Moins d'1 heure = très probable même établissement
        
        // NOUVEAU : Si un des clusters est très petit (≤ 2 copies) et que l'écart est < 2h, on regroupe
        const smallCluster = (cluster.copies.length <= 2 || otherPileData.copies.length <= 2) && timeDiff <= 2;
        
        // Critère principal : proximité temporelle forte OU petit cluster proche OU (proximité normale + divisions compatibles)
        if (veryCloseInTime || smallCluster || (compatibleDivisions && (sameTimeWindow || extendedTimeWindow))) {
          // Fusionner les clusters
          cluster.copies.push(...otherPileData.copies);
          cluster.piles.push(otherPileName);
          otherPileData.divisions.forEach(div => cluster.divisions.add(div));
          cluster.patternType = 'Groupé';
          processedPiles.add(otherPileName);
        }
      }
      
      // Finaliser le cluster
      cluster.sessionInfo = this.formatSessionInfo(cluster.timestamp, cluster.copies.length);
      processedPiles.add(pileName);
      clusters.push(cluster);
    }
    
    return clusters;
  }

  areCompatibleDivisions(divisionsA, divisionsB) {
    // Logique pour déterminer si les divisions sont compatibles
    const setA = new Set(divisionsA);
    const setB = new Set(divisionsB);
    
    // Si c'est exactement les mêmes divisions = très compatible
    if (setA.size === setB.size && [...setA].every(div => setB.has(div))) {
      return true;
    }
    
    // Si une des divisions est incluse dans l'autre = compatible
    const intersection = [...setA].filter(div => setB.has(div));
    if (intersection.length > 0) {
      return true;
    }
    
    // Si c'est des divisions de même famille (ex: TSTMG1, TSTMG2, TSTMG3)
    const familiesA = [...setA].map(div => div.replace(/\d+$/, ''));
    const familiesB = [...setB].map(div => div.replace(/\d+$/, ''));
    
    return familiesA.some(family => familiesB.includes(family));
  }

  calculateConfidenceScore(clusters, totalCopies, totalDivisions, zone) {
    let score = 50; // Score de base
    
    // Bonus pour cohérence temporelle
    const avgCopiesPerCluster = totalCopies / clusters.length;
    if (avgCopiesPerCluster >= 3 && avgCopiesPerCluster <= 20) {
      score += 20; // Taille réaliste des établissements
    }
    
    // Bonus pour cohérence des divisions
    const avgDivisionsPerCluster = totalDivisions / clusters.length;
    if (avgDivisionsPerCluster >= 1 && avgDivisionsPerCluster <= 6) {
      score += 15; // Nombre réaliste de divisions par établissement
    }
    
    // Bonus pour distribution équilibrée
    const clusterSizes = clusters.map(c => c.copies.length);
    const maxSize = Math.max(...clusterSizes);
    const minSize = Math.min(...clusterSizes);
    const sizeVariation = maxSize / minSize;
    
    if (sizeVariation <= 3) {
      score += 15; // Les établissements ont des tailles similaires
    }
    
    // Bonus pour regroupement cohérent
    const groupedClusters = clusters.filter(c => c.patternType === 'Groupé').length;
    if (groupedClusters > 0 && groupedClusters <= clusters.length * 0.7) {
      score += 10; // Bon équilibre entre regroupement et isolation
    }
    
    return Math.min(100, Math.max(10, score));
  }

  formatSessionInfo(timestamp, copyCount) {
    if (!timestamp || timestamp === 0) return 'Heure inconnue';
    
    const date = new Date(timestamp);
    return date.toLocaleDateString('fr-FR', { 
      weekday: 'short', 
      day: '2-digit', 
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  getEstablishmentName(zone, index) {
    return `Établissement ${String.fromCharCode(65 + index)} (Zone ${zone})`;
  }

  generateEstablishmentInference(stats) {
    const zones = new Map();
    
    // Grouper les copies par zone
    stats.copiesData.forEach(copy => {
      if (!zones.has(copy.codeZG)) {
        zones.set(copy.codeZG, []);
      }
      zones.get(copy.codeZG).push(copy);
    });

    let html = `
      <div class="establishment-inference">
        <div class="inference-explanation">
          <small>💡 <strong>Inférence intelligente</strong> basée sur l'analyse des patterns de divisions, temporalité et volume de copies</small>
        </div>
    `;

    zones.forEach((copies, zone) => {
      const analysis = this.analyzeZonePatterns(copies, zone);
      
      html += `
        <div class="zone-analysis">
          <h5>🗺️ Zone ${zone}</h5>
          <div class="zone-summary">
            <span class="zone-stat">📦 ${analysis.totalPiles} piles</span>
            <span class="zone-stat">🏫 ${analysis.estimatedEstablishments} établissements estimés</span>
            <span class="zone-stat">📚 ${analysis.divisions.size} divisions</span>
            <span class="zone-stat">📊 Confiance: ${analysis.confidence}%</span>
          </div>
          
          <div class="establishments-list">
            ${analysis.clusters.map((cluster, index) => `
              <div class="establishment-cluster">
                <div class="cluster-header">
                  <span class="cluster-title">🏫 ${this.getEstablishmentName(zone, index)}</span>
                  <span class="cluster-count">${cluster.copies.length} copies</span>
                </div>
                <div class="cluster-details">
                  <small>
                    ${cluster.sessionInfo} | 
                    ${cluster.piles.length} piles | 
                    Pattern: ${cluster.patternType}
                  </small>
                  <div class="cluster-divisions">
                    ${Array.from(cluster.divisions).map(div => 
                      `<span class="division-badge">${div}</span>`
                    ).join('')}
                  </div>
                  <div class="cluster-piles">
                    <small><strong>Piles:</strong> ${cluster.piles.join(', ')}</small>
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    });

    html += `
      <div class="inference-stats">
        <h5>📈 Résumé de l'analyse</h5>
        <div class="inference-grid">
          ${Array.from(zones.entries()).map(([zone, copies]) => {
            const analysis = this.analyzeZonePatterns(copies, zone);
            return `
              <div class="inference-item">
                <span class="inference-label">Zone ${zone}:</span>
                <span class="inference-value">${analysis.estimatedEstablishments} étab.</span>
                <small>(${(copies.length / analysis.estimatedEstablishments).toFixed(1)} copies/étab.)</small>
              </div>
            `;
          }).join('')}
        </div>
      </div>
      </div>
    `;

    return html;
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