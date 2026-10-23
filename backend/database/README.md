# Database

Run with Node.js 24 or newer. The database uses Node's built-in `node:sqlite` module;
there is no separate database server or additional package to install.

```sh
npm run db:init
npm run test:db
npm run test:api
npm run test:auth
npm run test:dev
```

The server also initializes the database on startup. The default file is
`data/gabbai.sqlite`, resolved relative to the repository. Set
`GABBAI_DATABASE_PATH` to use a different location. Database files and SQLite
journal files are ignored by Git. Hosting must provide a persistent writable
directory for this file; an ephemeral filesystem will lose saved data.

## Frontend development

```sh
npm run dev
```

This starts the backend on `http://localhost:3000` and Vite on
`http://localhost:5173`. Open the Vite URL. Ctrl+C stops both processes; if either
server exits, the other is stopped too. Frontend changes reload through Vite;
restart the combined command after backend changes. Use `npm run dev:frontend`
or `npm run dev:backend` to run either server separately.

The combined command uses `data/gabbai.dev.sqlite` and creates a Demo Shul and
Demo User on its first run. Subsequent runs keep their saved settings. The normal
`npm start` command continues to use `data/gabbai.sqlite` and serves the built
frontend. `PORT` changes the backend port and the combined command adjusts the
Vite proxy automatically. Frontend flags can be passed as `npm run dev -- --port 5174`.

To use your existing database instead of demo data:

```sh
GABBAI_DATABASE_PATH=./data/gabbai.sqlite npm run dev
```

An explicit database path is never seeded. Optionally set `GABBAI_DEV_USER_ID`
to an existing user UUID to load that profile during local development. This is
an optional local development identity. Real sessions take precedence, and
explicit sign-out suppresses this fallback. User IDs cannot be selected through
query parameters. Development binds the
backend to loopback; browser API requests use the same-origin Vite proxy.

The frontend loads the current user from `/api/me`, reads their assigned shul
from `/api/shuls/:id`, and generates its schedule from saved settings. The user's
membership selects their active shul. Without a current user, a `shul` URL
parameter allows viewing that shul's public schedule and guest registration.
Shul changes for signed-in users will belong in the future user settings page.
My Shul displays the saved profile and reading preferences. The development
user's first name appears in the greeting. The guest form starts blank so it
does not accidentally submit the signed-in profile's email as a guest.
My Preferences supports editing the current user's title, first and last name,
Hebrew name, email, and phone through `PATCH /api/me`. The endpoint uses the
current identity, validates a partial profile update, and rejects changes to
IDs, role, membership, or stored preferences. Duplicate emails return a conflict
without saving any fields. The form includes field/section resets and save
feedback. Sign-in & Security lets the authenticated user set or change a password.
Online registration supports both the current profile and guest details.

## Sign-in and account registration

`/signin` and `/signup` provide email/password access. The navbar links to sign-in,
preferences, and sign-out; protected pages without a user show the sign-in form.
Registration requires a predefined title, first/last name, email, a 12–128 character
password, and a four-letter shul code. Hebrew name and phone are optional. New
accounts always become members of the code's shul, including `DEMO` when seeded.
Existing profiles cannot be claimed just by supplying their email. Existing seeded
users can open My Preferences → Sign-in & Security under their trusted development
identity and set a password for their own account. Public email verification,
password-recovery email, and guest-to-member account claiming are not implemented.

On `/signin`, **Sign in to demo** restores access to the existing sample account
after signing out, including when its profile email has been edited. This creates
a normal session without needing a shared password or replacing any saved password.
It is available only during development with the `DEMO` shul's configured sample
identity, or when preview mode is explicitly enabled. Ordinary production deployments
do not offer demo sign-in.

- `POST /api/auth/register`: create the member, password hash, and session atomically.
- `POST /api/auth/signin`: verify email/password, rotate the current session.
- `GET /api/auth/options`: report whether demo sign-in is available.
- `POST /api/auth/demo`: sign in to the configured sample identity in development/preview.
- `POST /api/auth/signout`: revoke the session and suppress demo fallback in this browser.
- `GET /api/auth/password`: report whether the current account has a password.
- `POST /api/auth/password`: set/change the current account's password; changing
  an existing password requires the current password and revokes other sessions.

Version 14 adds `user_credentials`, `user_sessions`, and `auth_attempts`. Passwords
use salted scrypt (`N=32768, r=8, p=3`); raw passwords are never stored or returned.
Sessions use random 256-bit tokens, stored as SHA-256 hashes in SQLite, and expire
after seven days. Cookies are HttpOnly and SameSite=Lax, with Secure enabled
outside development. Deploy production behind HTTPS. With one trusted reverse
proxy terminating TLS, set `GABBAI_TRUST_PROXY=true` so origin checks use HTTPS.
Mutating requests reject cross-site browser origins. Registration and sign-in
attempts are rate-limited with persistent 15-minute buckets; application permissions
always use the current database role and membership for the session user.

The normal development Vite proxy preserves same-origin auth requests and cookies.
`npm run dev` keeps its opt-in seed identity for requests without a session cookie;
real sessions override it, including for newly registered members. Production has
no demo fallback unless `GABBAI_PREVIEW_MODE=true` is explicitly configured.
Credentials and sessions persist with the database across restarts. A trusted
operator can provision an existing profile using `hashPassword()` and
`database.setPasswordHash(userId, hash)`; this is never a public user-ID endpoint.

Implementation references: [Node crypto](https://nodejs.org/docs/latest-v24.x/api/crypto.html),
[OWASP session management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html).

## Render preview

The repository's `render.yaml` defines a free Node web service that serves the
built React app and API together. Create a Render Blueprint from this repository
to use it. For an existing Render web service, set these values manually:

| Setting | Value |
| --- | --- |
| Root directory | Repository root (leave blank) |
| Build command | `npm ci` (postinstall installs and builds the frontend) |
| Start command | `npm start` |
| Health check path | `/api/test` |
| `NODE_VERSION` | `24.18.0` |
| `NODE_ENV` | `production` |
| `GABBAI_PREVIEW_MODE` | `true` |
| `GABBAI_DATABASE_PATH` | `./data/gabbai.preview.sqlite` |

Preview mode supplies a shared Demo User and Demo Shul so the frontend works
without requiring a sign-in. Records are created at server startup if missing; existing
demo settings are preserved on subsequent starts when the database survives.
Demo contact information is synchronized from `backend/database/demo.mjs` on
startup, including for existing demo records. This synchronization is limited to
the demo user's shul and does not change saved reading settings or user preferences.
The demo user's missing title, Hebrew name, and phone are populated with sample
values. Known dummy member profiles in the demo shul also receive missing Hebrew
names and fictional 202-555-01xx phone numbers. Existing profile values are preserved.
The frontend fetches the saved shul profile on page load, so refresh the page
after updating a profile in the database. Editing the demo seed requires a server
restart (or a Render redeploy) to apply its updated information.
The demo user belongs to its own demo shul; unrelated users are never selected.
The frontend still derives its shul only from that user's membership, with no
shul selector or shul/year banner.

The preview database is separate from the normal application database. Free
Render services have ephemeral storage, so demo data resets after restarts or
redeploys and is recreated automatically. No persistent disk is needed for this
preview. Preview mode is opt-in; ordinary deployments still require login.
All preview visitors see the same sample profile.

To test this mode locally after `npm run build`:

```sh
NODE_ENV=production GABBAI_PREVIEW_MODE=true npm start
```

Open `http://localhost:3000`. Render supplies its own `PORT`, which the server
already uses while binding to `0.0.0.0`.

## Relationships

Each user belongs to exactly one shul through `users.shul_id`. Querying users by
that field supplies the shul's membership list; no second list needs syncing.
The user's role is `guest`, `member`, or `admin`, with an optional administrator title.
Guest registration requires a predefined title, first name, last name, and email.
Hebrew name is optional; phone is not collected. Titles are shared between the
form and backend in `interfaces/titles.mts`. Guests can be assigned as readers but
have no administrator permissions. Version 7 extends the role constraint while
preserving existing profiles, settings, and reader assignments. Online registration uses `POST /api/shuls/:id/readings/register` with
`{ dateString, desc, aliyah }` for the current profile, or those fields plus
`guest: { title, firstName, lastName, hebrewName?, email }` for a guest. Guest requests
cannot set a user ID or role. Email identifies an existing guest in the same
shul, regardless of later name/title differences or omitted Hebrew names. All
registrations using that normalized email share one user and reading history.
A successful registration replaces the guest's saved title and names with the
latest submitted details without granting account access. An omitted Hebrew name
is preserved; an explicitly blank value clears it. Existing
member/admin emails or profiles from another shul require the associated profile.
Availability checks and guest creation/assignment run in one write transaction;
locked, hidden, missing, or already assigned aliyot cannot be registered.
Responses contain only confirmation, and failed registrations save no changes,
including no profile updates. Member/admin profiles are never overwritten by
guest registration.
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

`PATCH /api/shuls/:id/users` publishes the Users & Permissions section atomically.
Each change has `userId`, `previousRole`, and `role` (`admin`, `member`, or `null`
to discard the association), or a `profile` patch and matching `previousProfile`
values for edited fields. Profile edits support title, first/last/Hebrew name,
email, and phone for members and guests. The pencil opens an editor in normal
page flow beneath that user; its changes join the section log and Publish batch.
The compact editor also previews picture uploads, removals, and resets. Picture
changes use `picture` (PNG data URL or null) and `previousPictureUrl` for stale
change detection, and commit in the same transaction as fields and role changes.
Selecting an image only changes the draft; the saved card updates after Publish.
`GET /api/shuls/:id/users/:userId/profile` provides these six fields only to the
owning shul's admins. Profile edits reject stale values, invalid fields, and email
conflicts atomically with role changes. Only another administrator of the same shul may
promote members, demote administrators, or discard members and guests. Self
changes, guest promotions, admin removals, duplicate users, and stale roles are
rejected. The UI stages changes in the section log until Publish Changes; Reset
restores saved values. Failed batches keep all saved users unchanged.

Version 13 allows a user's `shulId` to be null. Discarding clears this association
and the user's assignments in that shul while preserving their account, profile,
picture, and preferences. Creating a user still requires a valid shul ID or code.

`GET /api/users/:id` supplies the read-only user view at `/userView?user=<id>`.
Only signed-in members and admins from the same shul may access it, including
when the viewed user is a guest. The response contains name, Hebrew name, title,
role, optional picture URL, shul name, and assigned-reading count. Email, phone,
settings, and individual reading assignments are excluded. The view has no edit
controls or save actions; the eye button in Users & Permissions opens it.

Version 10 introduces persistent, unique shul join codes. Version 11 replaces
numeric codes with four uppercase letters; the demo shul keeps `DEMO`, which is
reserved from automatic allocation. Existing numeric codes are reassigned once.
Version 12 restores `DEMO` using the original demo shul snapshot when its user's
email has changed, preserving edited profiles and other shul codes.
Codes remain unchanged when contact details or settings are edited. The shul
information and administration pages display the code.

`GET /api/shuls/by-code/:code` resolves a code to `{ id, name }`. User creation
can pass `shulCode` instead of `shulId`; the database resolves membership and
rejects unknown codes before creating the user. Codes accept surrounding spaces
and are case-insensitive. Account registration uses this lookup to assign new
members to their shul. Guest reading
registration continues to use the shul from the reading link.

`schema_migrations` tracks applied numbered SQL migrations. Version 1 initializes
the four profile/settings tables. Version 2 adds `shul_initial_versions` and
captures each new shul's initial contact information and settings atomically at
creation. Later saves never replace that snapshot. Existing shuls receive their
current saved values as the earliest available snapshot, marked `migration`;
values overwritten before this migration cannot be reconstructed.

`GET /api/shuls/:id/initial-version` is restricted to that shul's administrator.
The admin form loads the snapshot as unsaved edits; normal profile/settings save
endpoints apply those edits after review. Reset controls instead restore the
latest saved values, either per field, per section, or across the whole form.
Migrations run transactionally and are safe to reopen; do not edit an applied migration.

Version 3 adds `reading_locks`, keyed by shul, reading date/name, and aliyah slot.
Slot 0 stores the whole-reading lock; slots 1–7 are aliyot, 8 is maftir, and 9 is
haftarah. Schedule generation overlays saved locks onto the reading data, with
new readings unlocked by default. Whole-reading locks preserve individual locks
so those choices remain when the reading is unlocked.

`PATCH /api/shuls/:id/readings/lock` accepts `{ dateString, desc, locked, aliyah? }`.
It requires an administrator of that shul and validates that the reading and
optional aliyah exist in its current schedule. Omit `aliyah` to lock the whole
reading. The response contains the updated reading.

The admin UI keeps reading adjustments as local drafts and publishes them with
`PATCH /api/shuls/:id/readings/locks`, accepting `{ changes: [...] }` with the same
fields per change. Every entry is validated before a single transaction saves
the batch; a failed publication saves none of the changes. The response contains
each affected reading once. Reset discards local drafts, and publication updates
the schedule used by the member-facing pages. Search changes do not discard drafts.

Version 6 adds `reading_aliyah_counts`, keyed by shul and reading date/name.
The batch adjustments endpoint also accepts `{ dateString, desc, aliyahCount }`.
An integer from 1 to 7 overrides the schedule rule for that reading; `null`
removes the override. Counts are limited to the available verse ranges, exclude
maftir and haftarah, and persist across schedule rule changes. Saved assignments
and locks for hidden slots are retained. Count changes are applied before
validating other adjustments, allowing newly visible aliyot to receive readers
or locks in the same atomic publication.

Version 8 adds `user_pictures` and `shul_pictures`. Each owner has at most one
PNG stored in SQLite, alongside a version used to refresh browser caches.
Pictures are included in the same database backup and persistence lifecycle as
profiles; no separate uploads directory is needed.

My Preferences uploads to `PUT /api/me/picture`; shul administrators upload to
`PUT /api/shuls/:id/picture`. Both accept PNG bytes up to 1 MB and dimensions up
to 1024 × 1024. `DELETE` on those endpoints removes the current picture. User
uploads always target the current identity, and shul uploads require an admin
from that shul. Versioned picture URLs in profiles and reader assignments use
`GET /api/users/:id/picture` or `GET /api/shuls/:id/picture` and can be displayed
on public-facing cards.

The browser accepts PNG, JPG, and WebP source images up to 10 MB, crops the center
to a square, and resizes to 512 × 512. Selection and removal stay as local drafts
until Save Changes or Publish Changes is clicked. Reset restores the saved picture.
The user and shul profile PATCH endpoints accept an optional `picture` value:
a PNG data URL to replace the image, or `null` to remove it. Picture changes and
profile fields commit in one transaction, so failed saves retain the old image
and fields. Missing or unreadable pictures display initials.

Version 9 indexes assignments by user. User profiles and the administrator's
shul-user list expose `assignedReadings`, an array of `{ dateString, desc, aliyah }`
ordered by date, reading name, and aliyah number. The list is derived directly
from `reading_readers`, scoped to the user's current shul. Registration,
reassignment, and removal update it automatically; users without assignments
receive an empty array. Stored assignments to temporarily hidden aliyot remain
associated with the user. This list cannot be edited through profile updates.
The array is always defined, including on schedule reader summaries and core
user profiles. Entries contain only reading identifiers, never nested user
profiles, so serialization stays nonrecursive.
