/**
 * Image addresses an admin may attach to a product: a full https:// address, or a path to a file in the site's own
 * public folder (for example /images/tote-noir.jpg). Anything else (javascript:, data:, http:, //other-site) is refused.
 */
export function isSafeImageUrl(u: string): boolean {
  if (u.length === 0 || u.length > 500) return false;
  if (u.startsWith("/")) return /^\/(?![/\\])[A-Za-z0-9._~\-/]+$/.test(u) && !u.includes("..");
  try {
    const x = new URL(u);
    return x.protocol === "https:" && !x.username && !x.password;
  } catch {
    return false;
  }
}
