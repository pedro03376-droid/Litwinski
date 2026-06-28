# Migrations

TypeORM migrations. Generate with:

```
npm run migration:generate -- src/migrations/NomeDaMigration
npm run migration:run
```

The production app runs pending migrations automatically on boot (migrationsRun).
