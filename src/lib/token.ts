import { createHash, randomBytes } from "node:crypto";
/** Session tokens are random; only their SHA-256 hash is stored, so a database leak cannot be replayed as a login. */
export const newToken = () => randomBytes(32).toString("base64url");
export const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");
