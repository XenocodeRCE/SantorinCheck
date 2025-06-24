# SANTORIN Auto-Annotateur 🤖

Une extension de navigateur intelligente pour automatiser l'annotation "lu" et analyser la provenance des copies sur la plateforme Santorin.

## 🎯 À quoi ça sert ?

Cette extension est conçue pour les correcteurs utilisant la plateforme Santorin. Elle offre deux fonctionnalités principales :

### 1. **Annotation automatique** 📝
- Ajoute automatiquement la mention "lu" sur chaque page d'une copie en un seul clic
- Évite la tâche répétitive sur de longues copies
- Processus rapide et fiable

### 2. **Analyse des établissements** 📊
- **Collecte automatique** des métadonnées de chaque copie visitée
- **Analyse géographique** : identifie les zones et départements d'origine
- **Statistiques détaillées** : nombre d'établissements, répartition par division/classe
- **Export des données** pour analyse approfondie

## ✨ Fonctionnalités

### Collecte automatique des données
Dès que vous visitez une page de copie, l'extension collecte automatiquement :
- Zone géographique (code département)
- Établissement d'origine
- Division/classe (ex: TLE-09)
- Salle d'examen
- Numéro de jury
- Note attribuée
- Date d'épreuve

### Interface d'analyse
- **Résumé général** : nombre total de copies, d'établissements, de zones
- **Établissements représentés** : liste détaillée avec statistiques
- **Répartition géographique** : analyse par zone/département
- **Répartition par classe** : analyse par division
- **Gestion des données** : effacement et export

## 🚀 Comment l'utiliser

### Processus simple :
1. **Navigation normale** : Parcourez les copies comme d'habitude
2. **Collecte automatique** : Les métadonnées se collectent en arrière-plan
3. **Annotation rapide** : Cliquez sur "📝 Annoter 'lu' sur tout" pour annoter une copie
4. **Analyse avancée** : Cliquez sur "📊 Analyser les établissements" pour voir les statistiques

## 📦 Installation (Chrome / Edge)

L'extension doit être installée manuellement en mode développeur.

### Étape 1 : Télécharger le code

- Si vous avez `git` : `git clone [URL_DU_DEPOT]`
- Sinon : téléchargez le ZIP depuis GitHub et décompressez-le

### Étape 2 : Installer l'extension

1. **Ouvrez votre navigateur** (Chrome ou Edge)
2. **Accédez aux extensions** :
   - Chrome : `chrome://extensions`
   - Edge : `edge://extensions`
3. **Activez le Mode développeur** (interrupteur en haut à droite)
4. **Cliquez sur "Charger l'extension non empaquetée"**
5. **Sélectionnez le dossier** du projet téléchargé
6. **L'extension apparaît** dans votre liste - elle est prête ! ✅

### Étape 3 : Utilisation

1. **Rendez-vous sur Santorin** et naviguez vers une copie
2. **Cliquez sur l'icône** de l'extension dans la barre d'outils
3. **Utilisez les fonctionnalités** :
   - **"📝 Annoter 'lu' sur tout"** : pour annoter la copie actuelle
   - **"📊 Analyser les établissements"** : pour voir les statistiques collectées

## 📊 Exemple d'analyse

L'extension peut vous révéler des informations comme :
- "Votre lot contient des copies de 12 établissements différents"
- "Répartition : 38% zone 038 (Isère), 25% zone 073 (Savoie), 37% autres"
- "Classes représentées : TLE-09 (45%), TLE-12 (30%), TLE-06 (25%)"
- Export JSON pour analyses Excel/statistiques poussées

## 🔧 Compatibilité

- ✅ Google Chrome
- ✅ Microsoft Edge
- ✅ Plateforme Santorin (santorin.examens-concours.gouv.fr)

## 🛡️ Sécurité

- **Données locales** : toutes les informations restent sur votre ordinateur
- **Pas de transmission** : aucune donnée n'est envoyée vers des serveurs externes
- **Respect de la vie privée** : seules les métadonnées nécessaires sont collectées

---

*Extension développée pour faciliter le travail des correcteurs et fournir des insights sur la composition géographique des lots de correction.*
