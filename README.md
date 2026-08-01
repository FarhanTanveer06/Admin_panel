# Admin Panel — Backend Developer Intern Assignment (Trends Bird Limited)

This is my submission for the assignment. It's an e-commerce admin dashboard — a Node/Express/PostgreSQL API with a React frontend that exercises it.

## Setup

You'll need Node.js and PostgreSQL installed.

**1. Install dependencies**

```bash
cd backend
npm install

cd ../frontend
npm install
```

**2. Environment variables**

Both `backend/` and `frontend/` have a `.env.example` showing what's needed. Copy each to a real `.env` and fill in your own values.

`backend/.env`:

**3. Migrate and seed**

I'm using Sequelize's `sync({ alter: true })` to create/update tables rather than versioned migration files — this is a known gap, noted below. To go from an empty database to a working one:

```bash
cd backend
node -e "require('./config/database').initializeDatabase().then(() => process.exit())"
node -e "require('./seed')().then(() => process.exit())"
```

The seed script creates every permission for the modules I've built, a Super Admin role with all of them, a limited "Catalog Viewer" role with almost none, and one test user for each.

**4. Run it**

Backend and frontend are two separate processes, need two terminals running at the same time.

```bash
cd backend
npm run dev
```
```bash
cd frontend
npm run dev
```
Then open `http://localhost:3000`.

## Seeded credentials

| Account | Email | Password | Access |
|---|---|---|---|
| Super Admin | admin@example.com | admin123 | everything |
| Catalog Viewer | limited@example.com | limited123 | read-only on category/brand/attribute/product, nothing else — mainly here to test that 403s actually work |

## Token strategy

I went with a JWT access token + refresh token, sent through the `Authorization: Bearer` header rather than cookies. The frontend stores both in localStorage and an axios interceptor attaches the access token to every request automatically.

The access token only lasts 15 minutes and only contains the user's ID — no role or permissions baked in. I did this deliberately: if permissions were inside the token and an admin changed someone's role, that person would keep acting on their old permissions until the token expired, since a signed JWT can't be edited after the fact. Instead, every request looks the user's role and permissions up fresh from the database through the auth guard.

The refresh token is stored server-side (not just trusted from the client), which is what makes logout actually mean something — it gets revoked in the database, not just cleared from the browser. It also rotates on every use, so a stolen or reused old refresh token stops working immediately.

## How access control works

Every protected route goes through two checks:
1. `authGuard` — verifies the JWT, loads the user with their role and that role's permissions, rejects with 401 if the token's missing/invalid/expired or the account is deactivated
2. `requirePermission('module:action')` — checks if that specific permission exists on the user, rejects with 403 if not

The frontend also hides buttons a user's role doesn't allow, but that's just UX — the real enforcement is entirely in these two backend guards, since a hidden button does nothing to stop someone hitting the API directly with Postman or a stolen token.

## Module status

| Module | Status |
|---|---|
| Authentication | Complete — login, refresh with rotation, real server-side logout, session endpoint, inactive accounts locked out |
| Permission | Complete — group + action creation together, normalization, cascading deletes handled |
| Role | Complete — CRUD, refuses deleting a role still assigned to users, guards against removing the last role:update holder |
| User | Complete — role required on creation, can't change your own role, activate/deactivate, search/filter/pagination |
| Media | Complete — single + bulk upload, real content-type checking (not just trusting the file extension), auto thumbnails, library search/filter, metadata editing |
| Category | Complete — unlimited nesting, tree endpoint, blocks circular parent references, unique slugs, won't delete a category with existing children |
| Brand | Not attempted |
| Attribute | Not attempted |
| Product | Not attempted |

Frontend screens built: login, dashboard home with permission-based summary cards, a sidebar that only shows what your role allows, and full pages for Roles, Users, Media, and Categories.

## Live deployment

- Frontend: https://admin-panel-du3f.onrender.com
- Backend: https://admin-panel-6kso.onrender.com
- Note: this is Render's free tier, so the backend spins down after 15 minutes of no traffic — the first request after it's been idle can take 30-60 seconds while it wakes back up.

## API testing

Postman collection is included (`admin-panel-api-collection.json`), covering every route I built — including a few requests specifically meant to fail (a low-privilege token hitting an admin-only route, and no token at all), so you can see the 403/401 behavior directly.

## Known issues

- Schema is managed with `sequelize.sync({ alter: true })` rather than proper versioned migrations. This got me into trouble once already — I temporarily used `force: true` to fix a broken initial deploy on Render, forgot to revert it in time, and it wiped some manually-created test data on a couple of redeploys before I caught it. It's back to `alter: true` now.
- Brand, Attribute and Product modules aren't built.
- Media's "still attached to a product" delete check can't be fully tested yet since Product doesn't exist to attach to it.
- No automated tests yet.
- Free-tier hosting cold-start delay noted above.

## A couple of things worth being upfront about

- User deletion is a [FILL IN: hard delete / soft delete — check your deleteUser function] delete.
- A role change takes effect on the user's very next request, not their next login, since permissions are looked up fresh every time rather than cached anywhere.