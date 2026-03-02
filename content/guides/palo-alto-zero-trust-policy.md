---
title: "Palo Alto PAN-OS — Politique Zero Trust et micro-segmentation réseau"
date: 2026-02-10
categories: ["reseau", "cybersecurite"]
tags: ["Palo Alto", "Zero Trust", "PAN-OS", "Firewall", "App-ID", "Security Policy"]
level: "advanced"
readtime: "45 min de lecture"
featured: false
summary: "Implémentation d'une architecture Zero Trust sur un firewall Palo Alto PAN-OS. Segmentation par zones de sécurité, utilisation d'App-ID pour le contrôle applicatif, User-ID pour l'identification des utilisateurs et Security Profiles pour l'inspection du trafic."
---

## Principes Zero Trust sur PAN-OS {#principes}

Le modèle Zero Trust repose sur trois axiomes : **ne jamais faire confiance**, **toujours vérifier**, **limiter l'accès au strict nécessaire**. Sur un Palo Alto, cela se traduit par une politique **deny-all par défaut** avec des règles explicites basées sur l'application, l'utilisateur et la destination — jamais sur des ports.

{{< callout type="info" title="Pre-requis" >}}
PAN-OS 10.x ou supérieur, licence Threat Prevention et URL Filtering activées, intégration Active Directory ou LDAP pour User-ID.
{{< /callout >}}

## 1. Architecture des zones de sécurité {#zones}

{{< steps >}}
1. **UNTRUST** — Internet. Niveau de confiance 0. Tout le trafic entrant est inspecté.
2. **DMZ** — Serveurs exposés (web, mail, VPN). Accès contrôlé depuis UNTRUST et TRUST.
3. **TRUST** — Réseau interne utilisateurs. Accès sortant autorisé par application.
4. **SERVERS** — Serveurs d'infrastructure (AD, backup, monitoring). Accès restreint aux admins.
5. **MGMT** — Management hors-bande. Accessible uniquement depuis les PAW admins.
{{< /steps >}}

## 2. Configuration des zones {#config-zones}

{{< code-block file="PAN-OS CLI" lang="bash" >}}
# Créer les zones de sécurité
set zone UNTRUST network layer3
set zone DMZ     network layer3
set zone TRUST   network layer3
set zone SERVERS network layer3
set zone MGMT    network layer3

# Assigner les interfaces aux zones
set network interface ethernet ethernet1/1 layer3 units ethernet1/1.0
set zone UNTRUST network layer3 members [ ethernet1/1 ]
set zone TRUST   network layer3 members [ ethernet1/2 ]
set zone DMZ     network layer3 members [ ethernet1/3 ]
set zone SERVERS network layer3 members [ ethernet1/4 ]

# Activer User-ID par zone
set zone TRUST   user-acl include-list any
set zone SERVERS user-acl include-list any

commit
{{< /code-block >}}

## 3. Politique de sécurité Zero Trust {#policy}

La règle fondamentale : **bloquer tout par défaut** et n'autoriser que l'explicitement nécessaire.

{{< code-block file="PAN-OS — Security Policy" lang="bash" >}}
# Règle 1 : Autoriser DNS uniquement vers les DNS internes
set rulebase security rules DNS-Interne from TRUST
set rulebase security rules DNS-Interne to SERVERS
set rulebase security rules DNS-Interne source any
set rulebase security rules DNS-Interne destination 10.0.0.10  # DNS interne
set rulebase security rules DNS-Interne application dns
set rulebase security rules DNS-Interne service application-default
set rulebase security rules DNS-Interne action allow
set rulebase security rules DNS-Interne profile-setting group "Strict-Security"

# Règle 2 : Navigation web (App-ID, pas port 80/443)
set rulebase security rules Web-Outbound from TRUST
set rulebase security rules Web-Outbound to UNTRUST
set rulebase security rules Web-Outbound source any
set rulebase security rules Web-Outbound destination any
set rulebase security rules Web-Outbound application [ ssl web-browsing ]
set rulebase security rules Web-Outbound service application-default
set rulebase security rules Web-Outbound action allow
set rulebase security rules Web-Outbound profile-setting group "Strict-Security"

# Règle DENY-ALL finale (toujours en dernière position)
set rulebase security rules Deny-All from any
set rulebase security rules Deny-All to any
set rulebase security rules Deny-All source any
set rulebase security rules Deny-All destination any
set rulebase security rules Deny-All application any
set rulebase security rules Deny-All service any
set rulebase security rules Deny-All action deny
set rulebase security rules Deny-All log-setting "Forward-to-SIEM"

commit
{{< /code-block >}}

## 4. Security Profiles — Inspection du trafic {#profiles}

{{< code-block file="PAN-OS — Security Profiles" lang="bash" >}}
# Anti-Virus Profile — mode strict
set profiles virus Strict-AV botnet-networks enable yes
set profiles virus Strict-AV decoder ftp action reset-both
set profiles virus Strict-AV decoder http action reset-both
set profiles virus Strict-AV decoder smb action reset-both

# Anti-Spyware — blocage des C2
set profiles spyware Strict-AS botnet-networks enable yes
set profiles spyware Strict-AS rules simple-critical action block-ip
set profiles spyware Strict-AS rules simple-high action reset-both

# Vulnerability Protection
set profiles vulnerability Strict-VP rules simple-critical action block-ip
set profiles vulnerability Strict-VP rules simple-high action reset-both

# Grouper dans un Security Profile Group
set profile-group Strict-Security virus Strict-AV
set profile-group Strict-Security spyware Strict-AS
set profile-group Strict-Security vulnerability Strict-VP
set profile-group Strict-Security url-filtering Strict-URL

commit
{{< /code-block >}}

{{< callout type="warn" title="App-ID vs Port" >}}
Ne créez jamais de règles basées sur les ports (`service tcp-80` ou `tcp-443`). Utilisez toujours les App-ID (`web-browsing`, `ssl`, `office365-base`). PAN-OS décodera le trafic et appliquera la politique sur l'application réelle, pas sur le port déclaré.
{{< /callout >}}

## 5. Vérification et monitoring {#monitoring}

{{< code-block file="PAN-OS CLI — Vérification" lang="bash" >}}
# Afficher les sessions actives
show session all

# Vérifier les sessions par application
show session all filter application ssl

# Statistiques des règles (hits)
show running security-policy

# Trafic en temps réel (ACC)
> show traffic

# Vérifier que User-ID fonctionne
show user ip-user-mapping all
show user group name "Domain Admins"
{{< /code-block >}}
