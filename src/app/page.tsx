import Link from "next/link";
import { revalidatePath } from "next/cache";


import { simulateBattle } from "@/lib/battle";
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

type SearchParams = {
  type?: string;
};

async function resolveSearchParams(
  searchParams?: SearchParams | Promise<SearchParams>
) {
  return searchParams ? await searchParams : {};
}

async function createCharacter(formData: FormData) {
  "use server";

  const name = String(formData.get("name") ?? "").trim();
  const type = String(formData.get("type") ?? "").toUpperCase();
  const health = Number(formData.get("health"));
  const attack = Number(formData.get("attack"));
  const defense = Number(formData.get("defense"));
  const speed = Number(formData.get("speed"));

  const isValidType = type === "ZOMBIE" || type === "ROBOT";
  const stats = [health, attack, defense, speed];
  const areStatsValid = stats.every((value) => Number.isFinite(value) && value > 0);

  if (!name || !isValidType || !areStatsValid) {
    return;
  }

  await prisma.character.create({
    data: {
      name,
      type: type as "ZOMBIE" | "ROBOT",
      health,
      attack,
      defense,
      speed,
    },
  });

  revalidatePath("/");
}

async function runBattle(formData: FormData) {
  "use server";

  const character1Id = Number(formData.get("character1"));
  const character2Id = Number(formData.get("character2"));

  if (!Number.isFinite(character1Id) || !Number.isFinite(character2Id)) {
    return;
  }

  if (character1Id === character2Id) {
    return;
  }

  const fighters: Character[] = await prisma.character.findMany({
    where: { id: { in: [character1Id, character2Id] } },
  });

  if (fighters.length !== 2) {
    return;
  }

  const fighterA = fighters.find((fighter) => fighter.id === character1Id);
  const fighterB = fighters.find((fighter) => fighter.id === character2Id);

  if (!fighterA || !fighterB) {
    return;
  }

  const outcome = simulateBattle(fighterA, fighterB);

  await prisma.battle.create({
    data: {
      character1Id: fighterA.id,
      character2Id: fighterB.id,
      winnerId: outcome.winnerId,
      turns: outcome.turns,
    },
  });

  revalidatePath("/");
}

export default async function Home({
  searchParams,
}: {
  searchParams?: SearchParams | Promise<SearchParams>;
}) {
  const { type } = await resolveSearchParams(searchParams);
  const normalizedType = type?.toUpperCase();
  const selectedType =
    normalizedType === "ZOMBIE" || normalizedType === "ROBOT"
      ? normalizedType
      : undefined;

  const characters: Character[] = await prisma.character.findMany({
    where: selectedType ? { type: selectedType } : undefined,
    orderBy: [{ type: "asc" }, { name: "asc" }],
  });

  const allCharacters: Character[] = await prisma.character.findMany({
    orderBy: [{ name: "asc" }],
  });

  const battles: BattleWithCharacters[] = await prisma.battle.findMany({
    orderBy: { id: "desc" },
    take: 10,
    include: {
      character1: true,
      character2: true,
      winner: true,
    },
  });

  const latestBattle: BattleWithCharacters | null = await prisma.battle.findFirst({
    orderBy: { id: "desc" },
    include: {
      character1: true,
      character2: true,
      winner: true,
    },
  });

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#f4f1eb,_#e8ecef_45%,_#e0e6ed_100%)]">
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-6 py-16">
        <header className="rounded-3xl border border-black/10 bg-white/80 p-8 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.8)] backdrop-blur">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="flex flex-col gap-4">
            <p className="text-xs font-semibold tracking-[0.3em] text-zinc-500">
              ZOMBIES VS ROBOTS
            </p>
            <h1 className="text-3xl font-semibold leading-tight text-zinc-900 sm:text-4xl">
              Listado SSR de personajes
            </h1>
            <p className="max-w-2xl text-base text-zinc-600">
              Esta vista se renderiza en el servidor y consulta la base de datos
              en cada request.
            </p>
            </div>
            <Link
              href="/battles"
              className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:border-zinc-400"
            >
              Ver historial completo
            </Link>
          </div>
        </header>

        <section className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-semibold text-zinc-700">
            Filtrar por tipo:
          </span>
          <Link
            href="/"
            className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
              !selectedType
                ? "border-zinc-900 bg-zinc-900 text-white"
                : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-400"
            }`}
          >
            Todos
          </Link>
          <Link
            href="/?type=ZOMBIE"
            className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
              selectedType === "ZOMBIE"
                ? "border-emerald-700 bg-emerald-700 text-white"
                : "border-zinc-200 bg-white text-zinc-600 hover:border-emerald-400"
            }`}
          >
            Zombies
          </Link>
          <Link
            href="/?type=ROBOT"
            className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
              selectedType === "ROBOT"
                ? "border-sky-700 bg-sky-700 text-white"
                : "border-zinc-200 bg-white text-zinc-600 hover:border-sky-400"
            }`}
          >
            Robots
          </Link>
        </section>

        <section className="rounded-3xl border border-black/10 bg-white p-6 shadow-[0_18px_50px_-40px_rgba(15,23,42,0.8)]">
          <div className="flex flex-col gap-3 border-b border-zinc-100 pb-4">
            <h2 className="text-lg font-semibold text-zinc-900">
              Crear personaje
            </h2>
            <p className="text-sm text-zinc-500">
              Completa los atributos y guarda un nuevo combatiente.
            </p>
          </div>
          <form action={createCharacter} className="grid gap-4 pt-6">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-2 text-sm font-medium text-zinc-700">
                Nombre
                <input
                  name="name"
                  required
                  placeholder="Ej: Ripper"
                  className="rounded-xl border border-zinc-200 px-4 py-2 text-sm text-zinc-800 outline-none transition focus:border-zinc-400"
                />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium text-zinc-700">
                Tipo
                <select
                  name="type"
                  required
                  className="rounded-xl border border-zinc-200 px-4 py-2 text-sm text-zinc-800 outline-none transition focus:border-zinc-400"
                >
                  <option value="ZOMBIE">ZOMBIE</option>
                  <option value="ROBOT">ROBOT</option>
                </select>
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-4">
              <label className="flex flex-col gap-2 text-sm font-medium text-zinc-700">
                Health
                <input
                  name="health"
                  type="number"
                  min="1"
                  required
                  className="rounded-xl border border-zinc-200 px-4 py-2 text-sm text-zinc-800 outline-none transition focus:border-zinc-400"
                />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium text-zinc-700">
                Attack
                <input
                  name="attack"
                  type="number"
                  min="1"
                  required
                  className="rounded-xl border border-zinc-200 px-4 py-2 text-sm text-zinc-800 outline-none transition focus:border-zinc-400"
                />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium text-zinc-700">
                Defense
                <input
                  name="defense"
                  type="number"
                  min="1"
                  required
                  className="rounded-xl border border-zinc-200 px-4 py-2 text-sm text-zinc-800 outline-none transition focus:border-zinc-400"
                />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium text-zinc-700">
                Speed
                <input
                  name="speed"
                  type="number"
                  min="1"
                  required
                  className="rounded-xl border border-zinc-200 px-4 py-2 text-sm text-zinc-800 outline-none transition focus:border-zinc-400"
                />
              </label>
            </div>
            <div className="flex items-center justify-end">
              <button
                type="submit"
                className="rounded-full bg-zinc-900 px-6 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800"
              >
                Guardar personaje
              </button>
            </div>
          </form>
        </section>

        <section className="grid gap-6 lg:grid-cols-[2fr,1fr]">
          <div className="rounded-3xl border border-black/10 bg-white p-6 shadow-[0_18px_50px_-40px_rgba(15,23,42,0.8)]">
            <div className="flex flex-col gap-3 border-b border-zinc-100 pb-4">
              <h2 className="text-lg font-semibold text-zinc-900">
                Simular batalla
              </h2>
              <p className="text-sm text-zinc-500">
                Elige dos personajes para ejecutar el combate.
              </p>
            </div>

            {allCharacters.length < 2 ? (
              <p className="py-8 text-sm text-zinc-500">
                Necesitas al menos dos personajes para simular una batalla.
              </p>
            ) : (
              <form action={runBattle} className="grid gap-4 pt-6">
                <label className="flex flex-col gap-2 text-sm font-medium text-zinc-700">
                  Personaje 1
                  <select
                    name="character1"
                    required
                    className="rounded-xl border border-zinc-200 px-4 py-2 text-sm text-zinc-800 outline-none transition focus:border-zinc-400"
                  >
                    {allCharacters.map((character) => (
                      <option key={character.id} value={character.id}>
                        {character.name} ({character.type})
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-2 text-sm font-medium text-zinc-700">
                  Personaje 2
                  <select
                    name="character2"
                    required
                    className="rounded-xl border border-zinc-200 px-4 py-2 text-sm text-zinc-800 outline-none transition focus:border-zinc-400"
                  >
                    {allCharacters.map((character) => (
                      <option key={character.id} value={character.id}>
                        {character.name} ({character.type})
                      </option>
                    ))}
                  </select>
                </label>
                <div className="flex items-center justify-end">
                  <button
                    type="submit"
                    className="rounded-full bg-zinc-900 px-6 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800"
                  >
                    Ejecutar combate
                  </button>
                </div>
              </form>
            )}

            <div className="mt-6 rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/70 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-400">
                Resultado reciente
              </p>
              {latestBattle ? (
                <div className="mt-2 text-sm text-zinc-700">
                  <p className="font-semibold text-zinc-900">
                    {latestBattle.character1.name} vs {latestBattle.character2.name}
                  </p>
                  <p className="text-xs text-zinc-500">
                    Ganador: {latestBattle.winner.name}
                  </p>
                  <p className="text-xs text-zinc-500">
                    Turnos: {latestBattle.turns}
                  </p>
                </div>
              ) : (
                <p className="mt-2 text-sm text-zinc-500">
                  Aun no hay resultados.
                </p>
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-black/10 bg-white p-6 shadow-[0_18px_50px_-40px_rgba(15,23,42,0.8)]">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
              <h2 className="text-lg font-semibold text-zinc-900">
                Historial reciente
              </h2>
              <span className="text-xs text-zinc-400">Ultimas 10</span>
            </div>

            {battles.length === 0 ? (
              <p className="py-8 text-sm text-zinc-500">
                Aun no hay batallas registradas.
              </p>
            ) : (
              <div className="flex flex-col gap-3 pt-5 text-sm">
                {battles.map((battle) => (
                  <div
                    key={battle.id}
                    className="rounded-2xl border border-zinc-100 bg-zinc-50/60 px-4 py-3"
                  >
                    <p className="font-semibold text-zinc-900">
                      {battle.character1.name} vs {battle.character2.name}
                    </p>
                    <p className="text-xs text-zinc-500">
                      Ganador: {battle.winner.name}
                    </p>
                    <p className="text-xs text-zinc-500">
                      Turnos: {battle.turns}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="rounded-3xl border border-black/10 bg-white p-6 shadow-[0_18px_50px_-40px_rgba(15,23,42,0.8)]">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
            <h2 className="text-lg font-semibold text-zinc-900">
              Personajes encontrados
            </h2>
            <span className="text-sm text-zinc-500">
              {characters.length} total
            </span>
          </div>

          {characters.length === 0 ? (
            <p className="py-10 text-center text-sm text-zinc-500">
              No hay personajes para este filtro.
            </p>
          ) : (
            <div className="grid gap-4 py-6 sm:grid-cols-2">
              {characters.map((character) => (
                <article
                  key={character.id}
                  className="rounded-2xl border border-zinc-100 bg-gradient-to-br from-white to-zinc-50 p-5 shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-zinc-900">
                      {character.name}
                    </h3>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold tracking-wide ${
                        character.type === "ZOMBIE"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-sky-100 text-sky-700"
                      }`}
                    >
                      {character.type}
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-zinc-600">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-zinc-400">
                        Health
                      </p>
                      <p className="text-base font-semibold text-zinc-800">
                        {character.health}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-zinc-400">
                        Attack
                      </p>
                      <p className="text-base font-semibold text-zinc-800">
                        {character.attack}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-zinc-400">
                        Defense
                      </p>
                      <p className="text-base font-semibold text-zinc-800">
                        {character.defense}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-zinc-400">
                        Speed
                      </p>
                      <p className="text-base font-semibold text-zinc-800">
                        {character.speed}
                      </p>
                    </div>
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
