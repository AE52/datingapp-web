# VibeApp Mobile

Expo Router client for the VibeApp safety/location product.

## Scripts

```bash
npm install
npm run lint
npm run typecheck
npm run build:web
npm start
```

## Runtime config

- `EXPO_PUBLIC_API_ORIGIN` overrides the API base origin.
- `EXPO_PUBLIC_API_PORT` overrides the local backend port in development. Default: `8080`.
- In development, web uses the current browser host and native uses the Expo dev server host automatically.
- In production, the app defaults to `https://api.datingapp.erenozdemir.com.tr`.
- Android cleartext HTTP is enabled only when the configured API origin is HTTP or when no explicit origin is set in development.

## Auth

- The app stores an authenticated session in `authSession`.
- Requests to the backend origin automatically receive the bearer token.
- Logout clears the full session, not just the legacy user cache.

## Demo login

- `eren@example.com / VibeApp!2026`
