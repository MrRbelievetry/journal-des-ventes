# Journal des ventes et avoirs

Application web statique pour generer un journal des ventes et avoirs a partir de fichiers importes localement dans le navigateur.

## Sources prises en charge

- Oriental Discount : factures PrestaShop PDF
- Oriental Discount : avoirs PrestaShop PDF
- Henne Discount : factures PrestaShop PDF
- Amazon : rapport d'activite CSV
- eBay : rapport de commandes CSV

## Exports

- PDF comptable de controle
- CSV detaille
- Excel detaille
- CSV de synthese comptable cumulee
- Excel de synthese comptable cumulee

## Publication GitHub Pages

1. Creer un depot GitHub.
2. Envoyer tous les fichiers de ce dossier a la racine du depot.
3. Dans GitHub, aller dans Settings > Pages.
4. Choisir Deploy from a branch.
5. Selectionner la branche main et le dossier /root.
6. Ouvrir l'URL GitHub Pages generee.

## Securite

Les fichiers importes sont lus localement dans le navigateur. Ils ne sont pas envoyes a un serveur par cette application statique.

Le code d'acces a 4 chiffres est une protection simple cote navigateur. Pour une securite forte, il faut un hebergement avec authentification serveur.

Aucun lien admin ni token d'acces ne doit etre place dans le code avant publication publique.
