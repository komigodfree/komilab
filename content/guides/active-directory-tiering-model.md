---
title: "Active Directory — Modèle d'administration en Tiers (Tier 0/1/2)"
date: 2026-02-05
categories: ["cybersecurite"]
tags: ["Active Directory", "Hardening", "Tier Model", "GPO", "PowerShell", "Windows Server"]
level: "intermediate"
readtime: "50 min de lecture"
featured: true
summary: "Mise en oeuvre du modèle Microsoft de délégation en niveaux pour isoler les comptes à hauts privilèges, bloquer les mouvements latéraux et prévenir les attaques de type Pass-the-Hash dans un environnement Active Directory."
---

## Pourquoi le modèle en Tiers {#pourquoi}

Dans une attaque classique sur Active Directory, l'attaquant compromet d'abord un poste de travail, récupère des credentials en mémoire (Mimikatz, LSASS dump), puis pivote vers des serveurs et enfin vers les contrôleurs de domaine. Le modèle en tiers **brise cette chaîne** en imposant que les comptes d'un niveau ne puissent jamais s'authentifier sur un système de niveau inférieur.

{{< callout type="info" title="Principe fondamental" >}}
Un administrateur Tier 0 dispose d'un compte dédié **uniquement** pour gérer les DCs. Il a un second compte Tier 1 pour les serveurs, et son compte utilisateur standard pour le quotidien. Ces comptes ne se mélangent jamais.
{{< /callout >}}

## Les trois niveaux {#niveaux}

| Tier | Périmètre | Exemples |
|------|-----------|---------|
| **Tier 0** | Contrôle de l'identité | Contrôleurs de domaine, PKI, ADFS, Azure AD Connect |
| **Tier 1** | Serveurs d'application | Serveurs de fichiers, BDD, hyperviseurs, serveurs applicatifs |
| **Tier 2** | Poste de travail | PCs utilisateurs, laptops, périphériques |

{{< callout type="warn" title="Regle absolue" >}}
Un compte Tier 0 ne se connecte **jamais** sur un système Tier 1 ou Tier 2. Toute violation est techniquement bloquée par GPO, pas seulement recommandée par procédure.
{{< /callout >}}

## 1. Structure des OUs {#ou}

{{< code-block file="PowerShell — AD Module" lang="powershell" >}}
$domain = "DC=komilab,DC=local"

# Créer l'OU racine Administration
New-ADOrganizationalUnit -Name "Administration" -Path $domain

# Créer les trois tiers avec leurs sous-OUs
foreach ($tier in @("Tier0","Tier1","Tier2")) {
    New-ADOrganizationalUnit -Name $tier `
        -Path "OU=Administration,$domain"

    foreach ($type in @("Accounts","Groups","ServiceAccounts")) {
        New-ADOrganizationalUnit -Name $type `
            -Path "OU=$tier,OU=Administration,$domain"
    }
}

# Créer les groupes de sécurité par tier
New-ADGroup -Name "Tier0-Admins" `
    -GroupScope Global -GroupCategory Security `
    -Path "OU=Groups,OU=Tier0,OU=Administration,$domain"

New-ADGroup -Name "Tier1-Admins" `
    -GroupScope Global -GroupCategory Security `
    -Path "OU=Groups,OU=Tier1,OU=Administration,$domain"

New-ADGroup -Name "Tier2-Admins" `
    -GroupScope Global -GroupCategory Security `
    -Path "OU=Groups,OU=Tier2,OU=Administration,$domain"
{{< /code-block >}}

## 2. Comptes dédiés par Tier {#comptes}

{{< code-block file="PowerShell — Création des comptes" lang="powershell" >}}
# Compte Tier 0 (accès DCs uniquement)
New-ADUser -Name "adm-t0-kpodohoui" `
    -UserPrincipalName "adm-t0-kpodohoui@komilab.local" `
    -Path "OU=Accounts,OU=Tier0,OU=Administration,$domain" `
    -Enabled $true `
    -PasswordNeverExpires $false

# Ajouter au groupe Domain Admins (Tier 0 seulement)
Add-ADGroupMember -Identity "Domain Admins" -Members "adm-t0-kpodohoui"

# Compte Tier 1 (serveurs uniquement)
New-ADUser -Name "adm-t1-kpodohoui" `
    -UserPrincipalName "adm-t1-kpodohoui@komilab.local" `
    -Path "OU=Accounts,OU=Tier1,OU=Administration,$domain" `
    -Enabled $true

Add-ADGroupMember -Identity "Tier1-Admins" -Members "adm-t1-kpodohoui"
{{< /code-block >}}

## 3. GPO de restriction de connexion {#gpo}

C'est le cœur du modèle. Les GPO bloquent **techniquement** les connexions inter-tiers.

{{< steps >}}
1. **Créer la GPO Tier 0** — `SEC-Tier0-Logon-Restriction` appliquée aux OUs Tier1 et Tier2.
2. **Configurer User Rights Assignment** — Dans la GPO : `Computer Configuration > Policies > Windows Settings > Security Settings > Local Policies > User Rights Assignment`.
3. **Ajouter les droits de refus** — Ajouter le groupe `Tier0-Admins` dans : `Deny log on locally`, `Deny log on through Remote Desktop Services`, `Deny access to this computer from the network`.
4. **Répéter pour Tier 1** — Créer `SEC-Tier1-Logon-Restriction` avec `Tier1-Admins` et l'appliquer à l'OU Tier2.
5. **Lier les GPOs** — Lier `SEC-Tier0-Logon-Restriction` aux OUs Servers et Workstations. Lier `SEC-Tier1-Logon-Restriction` à l'OU Workstations.
{{< /steps >}}

{{< code-block file="PowerShell — Liaison GPO" lang="powershell" >}}
# Créer la GPO de restriction Tier 0
$gpo = New-GPO -Name "SEC-Tier0-Logon-Restriction"

# Lier aux OUs Tier1 et Tier2
New-GPLink -Name "SEC-Tier0-Logon-Restriction" `
    -Target "OU=Servers,OU=Tier1,$domain"

New-GPLink -Name "SEC-Tier0-Logon-Restriction" `
    -Target "OU=Workstations,OU=Tier2,$domain"

# Forcer l'application immédiate
Invoke-GPUpdate -Force -Computer "DC01"
{{< /code-block >}}

## 4. Stations d'administration dédiées (PAW) {#paw}

Pour Tier 0, déployez des **Privileged Access Workstations** dédiées : machines physiques ou VMs isolées, utilisées uniquement pour la gestion des DCs. Jamais de navigation web ni email sur ces postes.

{{< callout type="ok" title="Conseil de déploiement" >}}
Déployez d'abord en mode audit pendant 2 à 4 semaines. Utilisez l'event ID **4625** (logon failure) et **4776** pour identifier les violations avant d'activer le blocage. Cela évite les coupures de service inattendues.
{{< /callout >}}

{{< code-block file="PowerShell — Audit des violations" lang="powershell" >}}
# Rechercher les tentatives de connexion bloquées par les GPO de restriction
Get-WinEvent -ComputerName "DC01" -FilterHashtable @{
    LogName   = 'Security'
    Id        = 4625
    StartTime = (Get-Date).AddDays(-7)
} | Where-Object {
    $_.Properties[5].Value -like "adm-t0-*"
} | Select-Object TimeCreated,
    @{N='User';E={$_.Properties[5].Value}},
    @{N='Workstation';E={$_.Properties[13].Value}},
    @{N='FailureReason';E={$_.Properties[9].Value}} |
Format-Table -AutoSize
{{< /code-block >}}
