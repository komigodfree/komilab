# KOMI.LAB — Guide de déploiement complet
# komilab.org · Hugo + Cloudflare Pages

================================================================
## ETAPE 1 — Installer Hugo sur ta machine
================================================================

### Windows (PowerShell - recommandé avec Winget)
```
winget install Hugo.Hugo.Extended
```

### Ou téléchargement direct
Aller sur : https://github.com/gohugoio/hugo/releases
Télécharger : hugo_extended_X.X.X_windows-amd64.zip
Extraire hugo.exe dans C:\Hugo\bin\
Ajouter C:\Hugo\bin au PATH système

### Linux (Debian/Ubuntu)
```bash
wget https://github.com/gohugoio/hugo/releases/download/v0.124.1/hugo_extended_0.124.1_linux-amd64.tar.gz
tar -xzf hugo_extended_0.124.1_linux-amd64.tar.gz
sudo mv hugo /usr/local/bin/
hugo version
```

### macOS
```bash
brew install hugo
hugo version
```

================================================================
## ETAPE 2 — Tester le site en local
================================================================

```bash
# Aller dans le dossier du projet
cd komilab/

# Démarrer le serveur de développement
hugo server -D

# Ouvrir dans le navigateur
# http://localhost:1313
```

Le site se rechargera automatiquement à chaque modification.

================================================================
## ETAPE 3 — Créer un dépôt GitHub
================================================================

1. Créer un compte sur https://github.com si pas encore fait
2. Créer un nouveau dépôt public nommé "komilab"
3. Initialiser Git et pousser le projet :

```bash
cd komilab/

git init
git add .
git commit -m "Initial commit — KOMI.LAB"

git remote add origin https://github.com/TON-USERNAME/komilab.git
git branch -M main
git push -u origin main
```

================================================================
## ETAPE 4 — Déployer sur Cloudflare Pages
================================================================

1. Aller sur https://dash.cloudflare.com
2. Créer un compte gratuit si nécessaire
3. Dans le menu : Workers & Pages > Create application > Pages
4. Connecter GitHub > Sélectionner le dépôt "komilab"

### Paramètres de build à configurer :
```
Framework preset   : Hugo
Build command      : hugo --minify
Build output dir   : public
Root directory     : /   (laisser vide)
```

### Variables d'environnement à ajouter :
```
HUGO_VERSION = 0.124.1
```

5. Cliquer "Save and Deploy"
6. Le site est en ligne sur : https://komilab.pages.dev

================================================================
## ETAPE 5 — Connecter le domaine komilab.org
================================================================

### 5.1 — Ajouter le domaine dans Cloudflare Pages
Dans Cloudflare Pages > ton projet > Custom domains
Cliquer "Set up a custom domain"
Entrer : komilab.org

### 5.2 — Configurer les DNS
Si ton domaine komilab.org est géré chez un autre registrar :
Aller dans la gestion DNS de ton registrar
Modifier les nameservers pour pointer vers Cloudflare :

```
ns1.cloudflare.com
ns2.cloudflare.com
```

OU ajouter des enregistrements CNAME si tu ne veux pas migrer les NS :
```
CNAME  komilab.org   →   komilab.pages.dev
CNAME  www           →   komilab.pages.dev
```

Le certificat SSL est généré automatiquement par Cloudflare (Let's Encrypt).

================================================================
## ETAPE 6 — Workflow quotidien
================================================================

### Créer un nouveau guide
```bash
hugo new guides/mon-nouveau-guide.md
```
Un fichier pré-rempli est créé dans content/guides/

### Créer une alerte de veille
```bash
hugo new veille/cve-2026-xxxx-description.md
```

### Modifier et tester
```bash
hugo server -D
# Ouvrir http://localhost:1313
```

### Publier
```bash
git add .
git commit -m "Ajouter guide : Titre de ton guide"
git push
```
→ Cloudflare Pages détecte le push et redéploie automatiquement.
→ Le site est mis à jour en 30 secondes.

================================================================
## STRUCTURE DU PROJET
================================================================

```
komilab/
├── hugo.toml                    ← Configuration Hugo
├── content/
│   ├── guides/
│   │   ├── _index.md            ← Page liste des guides
│   │   ├── truenas-iscsi-...md  ← Un guide
│   │   └── ad-tiering-...md     ← Un autre guide
│   ├── veille/
│   │   ├── _index.md
│   │   └── cve-2026-...md       ← Alerte de veille
│   └── a-propos.md
├── archetypes/
│   ├── guides.md                ← Template pour les guides
│   └── veille.md                ← Template pour la veille
├── layouts/
│   └── _default/
│       └── search-index.json    ← Index de recherche
└── themes/
    └── komilab/
        ├── theme.toml
        ├── assets/
        │   ├── css/main.css     ← Tout le CSS
        │   └── js/main.js       ← Recherche, copie, filtres
        └── layouts/
            ├── _default/
            │   ├── baseof.html  ← Template de base
            │   ├── single.html  ← Page article
            │   └── list.html    ← Page liste
            ├── index.html       ← Page d'accueil
            ├── partials/
            │   ├── navbar.html
            │   ├── footer.html
            │   ├── search.html
            │   ├── chip-cat.html
            │   └── chip-level.html
            └── shortcodes/
                ├── code-block.html  ← Bloc de code avec copie
                ├── callout.html     ← Note info/warn/ok/danger
                └── steps.html       ← Etapes numérotées
```

================================================================
## SHORTCODES DISPONIBLES DANS LES ARTICLES
================================================================

### Bloc de code avec copie en 1 clic
```
{{</* code-block file="Machine — Shell" lang="bash" */>}}
votre commande ici
{{</* /code-block */>}}
```

Langues supportées : bash, powershell, yaml, conf, python, cisco, json, hcl

### Callout (note contextuelle)
```
{{</* callout type="info" title="Prerequis" */>}}
Votre texte ici
{{</* /callout */>}}
```
Types : info | warn | ok | danger

### Etapes numérotées
```
{{</* steps */>}}
1. **Titre étape** — Description de l'étape
2. **Titre étape 2** — Description
{{</* /steps */>}}
```

### Front matter complet d'un guide
```yaml
---
title: "Titre du guide"
date: 2026-03-01
categories: ["reseau"]        # ou systeme, cybersecurite, cloud, grc, automatisation
tags: ["Cisco", "VLAN", "..."]
level: "intermediate"          # beginner | intermediate | advanced
readtime: "25 min de lecture"
featured: false                # true = affiché en avant sur la home
summary: "Description courte visible dans les listes"
---
```

================================================================
## MAINTENANCE ET EVOLUTION
================================================================

### Ajouter une nouvelle catégorie
1. Modifier layouts/partials/chip-cat.html — ajouter la couleur et le label
2. Modifier themes/komilab/layouts/index.html — sidebar domaines
3. Modifier themes/komilab/layouts/_default/list.html — filter-bar
4. Ajouter l'entrée dans hugo.toml — menu.main

### Mettre à jour Hugo
```bash
# Windows (winget)
winget upgrade Hugo.Hugo.Extended

# Linux
wget nouvelle-version && sudo mv hugo /usr/local/bin/
```

### Sauvegarder
Le projet est sur GitHub = sauvegarde automatique.
Cloudflare Pages conserve un historique de tous les déploiements.
