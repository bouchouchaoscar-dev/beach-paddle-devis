/** Construit le nom de fichier PDF pour une facture libre.
 *  Format : "Facture [Nom client] [JJ-MM-AA].pdf"
 *  Exemples : "Facture BPCE 28-05-26.pdf", "Facture Association Sportive 03-06-26.pdf"
 */
export function buildFactureLibreFileName(clientName: string, date: string): string {
  const [year, month, day] = date.split("-");
  const formattedDate = `${day}-${month}-${year.slice(2)}`;

  // Retirer les caractères interdits dans les noms de fichiers
  const safeName = clientName.trim().replace(/[/\\:*?"<>|]/g, "").trim();

  if (!safeName) return `Facture-personnalisee-${formattedDate}.pdf`;
  return `Facture ${safeName} ${formattedDate}.pdf`;
}
