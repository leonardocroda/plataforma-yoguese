export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-[#e8ded0] px-6 py-3 text-sm text-[#6b6b6b]">
        Yogue-se - Painel Admin (auth em feature futura)
      </header>
      {children}
    </div>
  );
}
