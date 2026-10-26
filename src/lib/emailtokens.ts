import type { PrismaClient } from "@prisma/client";
import { prisma } from "./db";
import { emailFrom, HOURS, identifierFor, type Kind } from "./emailtokenids";
import { hashToken, newToken } from "./token";

type Db = Pick<PrismaClient, "verificationToken">;

/** Creates a single-use link token. Only its hash is stored, and any earlier token of the same kind for this email stops working. */
export async function issueToken(kind: Kind, email: string): Promise<string> {
  const raw = newToken(), identifier = identifierFor(kind, email);
  await prisma.$transaction([
    prisma.verificationToken.deleteMany({ where: { identifier } }),
    prisma.verificationToken.create({ data: { identifier, token: hashToken(raw), expires: new Date(Date.now() + HOURS[kind] * 3_600_000) } }),
  ]);
  return raw;
}

/** Uses up a token and returns its email, or null if it is unknown, expired, of another kind, or already used. Call it inside the same transaction as the change it unlocks. */
export async function consumeToken(db: Db, kind: Kind, raw: string): Promise<string | null> {
  const hash = hashToken(raw);
  const row = await db.verificationToken.findUnique({ where: { token: hash } });
  const email = row ? emailFrom(kind, row.identifier) : null;
  if (!row || !email || row.expires.getTime() < Date.now()) return null;
  const gone = await db.verificationToken.deleteMany({ where: { token: hash } });
  return gone.count === 1 ? email : null; // two clicks at once: only one wins
}
