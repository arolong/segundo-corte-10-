const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  await prisma.battle.deleteMany();
  await prisma.character.deleteMany();

  await prisma.character.createMany({
    data: [
      {
        name: "Ripper",
        type: "ZOMBIE",
        health: 120,
        attack: 32,
        defense: 10,
        speed: 12,
      },
      {
        name: "Gloom",
        type: "ZOMBIE",
        health: 140,
        attack: 28,
        defense: 14,
        speed: 9,
      },
      {
        name: "Howler",
        type: "ZOMBIE",
        health: 110,
        attack: 35,
        defense: 8,
        speed: 14,
      },
      {
        name: "Axiom",
        type: "ROBOT",
        health: 130,
        attack: 30,
        defense: 16,
        speed: 11,
      },
      {
        name: "Pulse",
        type: "ROBOT",
        health: 100,
        attack: 38,
        defense: 9,
        speed: 16,
      },
      {
        name: "Titan",
        type: "ROBOT",
        health: 160,
        attack: 26,
        defense: 20,
        speed: 7,
      },
    ],
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
