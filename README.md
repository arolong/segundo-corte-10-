# Zombies vs Robots (SSR)

App web en Next.js con renderizado del lado del servidor (SSR). Permite crear personajes, simular batallas y guardar el historial en PostgreSQL usando Prisma.

## Antes de empezar

- Node.js 18+
- PostgreSQL (local o en la nube)
- Un `.env` con `DATABASE_URL`

Ejemplo de `.env`:

```
DATABASE_URL="postgresql://USER:PASSWORD@HOST/DB?sslmode=require"
```

## Instalacion y base de datos

```
npm install
npx prisma migrate dev --name init
npm run seed
```

## Ejecutar en local

```
npm run dev
```

Abre http://localhost:3000

## Que incluye

- Crear personajes desde la home
- Listar personajes y filtrar por tipo
- Simular batallas (turnos + ganador)
- Historial reciente en la home
- Historial completo en /battles

## Codigo fuente

### prisma/schema.prisma

```prisma
generator client {
	provider = "prisma-client-js"
}

datasource db {
	provider = "postgresql"
	url      = env("DATABASE_URL")
}

enum CharacterType {
	ZOMBIE
	ROBOT
}

model Character {
	id       Int           @id @default(autoincrement())
	name     String
	type     CharacterType
	health   Int
	attack   Int
	defense  Int
	speed    Int

	battlesAsCharacter1 Battle[] @relation("BattleCharacter1")
	battlesAsCharacter2 Battle[] @relation("BattleCharacter2")
	battlesWon          Battle[] @relation("BattleWinner")
}

model Battle {
	id           Int       @id @default(autoincrement())
	character1Id Int
	character2Id Int
	winnerId     Int
	turns        Int

	character1 Character @relation("BattleCharacter1", fields: [character1Id], references: [id])
	character2 Character @relation("BattleCharacter2", fields: [character2Id], references: [id])
	winner     Character @relation("BattleWinner", fields: [winnerId], references: [id])
}
```

### src/lib/db.ts

```ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
	globalForPrisma.prisma = prisma;
}
```

### src/lib/battle.ts

```ts
import type { Character } from "@prisma/client";

type BattleOutcome = {
	winnerId: number;
	turns: number;
};

type CombatantState = {
	id: number;
	health: number;
	attack: number;
	defense: number;
	speed: number;
};

function toCombatant(character: Character): CombatantState {
	return {
		id: character.id,
		health: character.health,
		attack: character.attack,
		defense: character.defense,
		speed: character.speed,
	};
}

function resolveTurnOrder(first: CombatantState, second: CombatantState) {
	if (first.speed === second.speed) {
		return [first, second] as const;
	}
	return first.speed > second.speed ? ([first, second] as const) : ([second, first] as const);
}

function calculateDamage(attacker: CombatantState, defender: CombatantState) {
	const rawDamage = attacker.attack - defender.defense * 0.5;
	return Math.max(1, Math.floor(rawDamage));
}

export function simulateBattle(character1: Character, character2: Character): BattleOutcome {
	const fighterA = toCombatant(character1);
	const fighterB = toCombatant(character2);

	const [first, second] = resolveTurnOrder(fighterA, fighterB);
	let turns = 0;

	while (fighterA.health > 0 && fighterB.health > 0) {
		const damageFirst = calculateDamage(first, second);
		second.health -= damageFirst;
		turns += 1;

		if (second.health <= 0) {
			break;
		}

		const damageSecond = calculateDamage(second, first);
		first.health -= damageSecond;
		turns += 1;
	}

	const winnerId = fighterA.health > 0 ? fighterA.id : fighterB.id;
	return { winnerId, turns };
}
```

### src/app/page.tsx

```tsx
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

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
	notice?: string;
	scope?: string;
};

async function resolveSearchParams(
	searchParams?: SearchParams | Promise<SearchParams>
) {
	return searchParams ? await searchParams : {};
}

function buildRedirect(returnTo: string | null, notice: string, scope: string) {
	const basePath = returnTo && returnTo.startsWith("?") ? `/${returnTo}` : "/";
	const url = new URL(basePath, "http://localhost");
	url.searchParams.set("notice", notice);
	url.searchParams.set("scope", scope);
	return `${url.pathname}${url.search}`;
}

async function createCharacter(formData: FormData) {
	"use server";

	const returnTo = String(formData.get("returnTo") ?? "").trim();
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
		redirect(buildRedirect(returnTo, "invalid", "character"));
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
	redirect(buildRedirect(returnTo, "created", "character"));
}

async function runBattle(formData: FormData) {
	"use server";

	const returnTo = String(formData.get("returnTo") ?? "").trim();
	const character1Id = Number(formData.get("character1"));
	const character2Id = Number(formData.get("character2"));

	if (!Number.isFinite(character1Id) || !Number.isFinite(character2Id)) {
		redirect(buildRedirect(returnTo, "invalid", "battle"));
	}

	if (character1Id === character2Id) {
		redirect(buildRedirect(returnTo, "duplicate", "battle"));
	}

	const fighters: Character[] = await prisma.character.findMany({
		where: { id: { in: [character1Id, character2Id] } },
	});

	if (fighters.length !== 2) {
		redirect(buildRedirect(returnTo, "missing", "battle"));
	}

	const fighterA = fighters.find((fighter) => fighter.id === character1Id);
	const fighterB = fighters.find((fighter) => fighter.id === character2Id);

	if (!fighterA || !fighterB) {
		redirect(buildRedirect(returnTo, "missing", "battle"));
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
	redirect(buildRedirect(returnTo, "done", "battle"));
}

export default async function Home({
	searchParams,
}: {
	searchParams?: SearchParams | Promise<SearchParams>;
}) {
	const { type, notice, scope } = await resolveSearchParams(searchParams);
	const normalizedType = type?.toUpperCase();
	const selectedType =
		normalizedType === "ZOMBIE" || normalizedType === "ROBOT"
			? normalizedType
			: undefined;

	const returnTo = selectedType ? `?type=${selectedType}` : "";

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
						<input type="hidden" name="returnTo" value={returnTo} />
						{scope === "character" && notice ? (
							<div
								className={`rounded-2xl border px-4 py-3 text-sm ${
									notice === "created"
										? "border-emerald-200 bg-emerald-50 text-emerald-700"
										: "border-amber-200 bg-amber-50 text-amber-700"
								}`}
							>
								{notice === "created"
									? "Personaje creado correctamente."
									: "Revisa los datos, todos los campos son obligatorios."}
							</div>
						) : null}
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
								<input type="hidden" name="returnTo" value={returnTo} />
								{scope === "battle" && notice ? (
									<div
										className={`rounded-2xl border px-4 py-3 text-sm ${
											notice === "done"
												? "border-emerald-200 bg-emerald-50 text-emerald-700"
												: "border-amber-200 bg-amber-50 text-amber-700"
										}`}
									>
										{notice === "done"
											? "Batalla registrada correctamente."
											: notice === "duplicate"
												? "Selecciona dos personajes diferentes."
												: "No se pudo registrar la batalla, revisa la seleccion."}
									</div>
								) : null}
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
```

### src/app/battles/page.tsx

```tsx
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
```

### src/app/globals.css

```css
@import "tailwindcss";

:root {
	--background: #ffffff;
	--foreground: #171717;
}

@theme inline {
	--color-background: var(--background);
	--color-foreground: var(--foreground);
	--font-sans: var(--font-geist-sans);
	--font-mono: var(--font-geist-mono);
}

@media (prefers-color-scheme: dark) {
	:root {
		--background: #0a0a0a;
		--foreground: #ededed;
	}
}

body {
	background: var(--background);
	color: var(--foreground);
	font-family: Arial, Helvetica, sans-serif;
}
```

### package.json

```json
{
	"name": "zombies-vs-robots-ssr",
	"version": "0.1.0",
	"private": true,
	"scripts": {
		"dev": "next dev",
		"build": "next build",
		"start": "next start",
		"lint": "eslint",
		"seed": "node prisma/seed.js"
	},
	"dependencies": {
		"@prisma/client": "^6.19.3",
		"next": "16.2.4",
		"react": "19.2.4",
		"react-dom": "19.2.4"
	},
	"devDependencies": {
		"@tailwindcss/postcss": "^4",
		"@types/node": "^20",
		"@types/react": "^19",
		"@types/react-dom": "^19",
		"eslint": "^9",
		"eslint-config-next": "16.2.4",
		"prisma": "^6.19.3",
		"tailwindcss": "^4",
		"typescript": "^5"
	}
}
```
