import { Prisma } from "@prisma/client";

/** The Prisma error code (for example P2002 for a duplicate value), or null when the error is something else. */
export const dbCode = (e: unknown): string | null => (e instanceof Prisma.PrismaClientKnownRequestError ? e.code : null);

/** For a duplicate-value error, the column names involved, as one lowercase string. */
export const dbTarget = (e: unknown): string =>
  e instanceof Prisma.PrismaClientKnownRequestError ? String((e.meta as { target?: unknown } | undefined)?.target ?? "").toLowerCase() : "";
