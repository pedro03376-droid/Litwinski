import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adiciona a coluna "externalId" (código de origem) na tabela de goleiros e um
 * índice para busca rápida. Usada pela sincronização do app (espelho create-or-
 * update sem duplicatas). É idempotente (IF NOT EXISTS), então rodar mais de uma
 * vez é seguro. Em produção, o app aplica esta migração sozinho no boot
 * (migrationsRun), então basta redeployar.
 */
export class AddGoalkeeperExternalId1720000000000
  implements MigrationInterface
{
  name = 'AddGoalkeeperExternalId1720000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "goalkeepers" ADD COLUMN IF NOT EXISTS "externalId" character varying`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_goalkeepers_externalId" ON "goalkeepers" ("externalId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_goalkeepers_externalId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "goalkeepers" DROP COLUMN IF EXISTS "externalId"`,
    );
  }
}
