/**
 * Fetch a PDF from a server-side API route and return a blob URL.
 * Throws with a human-readable message on any error.
 */
export async function fetchPdfBlobUrl(
  route: string,
  body: Record<string, unknown>
): Promise<string> {
  const response = await fetch(route, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({} as { error?: string })) as { error?: string };
    throw new Error(err.error ?? `Erreur serveur ${response.status}`);
  }
  return URL.createObjectURL(await response.blob());
}

/**
 * Best-effort programmatic download.
 * Works on desktop and Android; silently does nothing on iOS Safari
 * (user gesture context is lost after await — caller must render a declarative <a>).
 */
export function tryAutoDownload(url: string, fileName: string): void {
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
