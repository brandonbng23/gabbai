# Database

Run with Node.js 24 or newer. The database uses Node's built-in `node:sqlite` module;
there is no separate database server or additional package to install.

```sh
npm run db:init
npm run test:db
```

The server also initializes the database on startup. The default file is
`data/gabbai.sqlite`, resolved relative to the repository. Set
`GABBAI_DATABASE_PATH` to use a different location. Database files and SQLite
journal files are ignored by Git. Hosting must provide a persistent writable
directory for this file; an ephemeral filesystem will lose saved data.

## Relationships

Each user belongs to exactly one shul through `users.shul_id`. Querying users by
that field supplies the shul's membership list; no second list needs syncing.
The user's role is `member` or `admin`, with an optional administrator title.
Email addresses are normalized and unique across users, regardless of case.
Moving a user to another shul changes this same membership field.

`user_settings` and `shul_settings` have one row per owner. Creating a profile and
its settings is atomic. Foreign keys prevent orphaned records, prevent deleting
a shul that still has users, and remove settings when their owner is deleted.

User information: first name, last name, Hebrew name, email, phone, membership,
role, and title. Shul information: name, website, donation URL, email, phone, and
address. IDs are UUIDs. Profiles and settings have UTC creation/update metadata
(settings record only their update time).

## Usage

```js
import { openDatabase } from './backend/database/index.mjs';
import { getShulSchedule } from './backend/schedule.mjs';

const db = openDatabase();
try {
    const shul = db.createShul({
        name: 'Example Shul',
        settings: { hebYear: 5787, il: false, a: 7 },
    });
    const user = db.createUser({
        shulId: shul.id,
        firstName: 'Josh',
        lastName: 'Cohen',
        email: 'josh@example.com',
    });

    db.updateShulSettings(shul.id, { yontifs: { rh2: false } });
    db.setUserSettings(user.id, { notifications: { email: true } });
    const members = db.listShulUsers(shul.id);
    const userShul = db.getUserShul(user.id);
    const schedule = getShulSchedule(db, shul.id);
} finally {
    db.close();
}
```

Shul settings use the names and defaults from `core/settings.mts`: `hebYear`,
`il`, `a`, `hhRespect`, `yRespect`, `yontifs`, `triennial`, and `specialSeventh`.
Creating a shul requires an explicit active Hebrew year. Partial settings updates
merge nested holiday and triennial values. Unknown keys, incorrect types, aliyot
counts outside 1–7, and conflicting maftir settings are rejected.

User settings start as `{}`. Their product fields have not yet been defined;
`setUserSettings` replaces the entire JSON preferences object. The example
notification preference demonstrates storage only; it does not send email.

`getShul` and `getUser` include their settings. Missing records return `null`;
updates to missing records throw. `updateShul` and `updateUser` modify profile
fields only. `getUserByEmail` and `listShuls` are also available.

`GET /api/schedule?shul=<shul-id>` generates a public reading schedule from the
saved shul settings. An optional `year` query overrides the year for that request
without updating storage. The existing schedule endpoint without a shul retains
the default schedule. It does not return user contact information or preferences.

Profile writes currently use the backend repository, not public HTTP endpoints.
Login, credentials, authorization, registration records, and frontend profile
forms are separate follow-up work. The legacy in-memory `User`, `Admin`, and
`Shul` classes are not automatically persisted.

## Migrations

`schema_migrations` tracks applied numbered SQL migrations. Version 1 initializes
the four profile/settings tables in a transaction and is safe to reopen. Extend
the migration runner for subsequent versions; do not edit an applied migration.
