export type Kind = "reset" | "verify";
export const HOURS: Record<Kind, number> = { reset: 1, verify: 24 };

export const identifierFor = (kind: Kind, email: string) => `${kind}:${email}`;
/** The email inside an identifier of the given kind, or null when the identifier is for something else. */
export const emailFrom = (kind: Kind, identifier: string) => (identifier.startsWith(`${kind}:`) ? identifier.slice(kind.length + 1) : null);
