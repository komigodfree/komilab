---
title: "{{ replace .Name "-" " " | title }}"
date: {{ .Date }}
categories: ["cybersecurite"]
tags: []
severity: "high"           # critical | high | medium | info
severitylabel: "Elevé"     # Critique | Elevé | Moyen | Info
cve: ""                    # ex: CVE-2026-1234
cvss: ""                   # ex: 8.5
summary: ""
---

## Résumé

<!-- Description courte de la menace -->

## Versions affectées

<!-- Listez les versions vulnérables -->

## Actions immédiates

{{</* callout type="danger" title="Action requise" */>}}
<!-- Actions à effectuer en priorité -->
{{</* /callout */>}}

## Références

- Lien vers le bulletin officiel
- Lien vers CISA / NVD
