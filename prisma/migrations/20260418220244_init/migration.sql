-- CreateEnum
CREATE TYPE "CharacterType" AS ENUM ('ZOMBIE', 'ROBOT');

-- CreateTable
CREATE TABLE "Character" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "type" "CharacterType" NOT NULL,
    "health" INTEGER NOT NULL,
    "attack" INTEGER NOT NULL,
    "defense" INTEGER NOT NULL,
    "speed" INTEGER NOT NULL,

    CONSTRAINT "Character_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Battle" (
    "id" SERIAL NOT NULL,
    "character1Id" INTEGER NOT NULL,
    "character2Id" INTEGER NOT NULL,
    "winnerId" INTEGER NOT NULL,
    "turns" INTEGER NOT NULL,

    CONSTRAINT "Battle_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Battle" ADD CONSTRAINT "Battle_character1Id_fkey" FOREIGN KEY ("character1Id") REFERENCES "Character"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Battle" ADD CONSTRAINT "Battle_character2Id_fkey" FOREIGN KEY ("character2Id") REFERENCES "Character"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Battle" ADD CONSTRAINT "Battle_winnerId_fkey" FOREIGN KEY ("winnerId") REFERENCES "Character"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
