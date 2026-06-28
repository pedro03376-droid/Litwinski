import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { entities } from './database.config';

/**
 * Standalone DataSource used by the TypeORM CLI for migrations
 * (migration:generate / migration:run / migration:revert).
 *
 * The running app uses databaseConfig() via Nest; this mirrors its connection
 * settings from environment variables so the CLI can diff the schema.
 */
const isProd = process.env.NODE_ENV === 'production';
const databaseUrl = process.env.DATABASE_URL;

export default new DataSource({
  type: 'postgres',
  ...(databaseUrl
    ? { url: databaseUrl }
    : {
        host: process.env.DB_HOST ?? 'localhost',
        port: Number(process.env.DB_PORT ?? 5432),
        database: process.env.DB_NAME ?? 'gkhub',
        username: process.env.DB_USER ?? 'gkhub',
        password: process.env.DB_PASSWORD ?? 'gkhub_secret',
      }),
  entities,
  migrations: [__dirname + '/../migrations/*.{ts,js}'],
  synchronize: false,
  ssl: isProd ? { rejectUnauthorized: false } : false,
});
