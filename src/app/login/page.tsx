import { redirect } from "next/navigation";
import { getSession } from "../../modules/auth/services/session";
import { LoginForm } from "./login-form";

/**
 * Tela de login (AUTH-02, AUTH-07): fora dos route groups, o guard do
 * (admin) nao a alcanca. Admin logada que abre /login vai direto a /grade.
 */
export default async function LoginPage() {
  const session = await getSession();
  if (session) {
    redirect("/grade");
  }

  return (
    <main className="min-h-screen bg-[var(--yoguese-off-white)] p-8 text-[var(--yoguese-cinza)]">
      <div className="mx-auto mt-16 w-full max-w-sm rounded-lg border border-[var(--yoguese-bege)] bg-white p-6">
        <h1 className="text-2xl font-light">Yogue-se</h1>
        <p className="mt-1 text-sm">Acesso da administração</p>
        <LoginForm />
      </div>
    </main>
  );
}
