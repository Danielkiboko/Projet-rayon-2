/**
 * Utilitaires partagés de sécurité & assainissement (Source de vérité unique).
 * Évite la duplication de `escapeHtml` et les fuites de détails internes dans les réponses API.
 */

export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Retourne un message d'erreur sûr pour le client (ne fuite jamais de stack trace ni de chemin serveur en prod).
 */
export function safeApiError(error: unknown, fallback = "Une erreur interne est survenue."): string {
  if (process.env.NODE_ENV !== "production" && error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}
