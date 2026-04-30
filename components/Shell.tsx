import { Nav } from "@/components/Nav";

export async function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <>
      <Nav />
      <main className="mx-auto max-w-7xl px-4 py-6">
        <h1 className="mb-4 text-2xl font-bold">{title}</h1>
        {children}
      </main>
    </>
  );
}
