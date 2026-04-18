import Link from "next/link";

import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

type Character = {
  id: number;
  name: string;
  type: "ZOMBIE" | "ROBOT";
  health: number;
  attack: number;
  defense: number;
  speed: number;
};

type BattleWithCharacters = {
  id: number;
  character1Id: number;
  character2Id: number;
  winnerId: number;
  turns: number;
  character1: Character;
  character2: Character;
  winner: Character;
};

export default async function BattlesPage() {
  const battles: BattleWithCharacters[] = await prisma.battle.findMany({
    orderBy: { id: "desc" },
    include: {
      character1: true,
      character2: true,
      winner: true,
    },
  });

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#f4f1eb,_#e8ecef_45%,_#e0e6ed_100%)]">
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-16">
        <header className="flex items-center justify-between rounded-3xl border border-black/10 bg-white/80 p-8 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.8)] backdrop-blur">
          <div className="flex flex-col gap-3">
            <p className="text-xs font-semibold tracking-[0.3em] text-zinc-500">
              ZOMBIES VS ROBOTS
            </p>
            <h1 className="text-3xl font-semibold text-zinc-900 sm:text-4xl">
              Historial de batallas
            </h1>
            <p className="text-sm text-zinc-600">
              Resultados registrados en la base de datos.
            </p>
          </div>
          <Link
            href="/"
            className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:border-zinc-400"
          >
            Volver
          </Link>
        </header>

        <section className="rounded-3xl border border-black/10 bg-white p-6 shadow-[0_18px_50px_-40px_rgba(15,23,42,0.8)]">
          {battles.length === 0 ? (
            <p className="py-10 text-center text-sm text-zinc-500">
              Todavia no hay batallas registradas.
            </p>
          ) : (
            <div className="grid gap-4">
              {battles.map((battle) => (
                <article
                  key={battle.id}
                  className="rounded-2xl border border-zinc-100 bg-zinc-50/70 p-5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-zinc-900">
                        {battle.character1.name} vs {battle.character2.name}
                      </p>
                      <p className="text-xs text-zinc-500">
                        {battle.character1.type} vs {battle.character2.type}
                      </p>
                    </div>
                    <div className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                      Ganador: {battle.winner.name}
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-4 text-xs text-zinc-500">
                    <span>Turnos: {battle.turns}</span>
                    <span>ID batalla: {battle.id}</span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
