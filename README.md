# FieldLink

A dependency-free full-stack starter for a nearby-farmer marketplace. It now includes a local SQLite database, password-based login, and persistent server sessions.

## Run locally

```powershell
npm start
```

Open `http://localhost:3000`.

## Security model in this prototype

- Public registration creates **customer** accounts only. There is no public administrator, farmer, or delivery signup route.
- Passwords are salted and hashed with Node's `scrypt`; browser sessions use HTTP-only, SameSite cookies and expire after seven days.
- Admin operations are checked in API handlers, and significant changes are recorded in SQLite audit records.
- Order transitions are validated on the server by both the authenticated role and current state. Farmers are limited to their assigned farm.

## Create the first administrator

This must happen locally or in a protected deployment console—never through the website.

```powershell
$env:BOOTSTRAP_ADMIN_SECRET = "create-a-long-random-secret"
node create-admin.js admin@example.com "Site Administrator" "UseA12PlusCharacterPassword!"
```

Then sign in through the website. The local database is stored in `fieldlink.db`; include it in backups and exclude it from source control.

## Create a farmer account for inventory management

```powershell
$env:BOOTSTRAP_ADMIN_SECRET = "create-a-long-random-secret"
node provision-staff.js farmer farmer@example.com "Green Basket Owner" "UseA12PlusCharacterPassword!" f1
```

Sample farms use IDs `f1`, `f2`, and `f3`. A farmer can manage only the inventory belonging to their linked farm.

## Production deployment checklist

This app is already a working full-stack Node website, but the current SQLite database is suitable for a prototype and demo environment. For a public production deployment, use the following checklist:

1. Deploy the app behind HTTPS with a custom domain.
2. Set strong environment variables in the hosting platform, including `BOOTSTRAP_ADMIN_SECRET`.
3. Keep public registration limited to `customer` accounts only.
4. Store admin creation in a trusted provisioning step, never through the browser.
5. Move from SQLite to PostgreSQL/Supabase before real production traffic.
6. Configure a map provider only when you have an API key; the app already supports a manual location fallback.

## Deploy to Render

1. Push this repository to GitHub.
2. In Render, create a new Web Service from the repo.
3. Use the default Node build and start commands:

```bash
npm install
npm start
```

4. Add environment variables from `.env.example`:

```bash
PORT=3000
BOOTSTRAP_ADMIN_SECRET=your-long-random-secret
MAPS_API_KEY=
```

5. Deploy the service and connect a custom domain.

> For production, migrate the database from SQLite to Supabase or a hosted PostgreSQL instance and keep the admin bootstrap secret out of the browser and source control.
