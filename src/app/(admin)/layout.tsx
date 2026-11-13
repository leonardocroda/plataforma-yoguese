import Link from "next/link";
import { eq } from "drizzle-orm";
import { logoutAction } from "../../modules/auth/actions";
import { requireAdminSession } from "../../modules/auth/services/session";
import { users } from "../../db/schema";
import { Button } from "../../modules/ui/components/kit";

const NAV_LINKS = [
  { href: "/grade", label: "Grade" },
  { href: "/alunos", label: "Alunos" },
  { href: "/experimentais", label: "Experimentais" },
  { href: "/planos", label: "Planos" },
  { href: "/creditos", label: "Créditos" },
  { href: "/feriados", label: "Feriados" },
];

/**
 * Shell da area logada (AUTH-01, SHELL-01, SHELL-02): nenhuma rota do grupo
 * responde sem sessao - o guard vive aqui, antes do render. A administradora
 * logada e identificada pelo nome e o "Sair" encerra a sessao.
 *
 * A pele e a do guia (tela "Admin: calendário e turma"): superfícies pena sobre
 * o papel, bordas pretas de 2px, ações em pílula, navegação sóbria e sem
 * mascote. Desktop-first: a linha única do topo só quebra em telas estreitas.
 */
export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Guard do grupo inteiro (AUTH-01, AUTH-09): sem sessão de ADMIN a rota
  // não responde - o papel e verificado junto com a sessao, nao so a presenca
  const session = await requireAdminSession();

  // O client so e necessario em tempo de execucao: o build roda sem
  // DATABASE_URL configurada.
  const { db } = await import("../../db");
  const [admin] = await db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, session.userId));

  return (
    <div className="min-h-screen">
      <header className="border-b-2 border-b-[var(--preto)] bg-[var(--pena)] px-5 py-3.5 sm:px-8">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-x-8 gap-y-3">
          <div className="flex flex-wrap items-center gap-x-7 gap-y-2">
            <span className="text-[17px] font-extrabold tracking-[-0.03em]">
              Yogue-se
            </span>
            <nav
              aria-label="Rotas da área administrativa"
              className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[14.5px] font-semibold text-[color:var(--grafite)]"
            >
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="rounded-[var(--r-sm)] hover:underline hover:decoration-2 hover:underline-offset-4"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3.5">
            <span className="text-[13.5px] text-[color:var(--cinza)]">
              {admin?.name ?? "Admin"}
            </span>
            <form action={logoutAction}>
              <Button type="submit" variant="sec" small>
                Sair
              </Button>
            </form>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1440px] px-5 py-7 sm:px-8">
        {children}
      </div>
    </div>
  );
}