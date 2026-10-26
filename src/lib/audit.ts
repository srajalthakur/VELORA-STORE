import { prisma } from "./db";
/** Records who did what in the admin area. A failure to write the log is reported but never blocks the action. */
export async function audit(actor: { id: string; email: string }, action: string, target: { type: string; id: string }, detail: Record<string, unknown> = {}) {
  try {
    const json = JSON.parse(JSON.stringify(detail)); // plain JSON only
    await prisma.auditLog.create({ data: { actorId: actor.id, actorEmail: actor.email, action, targetType: target.type, targetId: target.id, detail: json } });
  } catch (e) {
    console.error("audit log failed:", action, e instanceof Error ? e.message : "unknown error");
  }
}
