# Niche CRM — Guide de Workflow / دليل سير العمل

**Version:** 1.0  
**Date:** Juin 2026  
**Public:** Client, Admin, Équipe interne

---

## 1. Vue d'ensemble / نظرة عامة

Niche CRM est une plateforme de gestion commerciale et opérationnelle. Elle relie :

- **Acquisition** (leads, appels, outreach)
- **Conversion** (pipeline → client signé)
- **Livraison** (projets, tâches, freelancers)
- **Suivi financier** (factures, dépenses)
- **Portails** (client, monitoring freelancer)

```
Lead → Pipeline → Client → Projet → Tâches → Livraison → Facturation
         ↑              ↑         ↑
    Cold Caller    Client Portal  Freelancer / Admin
    Outreacher
```

---

## 2. Rôles utilisateurs / الأدوار

| Rôle | Accès principal | Objectif |
|------|-----------------|----------|
| **Admin** | Tout le CRM | Supervision, validation, reporting |
| **Client** | Client Portal | Suivre projets, factures, équipe |
| **Freelancer** | Tasks assignées, Screen Monitor | Exécuter le travail |
| **Cold Caller** | Pipeline, appels | Générer et qualifier des leads |
| **Outreacher** | Outreach, leads | Prospection messages / email |

**État actuel :** Tous les rôles existent dans la base (`users.role`), mais l'interface n'est pas encore filtrée par rôle — un utilisateur connecté voit le menu admin complet. *À corriger en phase 2.*

---

## 3. Workflow principal — De la prospection à la livraison

### Étape 1 — Lead (Prospect)

| Action | Où ? | API / Table |
|--------|------|-------------|
| Créer un deal | `page/pipeline.html` ou `page/kanban.html` | `POST /api/pipeline/deals` → table `leads` |
| Déplacer le stage | Drag & drop pipeline | `PUT /api/pipeline/deals/:id/stage` |
| Voir sur la carte | `index.html` (Dashboard) | `GET /api/leads/geo` (nécessite `lat`/`lng`) |

**Stages pipeline :** Lead → Contacted → Meeting → Qualified → Proposal → Negotiation → Won / Lost

---

### Étape 2 — Client (Signé)

| Action | Où ? | API / Table |
|--------|------|-------------|
| Créer un client | `page/clients.html` | `POST /api/clients` → table `clients` |
| Voir projets & factures | Modal client | `GET /api/clients/:id/projects`, `.../invoices` |

**Note :** Quand un deal passe à **Won**, créer manuellement le client dans Clients (liaison auto prévue phase 2).

---

### Étape 3 — Projet

| Action | Où ? | API / Table |
|--------|------|-------------|
| Créer un projet | `page/projects.html` | `POST /api/projects` → table `projects` |
| Suivre la progression | Colonne `progress` (0–100%) | `GET /api/projects` |
| Planning | `page/gantt.html` | `GET /api/projects/:id/tasks` |

Chaque projet est lié à un **client** (`projects.client_id`).

---

### Étape 4 — Tâches

| Action | Où ? | API / Table |
|--------|------|-------------|
| Créer une tâche | `page/tasks.html` | `POST /api/tasks` → table `tasks` |
| Assigner à un user | Champ `assigned_to` | Référence `users.id` |
| Visible au client ? | Option `visibleToClient` | Colonne `visible_to_client` |
| Changer le statut | Interface tasks | `PUT /api/tasks/:id/status` |

**Statuts tâches :** To Do → In Progress → Review → Done

---

### Étape 5 — Finance

| Action | Où ? | API / Table |
|--------|------|-------------|
| Factures | `page/finance.html` | `GET /api/finance/invoices` → `invoices` |
| Dépenses | `page/finance.html` | `GET /api/finance/expenses` → `expenses` |
| Rapports | `page/reports.html` | Agrégation multi-API |

---

## 4. Client Portal — بوابة العميل

**URL :** `/page/client-portal.html?id={CLIENT_ID}`

### Ce que le client peut voir aujourd'hui

| Section | Source | Statut |
|---------|--------|--------|
| KPIs (ROAS, leads, revenue) | API ou données demo si échec | ⚠️ Partiel |
| Projets en cours | `GET /api/clients/:id/projects` | ✅ |
| Progression % | Champ `progress` du projet | ✅ |
| Factures | `GET /api/clients/:id/invoices` | ✅ |
| Équipe assignée | `GET /api/clients/:id/team` | ✅ |
| Messagerie | `POST /api/messages` | ❌ Stub (pas de sauvegarde) |
| Planifier un appel | `POST /api/calls/schedule` | ❌ Stub |

### Comment donner accès à un client

1. Créer le client dans **Clients** → noter l'`id`
2. (Recommandé phase 2) Créer un compte `users` avec `role = client` lié à cet `id`
3. Ouvrir : `/page/client-portal.html?id=3` (exemple id=3)
4. Le client se connecte via `login.html` avec son email

---

## 5. Freelancer — المستقل

### Ce qui existe

| Fonction | Page | Statut |
|----------|------|--------|
| Liste freelancers (admin) | `page/freelancers.html` | ✅ PostgreSQL API |
| API freelancers | `GET /api/freelancers` | ✅ (table `users`) |
| Assignation tâches | `page/tasks.html` | ✅ |
| Screen monitoring | `page/screen-monitor.html` | ✅ API |
| Staffing / placements | `page/staffing.html` | ✅ |

### Freelancer Portal — بوابة المستقل

**URL :** `/page/freelancer-portal.html`  
**Admin preview :** `/page/freelancer-portal.html?freelancerId={USER_ID}`

| Fonction | API | Statut |
|----------|-----|--------|
| Mes tâches (filtrées) | `GET /api/freelancer/tasks` | ✅ |
| Changer statut tâche | `PUT /api/freelancer/tasks/:id/status` | ✅ |
| Note de progression | `POST /api/freelancer/tasks/:id/note` | ✅ |
| Soumettre livrable (nom + lien) | `POST /api/freelancer/tasks/:id/deliverable` | ✅ |
| Time tracking start/stop | `POST /api/freelancer/time-tracking/*` | ✅ |
| Mes projets | `GET /api/freelancer/projects` | ✅ |
| Screen Monitor | `page/screen-monitor.html` | ✅ |

**Accès :** compte `users.role = freelancer`. Admin peut prévisualiser via `?freelancerId=`.

---

## 6. Suivi du progrès / متابعة التقدم

### Pour l'Admin

| Indicateur | Où vérifier |
|------------|-------------|
| Pipeline global | Dashboard, Pipeline, Kanban |
| Progression projet | Projects, Gantt, Client Portal |
| Tâches par statut | Tasks (compteurs en haut) |
| Performance équipe | Reports, Analytics |
| Activité appels | Call Recording, Dashboard |
| Activité freelancer | Screen Monitor |

### Pour le Client

| Indicateur | Où vérifier |
|------------|-------------|
| Avancement projet | Client Portal → Projects |
| Factures | Client Portal → Invoices |
| Équipe | Client Portal → Team |

### Pour le Freelancer (actuel)

- Tâches visibles dans l'admin Tasks (pas de vue filtrée dédiée)
- Sessions écran dans Screen Monitor

---

## 7. Documents & vérification / المستندات

| Fonctionnalité | Statut | Détail |
|----------------|--------|--------|
| Pièces jointes tâches | ❌ | UI locale seulement, pas en base |
| Validation client | ❌ | Non implémenté |
| `visible_to_client` sur tâches | ✅ | Flag en DB, affichage portal à renforcer |

**Phase 2 prévue :** upload fichiers, statuts `pending / approved / rejected`, notification client.

---

## 8. Carte géographique (Dashboard)

- **Technologie :** Leaflet sur `index.html`
- **API :** `GET /api/leads/geo`
- **Condition :** leads avec `lat` et `lng` renseignés
- **Problème actuel :** création deal ne remplit pas les coordonnées → carte souvent vide
- **Solution phase 2 :** champ pays + géocodage automatique

---

## 9. Matrice d'état — Récapitulatif honnête

| Module | Fonctionnel | Partiel | Manquant |
|--------|:-----------:|:-------:|:--------:|
| Dashboard & Analytics | ✅ | | |
| Pipeline / Kanban | ✅ | | |
| Clients | ✅ | | |
| Projects | ✅ | | |
| Tasks | ✅ | ⚠️ attachments | |
| Finance | ✅ | | |
| Reports | ✅ | | |
| Client Portal | | ⚠️ | sécurité rôle |
| Freelancer Portal | ✅ | | |
| Freelancers page | ✅ | | |
| Call Recording | ✅ | | |
| Screen Monitor | ✅ | | |
| Map | | ⚠️ pas de geo data | |
| Messages / Schedule | | | ❌ stub |
| Document verification | | | ❌ |

---

## 10. Checklist de vérification pour le Client

Utilisez cette liste pour valider le système :

- [ ] Créer un lead dans Pipeline et le déplacer jusqu'à Won
- [ ] Créer un client lié au deal gagné
- [ ] Créer un projet avec budget et dates
- [ ] Ajouter des tâches assignées à un freelancer
- [ ] Cocher « Visible to client » sur une tâche
- [ ] Ouvrir Client Portal avec `?id=` du client
- [ ] Vérifier factures dans Finance
- [ ] Consulter Reports pour vue globale
- [ ] Tester Screen Monitor pour un freelancer
- [ ] Vérifier Dashboard Analytics

---

## 11. Prochaines étapes recommandées

1. **Sécurité par rôle** — chaque rôle voit uniquement son espace
3. **Liaison users ↔ clients** — login client → ses projets automatiquement
4. **Upload documents** — livrables avec validation
5. **Géocodage carte** — leads visibles sur la map
6. **Notifications** — alertes progression en temps réel

---

## 12. Accès rapide

| Ressource | URL |
|-----------|-----|
| Guide interactif | `/page/workflow.html` |
| Dashboard | `/index.html` |
| Client Portal | `/page/client-portal.html?id={id}` |
| Freelancer Portal | `/page/freelancer-portal.html` |
| API Health | `/api/health` |

---

*Document généré pour Niche CRM — pour toute question, contacter l'équipe de développement.*
