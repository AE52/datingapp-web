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
- `EXPO_PUBLIC_ENABLE_DEMO_LOGIN=true` opt-in olarak sadece development build'lerde demo login alanlarini doldurur.
- In development, web uses the current browser host and native uses the Expo dev server host automatically.
- In production, the app defaults to `https://vibeapi-185-246-113-9.sslip.io` until the Cloudflare-backed API hostname is repaired.
- Android cleartext HTTP is enabled only when the configured API origin is HTTP or when no explicit origin is set in development.

## Auth

- The app stores an authenticated session in `authSession`.
- Web builds scope the authenticated session to the current browser session instead of long-lived local storage.
- Requests to the backend origin automatically receive the bearer token.
- Logout clears the full session, not just the legacy user cache.
- Expo web export does not expose the admin surface in production; keep admin operations on native builds until a secure web admin boundary exists.

## Dev seed

- Backend `dev` profili yerel denemeler icin seed veri yukler.
- Demo login ipuclari varsayilan olarak kapali; gerekiyorsa `EXPO_PUBLIC_ENABLE_DEMO_LOGIN=true` ile development build'de acin.
