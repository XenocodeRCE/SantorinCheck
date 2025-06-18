# Santorin Auto-Annotateur

Une extension de navigateur simple pour automatiser l'annotation "lu" sur toutes les pages d'une copie sur la plateforme Santorin.

## À quoi ça sert ?

Cet outil est conçu pour les correcteurs utilisant la plateforme Santorin. Il permet d'ajouter automatiquement la mention "lu" sur chaque page d'une copie en un seul clic, évitant ainsi la tâche répétitive de le faire manuellement sur de longues copies.

Le processus est simple :
1.  Cliquez sur le bouton de l'extension.
2.  L'outil récupère les informations de session nécessaires.
3.  Il annote ensuite chaque page de la copie ouverte avec le texte "lu".

## Comment l'installer (Chrome / Edge)

L'extension doit être installée manuellement en mode développeur.

### Étape 1 : Télécharger le code

- Si vous avez `git`, clonez ce dépôt.
- Sinon, téléchargez le projet en format ZIP depuis la page principale du dépôt GitHub et décompressez-le sur votre ordinateur.

### Étape 2 : Installer l'extension

1.  Ouvrez votre navigateur **Google Chrome** ou **Microsoft Edge**.
2.  Accédez à la page des extensions :
    - Pour Chrome : `chrome://extensions`
    - Pour Edge : `edge://extensions`
3.  Activez le **Mode développeur**. Cette option se trouve généralement sous forme d'un interrupteur en haut à droite de la page.
4.  Une fois le mode développeur activé, de nouveaux boutons apparaissent. Cliquez sur **"Charger l'extension non empaquetée"** (ou "Load unpacked" en anglais).
5.  Une fenêtre de sélection de dossier s'ouvre. Naviguez jusqu'au dossier du projet que vous avez téléchargé et décompressé (le dossier qui contient les fichiers `popup.js`, `popup.html`, etc.), puis cliquez sur **"Sélectionner un dossier"**.
6.  L'extension **Santorin Auto-Annotateur** apparaît maintenant dans votre liste d'extensions. Elle est prête à être utilisée !

### Étape 3 : Utilisation

- Rendez-vous sur une page de correction de copie Santorin.
- Cliquez sur l'icône de l'extension dans la barre d'outils de votre navigateur.
- Cliquez sur le bouton **"Annoter 'lu' sur tout"**.
