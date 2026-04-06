import { redirect } from "next/navigation";
import { DashboardHero, SectionCard } from "@/components/dashboard/DashboardUI";
import { getSessionUserFromCookie } from "@/lib/auth";
import { MeusDadosForm } from "./MeusDadosForm";

export const metadata = {
  title: "Meus dados",
  description: "Complete seu cadastro e anexe documento e comprovante de residência.",
};

export default async function MeusDadosPage() {
  const user = await getSessionUserFromCookie();
  if (!user || user.role !== "CUSTOMER") {
    redirect("/login");
  }
  return (
    <div className="flex min-w-0 flex-col gap-6 sm:gap-8">
      <DashboardHero
        eyebrow="Cliente"
        title="Meus dados"
        description="Atualize seus dados de contato quando precisar."
      />
      <SectionCard
        title="Cadastro e documentos"
        description="Preencha os campos obrigatórios e envie os arquivos solicitados."
        variant="elevated"
      >
        <MeusDadosForm />
      </SectionCard>
    </div>
  );
}
