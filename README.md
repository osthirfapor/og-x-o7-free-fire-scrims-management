# OG x o7 Free Fire Scrims

Tournament browsing, team registration, leaderboards, and organizer tools for OG x o7 Free Fire scrims.

## Local development

```powershell
npm install
npm run dev
```

The local server uses port 3000 by default. Copy `.env.example` to `.env.local` if needed. Local-only admin access is configured in the ignored `.env.local` file; keep those credentials out of GitHub.

## Production build

```powershell
npm run build
```

Production builds are read-only: team registration and admin editing are disabled. This keeps the live Firebase project from accepting public writes until a secure production authentication flow is set up.

## Firebase read-only rules

`firestore.rules` allows public reads of tournaments, registered teams, and match results, and denies writes. Deploy these rules to the Firebase project before publishing the site:

```powershell
npx firebase-tools deploy --only firestore:rules
```

The Firebase Console must have Firestore Rules deployment access for the signed-in account. The current live tournament data is retained.

## Cloudflare Pages

Build command: `npm run build`

Build output directory: `dist`

The `wrangler.jsonc` file contains the Pages project configuration. Connect the public GitHub repository to Cloudflare Pages after the read-only Firebase rules have been deployed.
