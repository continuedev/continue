# À propos de Continue.dev (Fork Intrinsec)
====================================================

Continue.dev est l'assistant de codage IA open source principal. Conçu pour connecter n'importe quel modèle et contexte, il permet de créer des expériences personnalisées d'autocomplétion et de chat directement dans l'environnement de développement. Au-delà de l'approche IDE, cela ouvre la porte à la création de cas d'utilisation autour de fichiers texte (notamment Markdown) et d'interactions avancées avec des LLM (Large Language Models).

## Pour Intrinsec, cette version spécialisée offre :

* Compatibilité avec la plateforme [https://ai.intrinsec.com](https://ai.intrinsec.com)
* Accès aux modèles autorisés pour le traitement des données clients
* Accès aux modèles commerciaux
* La possibilité d'utiliser les modèles fournis par d'autres infrastructures (usages directs d'OpenAI/Claude, etc.)
* **Important :** L'utilisation d'infrastructures externes pour les travaux relatifs à Intrinsec n'est plus autorisée.

## Guide d'Installation et de Configuration de Continue (Fork Intrinsec)
---------------------------------------------------------

### Installation

1. **Téléchargement** : Téléchargez la dernière version de l'extension correspondant à votre système d'exploitation (par exemple, `continue-win32-x64-0.X.XXX.vsix` pour Windows). [https://github.com/Intrinsec/continue/releases/ ](https://github.com/Intrinsec/continue/releases/).
2. **Accès aux Extensions** : Accédez à l'onglet "Extensions" de Visual Studio Code : `Fichier` > `Préférences` > `Extensions`.
3. **Installation à partir de VSIX** : Cliquez sur le menu contextuel (trois petits points en haut à droite du panneau Extension) et sélectionnez `Installer à partir de VSIX...`.

### Configuration Initiale

* **Important :** Désactivez les mises à jour automatiques de Continue pour éviter la synchronisation avec la version officielle.
* Dans la catégorie Extensions, cliquez sur l'extension Continue.
* Décochez la case `Mise à jour automatique`.

### Paramétrage

* **Pour les utilisateurs de Continue.dev existants dans VSCode :**
  * Sauvegardez votre configuration précédente.
  * Désinstallez la version existante de Continue.dev.
  * **Étapes de configuration :**
1. **Accès au fichier de configuration** :
* Cliquez sur l'icône de l'Extension Continue.
* Cliquez ensuite sur l'icône de la roue dentée pour ouvrir votre fichier de configuration.
2. **Méthode alternative d'accès à la configuration** :
* La configuration du plugin est accessible via le fichier : `C:\Users\user\.continue\config.json`.
3. **Mise à jour de la configuration** : Effacez le contenu actuel du fichier de configuration et remplacez-le par la nouvelle configuration fournie.
4. **Important :** Remplacez toutes les occurrences de `"FIXME_APIKEY"` par votre jeton d'authentification API Dragonfly.
* Le jeton est disponible dans votre profil sur l'interface web de la plateforme IA. https://ai.intrinsec.com/

### Personnalisation

* **Pour ajouter des modèles supplémentaires :**
  * Consultez la section "Models" de la documentation API de la plateforme IA.
  * Copiez le nom et le titre du modèle souhaité.
  * Ajoutez un nouveau bloc de modèle dans votre configuration.

### Fichier de Configuration (`config.json`)
```JSON
{
  "models": [
    {
      "model": "neuralmagic/Llama-3.1-Nemotron-70B-Instruct-HF-FP8-dynamic",
      "title": "AI Intrinsec - SNC - Llama 3.1 Nemotron",
      "apiKey": "FIXME_APIKEY",
      "provider": "dragonfly",
      "contextLength": "60000"
    },
    {
      "model": "claude-3-5-sonnet-latest",
      "title": "AI Intrinsec - Claude 3.5 Sonnet ",
      "apiKey": "FIXME_APIKEY",
      "provider": "dragonfly"
    },
    {
      "model": "mistral-large-latest ",
      "title": "AI Intrinsec - Mistral",
      "apiKey": "FIXME_APIKEY",
      "provider": "dragonfly"
    },
    {
      "model": "chatgpt-4o-latest",
      "title": "AI Intrinsec - Chat GPT 4o",
      "apiKey": "FIXME_APIKEY",
      "provider": "dragonfly"
    },
    {
      "model": "o1-mini",
      "title": "AI Intrinsec - Chat GPT o1-mini",
      "apiKey": "FIXME_APIKEY",
      "provider": "dragonfly"
    },
    {
      "title": "Exemple installation ollama locale - Local Llama 3.1 8B (recommanded)",
      "provider": "ollama",
      "model": "llama3.1:8b"
    },
    {
      "title": "Exemple installation ollama locale - Local IBM Granite 3.1-dense 8B",
      "provider": "ollama",
      "model": "granite3.1-dense:8b",
      "systemMessage": "You are an expert software developer. You give helpful and concise responses."
    },
    {
      "title": "Exemple installation ollama locale - Local DeepSeek Coder 2 16B",
      "provider": "ollama",
      "model": "deepseek-coder-v2:16b",
      "systemMessage": "You are an expert software developer. You give helpful and concise responses."
    }
  ],
  "tabAutocompleteOptions": {
    "disable": true
  },
  "tabAutocompleteModel": {
    "title": "Local Qwen2.5-Coder 1.5B (recommanded)",
    "model": "qwen2.5-coder:1.5b",
    "provider": "ollama"
  },
  "slashCommands": [
    {
      "name": "edit",
      "description": "Edit selected code"
    },
    {
      "name": "comment",
      "description": "Write comments for the selected code"
    },
    {
      "name": "share",
      "description": "Export this session as markdown"
    },
    {
      "name": "cmd",
      "description": "Generate a shell command"
    },
    {
      "name": "commit",
      "description": "Generate a git commit message"
    }
  ],
  "customCommands": [
    {
      "name": "test",
      "prompt": "Write a comprehensive set of unit tests for the selected code. It should setup, run tests that check for correctness including important edge cases, and teardown. Ensure that the tests are complete and sophisticated. Give the tests just as chat output, don't edit any file.",
      "description": "Write unit tests for highlighted code"
    }
  ],
  "contextProviders": [
    {
      "name": "file"
    },
    {
      "name": "diff",
      "params": {}
    },
    {
      "name": "open",
      "params": {
        "onlyPinned": true
      }
    },
    {
      "name": "terminal",
      "params": {}
    },
    {
      "name": "problems",
      "params": {}
    },
    {
      "name": "codebase",
      "params": {}
    },
    {
      "name": "code",
      "params": {}
    },
    {
      "name": "docs",
      "params": {}
    },
    {
      "name": "tree"
    },
    {
      "name": "repo-map"
    },
    {
      "name": "folder"
    },
    {
      "name": "url"
    }
  ],
  "allowAnonymousTelemetry": false,
  "docs": []
}
```

## Recommandations
--------------

### Usages et Protection des Secrets

* **Attention :** Continue.dev est particulièrement utile pour ses fonctions de gestion du contexte d'entrée soumis au LLM. Pensez à vérifier les éléments envoyés (automatiquement ou explicitement) basés sur vos fichiers ouverts dans VS Code.
* **Conseil :** Utilisez Claude 3.5 pour le développement, mais évitez d'envoyer des mots de passe, clés d'API, clés privées, etc.

### Apprentissage

* **Documentation :**
* [CONTINUE_README.md](CONTINUE_README.md)
* <https://docs.continue.dev/> (au moins le User Guide, comptez environ une heure pour tester en parallèle)
* <https://docs.continue.dev/customize/overview> (éventuellement le guide de customisation, notamment les "Context providers" & "Tools" pour les profils techniques)

### Recommandations pour la Version Courante (0.8)

* **Configuration Utilisateur de Continue :**
* L'option d'inclusion des fichiers ouverts via le provider de contexte `@openFile` dans le chat avec le LLM est positionnée sur `onlyPinned: True`. Cela permet de choisir précisément les fichiers à inclure en les "pinnant" (clic droit sur le nom).
* La fonctionnalité Autocomplete nécessite un petit modèle avec un entraînement particulier (voir doc si besoin). Il est recommandé de tester avec une instance ollama locale et le modèle Qwen2.

## Contribuer au Développement
---------------------------

### Lisez la Documentation

* **Guide de Customisation :** <https://docs.continue.dev/customize/overview> (éventuellement le guide de customisation, notamment les "Context providers" & "Tools" pour les profils techniques)
* **Contribution :** <https://github.com/continuedev/continue/blob/main/CONTRIBUTING.md>

### Organisation du Fork

* **Branche "main" :** La branche "main" locale est identique à la branche "main" du projet sur GitHub.
* **Branche "dragonfly" :** Les modifications sont effectuées dans la branche "dragonfly", et les releases seront produites à partir de celle-ci.
* **Mises à jour régulières :** Régulièrement, les modifications apportées sur la branche "main" officielle seront mergées dans la branche "dragonfly".

### Provider Dragonfly

* **Description :** La principale modification de ce fork de Continue est l'ajout d'un nouveau provider de LLM, "dragonfly".
* **Emplacement :** Le fichier est situé dans le dossier `core/llm/llms/Dragonfly.ts`.
* **Implémentation :** L'implémentation actuelle étend simplement la classe du provider OpenAI tout en implémentant certaines spécificités liées aux modèles d'Anthropic (claude-sonnet).

### Proposer une Feature

* **Créer une Issue :** Créez une issue et expliquez les ajouts/modifications à effectuer.
* **Créer une Merge Request :** Créez ensuite la merge request associée depuis la branche "dragonfly" en créant une nouvelle branche dédiée au développement.

### TODO

* **Support IDE Jetbrains :** Tester et compiler la version pour les IDE Jetbrains.
* **Provider Dragonfly dans l'outil de configuration :** Implémenter le provider dragonfly dans l'outil de configuration initial de Continue, afin de ne plus avoir à modifier la configuration à la main.
* **Mise à jour automatique :** Étudier la possibilité de mettre en place une fonction de mise à jour automatique.
