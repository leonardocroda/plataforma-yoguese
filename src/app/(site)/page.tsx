import Link from "next/link";

export default function SiteHome() {
  return (
    <main className="min-h-screen bg-[#faf8f4] p-8">
      <h1 className="text-3xl font-light text-[#6b6b6b]">Yogue-se Yoga</h1>
      <p className="mt-2 text-sm text-[#8a8a8a]">
        Site institucional - construcao em andamento.
      </p>
      <Link
        href="/experimental"
        className="mt-6 inline-block rounded bg-[var(--yoguese-salvia)] px-4 py-2 text-sm text-white"
      >
        Agendar aula experimental
      </Link>
    </main>
  );
}
