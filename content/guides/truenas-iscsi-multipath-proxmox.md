---
title: "Déploiement TrueNAS SCALE avec iSCSI Multipath sur Proxmox"
date: 2026-02-15
categories: ["cloud"]
tags: ["TrueNAS", "iSCSI", "Proxmox", "Multipath", "ZFS", "Stockage"]
level: "advanced"
readtime: "35 min de lecture"
featured: true
summary: "Configuration complète d'un stockage SAN iSCSI avec multipath sur TrueNAS SCALE et intégration dans un cluster Proxmox VE. Haute disponibilité du stockage avec basculement automatique sur deux chemins réseau indépendants."
---

## Architecture cible {#architecture}

Le multipath iSCSI utilise deux chemins réseau indépendants entre les hôtes Proxmox et le NAS. En cas de défaillance d'un switch ou d'une carte réseau, le trafic bascule automatiquement sans interruption des VMs.

- **Réseau iSCSI-A :** `192.168.10.0/24` — Interface `ens18` (TrueNAS) / `vmbr10` (Proxmox)  
- **Réseau iSCSI-B :** `192.168.20.0/24` — Interface `ens19` (TrueNAS) / `vmbr20` (Proxmox)  
- **Politique :** round-robin avec failback immédiat

{{< callout type="info" title="Prerequis" >}}
TrueNAS SCALE 23.10+, Proxmox VE 8.x, deux interfaces réseau dédiées stockage par noeud (10 GbE recommandé), réseau de stockage isolé du réseau de gestion.
{{< /callout >}}

## 1. Préparation du pool ZFS {#pool-zfs}

### Création du pool {#create-pool}

Créez un pool ZFS dédié iSCSI. Utilisez RAID-Z2 minimum en production (tolérance 2 disques).

{{< code-block file="TrueNAS — Shell" lang="bash" >}}
# Lister les disques disponibles
lsblk -d -o NAME,SIZE,TYPE,MODEL
zpool status

# Créer le pool RAIDZ2 (adapter les identifiants disques)
zpool create -o ashift=12 \
  iscsi-pool raidz2 \
  /dev/disk/by-id/ata-DISK_001 \
  /dev/disk/by-id/ata-DISK_002 \
  /dev/disk/by-id/ata-DISK_003 \
  /dev/disk/by-id/ata-DISK_004

# Vérifier la création du pool
zpool status iscsi-pool
zpool list iscsi-pool
{{< /code-block >}}

### Création du zvol iSCSI {#zvol}

{{< code-block file="TrueNAS — Shell" lang="bash" >}}
# Créer un zvol de 500 Go pour Proxmox
zfs create -V 500G \
  -o volblocksize=16K \
  -o compression=lz4 \
  -o dedup=off \
  -o sync=always \
  iscsi-pool/proxmox-vm-store

# Vérifier
zfs list iscsi-pool/proxmox-vm-store
ls -la /dev/zvol/iscsi-pool/
{{< /code-block >}}

{{< callout type="warn" title="Attention" >}}
`sync=always` garantit l'intégrité des données mais réduit les performances en écriture. Sur du matériel avec cache BBU ou NVRAM, vous pouvez utiliser `sync=standard`.
{{< /callout >}}

## 2. Configuration iSCSI sur TrueNAS {#iscsi-truenas}

Via l'interface web TrueNAS : **Services > iSCSI**. Configurez les quatre composants dans l'ordre :

{{< steps >}}
1. **Portals — Interfaces d'écoute** — Créez deux portals : Portal-A sur `192.168.10.10:3260` et Portal-B sur `192.168.20.10:3260`. Un portal par interface réseau.
2. **Initiators — Autorisation des hôtes** — Ajoutez les IQN de chaque noeud Proxmox. En production, spécifiez explicitement chaque initiateur plutôt que d'autoriser tout le réseau.
3. **Extents — Association du zvol** — Créez un extent de type Device pointant sur `/dev/zvol/iscsi-pool/proxmox-vm-store`. Activez **Disable Physical Block Size Reporting** pour la compatibilité Proxmox.
4. **Associated Targets — Liaison complète** — Créez un target, associez les deux portals (multipath) et l'extent. Notez l'IQN généré.
{{< /steps >}}

## 3. Multipath sur Proxmox {#multipath}

{{< code-block file="/etc/multipath.conf" lang="conf" >}}
defaults {
    user_friendly_names    yes
    path_grouping_policy   multibus
    failback               immediate
    no_path_retry          12
    polling_interval       5
    checker_timeout        60
}

blacklist {
    devnode "^(ram|raw|loop|fd|md|dm-|sr|scd|st)[0-9]*"
    devnode "^hd[a-z]"
    devnode "^sd[a-z]$"
}

multipaths {
    multipath {
        wwid                  VOTRE_WWID
        alias                 iscsi-proxmox-store
        path_grouping_policy  multibus
        path_checker          tur
        path_selector         "round-robin 0"
        rr_min_io             100
        failback              immediate
    }
}
{{< /code-block >}}

{{< code-block file="Proxmox — Shell (chaque noeud)" lang="bash" >}}
# Installer les paquets nécessaires
apt install -y multipath-tools open-iscsi

# Découverte iSCSI sur les deux chemins
iscsiadm -m discovery -t sendtargets -p 192.168.10.10:3260
iscsiadm -m discovery -t sendtargets -p 192.168.20.10:3260

# Connexion aux targets
iscsiadm -m node --login

# Activer et démarrer multipathd
systemctl enable --now multipathd

# Récupérer le WWID du device multipath
multipath -ll
{{< /code-block >}}

## 4. Intégration dans Proxmox {#integration}

{{< code-block file="Proxmox — Shell" lang="bash" >}}
# Créer le VG LVM sur le device multipath
pvcreate /dev/mapper/iscsi-proxmox-store
vgcreate iscsi-vg /dev/mapper/iscsi-proxmox-store

# Créer le thin pool
lvcreate -L 450G -T iscsi-vg/data

# Ajouter dans Proxmox
pvesm add lvmthin iscsi-storage \
  --vgname iscsi-vg \
  --thinpool data \
  --content images,rootdir \
  --nodes pve1,pve2,pve3
{{< /code-block >}}

## 5. Test du failover {#failover}

{{< code-block file="Proxmox — Test failover" lang="bash" >}}
# Surveiller l'état multipath en temps réel
watch -n 1 multipath -ll

# Simuler une panne de chemin
ip link set ens18 down

# Observer le basculement automatique
# Restaurer le chemin
ip link set ens18 up

# Vérifier les logs multipathd
journalctl -u multipathd -f
{{< /code-block >}}

{{< callout type="ok" title="Resultat attendu" >}}
Avec un chemin désactivé, les VMs continuent de fonctionner sans interruption. Le multipath bascule en moins de 10 secondes selon votre configuration `polling_interval`.
{{< /callout >}}
