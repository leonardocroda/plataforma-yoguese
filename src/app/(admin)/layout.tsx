import Link from "next/link";
import { eq } from "drizzle-orm";
import { logoutAction } from "../../modules/auth/actions";
import { requireAdminSession } from "../../modules/auth/services/session";
import { users } from "../../db/schema";

const NAV_LINKS = [
  { href: "/grade", label: "Grade" },
  { href: "/alunos", label: "Alunos" },
  { href: "/planos", label: "Planos" },
  { href: "/creditos", label: "Créditos" },
  { href: "/feriados", label: "Feriados" },
];

/**
 * Shell da area logada (AUTH-01, SHELL-01, SHELL-02): nenhuma rota do grupo
 * responde sem sessao - o guard vive aqui, antes do render. A administradora
 * logada e identificada pelo nome e o "Sair" encerra a sessao.
 */
export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Guard do grupo inteiro (AUTH-01, AUTH-09): sem sessao de ADMIN a rota
  // nao responde - o papel e verificado junto com a sessao, nao so a presenca
  const session = await requireAdminSession();

  // O client so e necessario em tempo de execucao: o build roda sem
  // DATABASE_URL configurada.
  const { db } = await import("../../db");
  const [admin] = await db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, session.userId));

  return (
    <div className="min-h-screen bg-[var(--yoguese-off-white)] text-[var(--yoguese-cinza)]">
      <header className="border-b border-[#e8ded0] bg-white px-6 py-3">
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm">Yogue-se - Painel Admin</p>
          <form action={logoutAction}>
            <button
              type="submit"
              className="rounded border border-[var(--yoguese-bege)] px-2 py-0.5 text-xs hover:bg-[var(--yoguese-off-white)]"
            >
              Sair
            </button>
          </form>
        </div>
        <nav className="mt-2 flex flex-wrap items-center gap-4 text-xs">
          {NAV_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="hover:underline">
              {link.label}
            </Link>
          ))}
        </nav>
        <p className="mt-1 text-xs text-[var(--yoguese-salvia)]">
          {admin?.name ?? "Admin"} logada
        </p>
      </header>
      {children}
    </div>
  );
}
