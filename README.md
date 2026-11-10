# OG x o7 Free Fire Scrims

Tournament browsing, team registration, leaderboards, and organizer tools for OG x o7 Free Fire scrims.

## Local development

```powershell
npm install
npm run dev
```

The local server uses port 3000 by default. Copy `.env.example` to `.env.local` if you need to override local development settings.

## Production build

```powershell
npm run build
```

Public visitors can browse tournaments, teams, and the leaderboard. Team self-registration and team profile login stay disabled in production; squads are registered from the admin panel only.

## Firebase admin access

The admin panel at `/?panel=admin` uses Firebase Email/Password Authentication. Enable the Email/Password provider under Firebase Authentication > Sign-in method. Create the admin account there, then add a Firestore document at `/admins/{uid}` using that account's Authentication UID as the document ID and `{ "enabled": true }` as its data. Only those allowlisted UIDs can see admin data or write. The client cannot create or edit admin allowlist documents.

`firestore.rules` keeps public tournament/team/result reads enabled, makes registration logs admin-only, and allows all writes only for allowlisted admins. Deploy the rules after signing in to the Firebase CLI:

```powershell
npx firebase-tools login
npx firebase-tools deploy --only firestore:rules
```

In Firestore, add one document per admin under `admins`, with the Firebase Authentication UID as its document ID and `enabled` set to boolean `true`. Do not allow public writes to the `admins` collection. The current tournament data is retained.

## Cloudflare Pages

Build command: `npm run build`

Build output directory: `dist`

The `wrangler.jsonc` file contains the Pages project configuration. GitHub `main` is connected to Cloudflare Pages for automatic deployments.
