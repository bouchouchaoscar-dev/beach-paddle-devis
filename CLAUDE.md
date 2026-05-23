# Beach Paddle — Outil de génération de devis

## Contexte

Beach Paddle est une base nautique associative (loi 1901) située à Saint-Maur-des-Fossés (94), en bord de Marne. Elle propose la location de stand-up paddles et de kayaks, ainsi que des prestations de snacking (goûter, déjeuner, apéro). Elle accueille régulièrement des groupes : entreprises (team building), établissements scolaires, centres de loisirs.

Cet outil est une application web interne, utilisée uniquement par Oscar et 2 collègues, déployée sur Vercel. Elle remplace la création manuelle de devis sous Excel.

---

## Informations société

- **Nom** : Beach Paddle
- **Forme juridique** : Association loi 1901, non assujettie à la TVA
- **SIRET** : 84118702400010
- **Adresse** : 86 ter, rue de Verdun — 94500 Champigny sur Marne
- **Téléphone** : 06 46 86 04 26
- **Email** : oscar@beachpaddle.fr / contact@beachpaddle.fr
- **IBAN** : FR14 2004 1000 0168 5155 3W02 021
- **BIC** : PSSTFRPPPAR
- **Banque** : La Banque Postale — 75900 Paris Cedex 15
- **Logo** : `/public/logo.png`

---

## Tarifs — Location groupe (prix par personne)

### Stand Up Paddle
| Durée | Prix/pers |
|-------|-----------|
| 30 min | 10,00 € |
| 1h | 17,00 € |
| 1h30 | 25,00 € |
| 2h | 30,00 € |

### Kayak
| Durée | Prix/pers |
|-------|-----------|
| 30 min | 7,50 € |
| 1h | 13,00 € |
| 1h30 | 19,50 € |
| 2h | 24,00 € |

### Hybride (Paddle + Kayak au choix)
Prix = (prix paddle + prix kayak) / 2 pour la durée choisie.

---

## Formules snacking (prix par personne)

| Formule | Composition | Prix/pers |
|---------|-------------|-----------|
| Déjeuner classique | Panini OU Croque Monsieur OU Hot Dog + boisson froide (eau, sodas) + boisson chaude (café, thé, chocolat chaud) | 13,50 € |
| Goûter classique | Crêpe sucrée maison OU Glace OU Cookie maison + boisson froide + boisson chaude | 11,50 € |
| Déjeuner + Goûter | Les deux formules combinées | 22,00 € |
| Apéro | Boissons + snacks apéritifs (prix variable) | Manuel |
| Formule personnalisée | Description libre + prix manuel | Manuel |

---

## Logique de réduction

### Entreprise / Société
- Remise exceptionnelle groupe appliquée sur le total
- Taux habituels : 5%, 8%, 10%, 15% (modifiable)
- Libellé sur le devis : "REMISE EXCEPTIONNELLE GROUPE ENTREPRISE"

### Établissement scolaire / Centre de loisirs
1. **Accompagnateurs offerts** (toggle ON par défaut) : déduire le coût des accompagnateurs (nb_accompagnateurs × prix/pers)
2. **Remise supplémentaire** (toggle ON par défaut) : % appliqué sur le montant restant après déduction accompagnateurs
3. Libellé sur le devis : "REMISE EXCEPTIONNELLE ÉTABLISSEMENT SCOLAIRE"
4. Afficher le détail : "Offert pour X accompagnateurs : -XX€" + "X% de remise supplémentaire : -XX€" + "Remise totale ≈ X%"

Tous les toggles et pourcentages sont modifiables à la main. Valeurs par défaut selon le type de client.

---

## Numérotation des devis

Format : `N°JJ/MM-XXX`  
Exemple : `N°22/05-001`, `N°22/05-002` (repart à 001 chaque nouveau jour)

---

## Documents générés

### Devis
- Émis avant la prestation pour valider la réservation
- Nécessite un acompte de 30% pour bloquer la date

### Facture
- Émise après la prestation
- Même document qu'un devis mais avec le titre "FACTURE"
- Champ optionnel : acompte déjà versé → affiche le restant dû

---

## Structure visuelle du document (PDF)

### En-tête
- Colonne gauche : Numéro de document (gras), "BEACH PADDLE" (titre large, police colorée), adresse, téléphone, email
- Colonne droite : Logo
- Date en dessous

### Bloc client
- "POUR" (gauche) : description libre de la prestation
- "SOCIÉTÉ" ou "ÉTABLISSEMENT" (droite) : nom du client en gros caractères gras

### Section Description
Tableau avec :
- Titre de section centré en couleur (ex: "ACTIVITÉ KAYAK", "DÉJEUNER", "GOÛTER")
- Description de la prestation (en couleur, italique)
- Prix par personne (aligné à droite, souligné)
- Nombre de personnes (aligné à droite, souligné)

### Totaux
- TOTAL : montant
- Section remise (en couleur orange/rouge) avec détail
- TOTAL AVEC REMISE : montant final

### Pied de page
- "Association loi 1901, non assujettie à la TVA" (gauche, couleur)
- "Date, signature et tampon, précédés de la mention BON POUR ACCORD" (droite)
- RIB complet (gauche)
- Encadré "Afin de valider la réservation, un acompte de 30% sera nécessaire" (droite, italique gras)

---

## Palette de couleurs (reprendre le style des devis actuels)

- Titre "BEACH PADDLE" : orange `#E8820C`
- Titres de sections activité : bleu-vert `#2E86AB`
- Textes descriptifs : bleu-vert `#2E86AB`
- Remises : rouge/orange `#D94F04`
- Textes noirs standard : `#1A1A1A`

---

## Authentification

3 comptes utilisateur en dur dans la config :
- `oscar` / `beachpaddle2025`
- `user2` / `beach2025`
- `user3` / `beach2025`

Session mémorisée dans localStorage. Page de login soignée avec logo.

---

## Contraintes techniques

- Next.js 14 App Router + TypeScript
- Tailwind CSS + Shadcn/ui
- Génération PDF : jsPDF + html2canvas
- Persistance : localStorage (historique des devis)
- Déployable sur Vercel (gratuit)
- Aucune base de données externe requise
