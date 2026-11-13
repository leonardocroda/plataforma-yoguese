import { redirect } from "next/navigation";
import Image from "next/image";
import { getSession } from "../../modules/auth/services/session";
import { LoginForm } from "./login-form";

/**
 * Tela de login (AUTH-02, AUTH-07): fora dos route groups, o guard do
 * (admin) nao a alcanca. Admin logada que abre /login vai direto a /grade.
 * A composicao e a do guia: cartao pena centralizado no papel, com o logo,
 * os campos no estilo do guia e um unico botao preto.
 */
export default async function LoginPage() {
  const session = await getSession();
  if (session) {
    redirect("/grade");
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-10">
      <div className="w-full max-w-[380px] rounded-[var(--r-lg)] border-2 border-[var(--preto)] bg-[var(--pena)] p-7">
        <Image
          src="/assets/logo.png"
          alt="Yogue-se"
          width={343}
          height={72}
          className="mb-5 h-[34px] w-auto"
        />
        <h1 className="mb-1 text-[26px] tracking-[-0.03em]">Yogue-se</h1>
        <p className="mb-5 text-[15px] text-[color:var(--cinza)]">
          Área da professora.
        </p>
        <LoginForm />
      </div>
    </main>
  );
}