/**
 * Remove todos os MASTER no banco e cria um novo (primeiro acesso com credenciais do seed).
 *
 * Variáveis (opcionais, iguais ao seed):
 *   SEED_MASTER_EMAIL, SEED_MASTER_PASSWORD
 *
 * Executar: npm run reset:master
 */
import "./load-local-env";

import { hash } from "bcryptjs";

import { deleteAllMasterUsers } from "./master-user-reset";
import { prisma } from "../src/lib/prisma";

async function main() {
  const email = (process.env.SEED_MASTER_EMAIL ?? "romariafluvialads@gmail.com").toLowerCase().trim();
  const plain = process.env.SEED_MASTER_PASSWORD ?? "Senha123!";

  const clash = await prisma.user.findUnique({ where: { email } });
  if (clash && clash.role !== "MASTER") {
    throw new Error(
      `O e-mail ${email} já está registado com outro perfil (${clash.role}). Use outro SEED_MASTER_EMAIL ou altere esse utilizador.`,
    );
  }

  await prisma.$connect();

  const removed = await deleteAllMasterUsers(prisma);
  console.log(removed > 0 ? `Removido(s) ${removed} utilizador(es) MASTER.` : "Nenhum MASTER existia.");

  const passwordHash = await hash(plain, 10);
  await prisma.user.create({
    data: {
      email,
      name: "Administrador Master",
      passwordHash,
      role: "MASTER",
      isActive: true,
      mustChangePassword: false,
      isAdmin: false,
    },
  });

  console.log(`Novo MASTER criado: ${email}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
