import type { PrismaClient } from "../src/generated/prisma/client";

/**
 * Remove todos os utilizadores MASTER e dependências mínimas que impedem DELETE
 * (campanhas/modelos criados por eles). Não altera clientes nem outros admins.
 */
export async function deleteAllMasterUsers(client: PrismaClient): Promise<number> {
  const masters = await client.user.findMany({
    where: { role: "MASTER" },
    select: { id: true },
  });
  const ids = masters.map((m) => m.id);
  if (ids.length === 0) return 0;

  await client.$transaction(async (tx) => {
    await tx.sentEmail.updateMany({
      where: { performedByUserId: { in: ids } },
      data: { performedByUserId: null },
    });
    await tx.auditLog.updateMany({
      where: { performedByUserId: { in: ids } },
      data: { performedByUserId: null },
    });
    await tx.pendingTestimonial.updateMany({
      where: { reviewedByUserId: { in: ids } },
      data: { reviewedByUserId: null },
    });
    await tx.pendingSiteChange.updateMany({
      where: { reviewedByUserId: { in: ids } },
      data: { reviewedByUserId: null },
    });

    await tx.emailCampaign.deleteMany({ where: { createdById: { in: ids } } });
    await tx.smsCampaign.deleteMany({ where: { createdById: { in: ids } } });
    await tx.smsTemplate.deleteMany({ where: { createdById: { in: ids } } });
    await tx.emailTemplate.deleteMany({ where: { createdById: { in: ids } } });

    await tx.user.deleteMany({ where: { id: { in: ids } } });
  });

  return ids.length;
}
