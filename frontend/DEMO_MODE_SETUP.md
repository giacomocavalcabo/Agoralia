# Demo Mode Setup

## Environment Variables

### Frontend (Vercel/Vite)

Set these environment variables in your Vercel project:

```bash
# Set to 'false' (or empty) for production/preview
VITE_DEMO_MODE=false

# Comma-separated list of email addresses allowed to see demo data
VITE_DEMO_WHITELIST=giacomo.cavalcabo14@gmail.com
```

### Backend (Railway)

Set this environment variable in your Railway project:

```bash
# Comma-separated list of admin emails allowed to see demo data
DEMO_ADMIN_EMAILS=giacomo.cavalcabo14@gmail.com
```

## How It Works

1. **Production/Preview**: Demo mode is disabled by default (`VITE_DEMO_MODE=false`)
2. **Whitelisted Users**: Users in `VITE_DEMO_WHITELIST` always see demo data
3. **Server Flag**: Backend sets `is_demo_allowed: true` for users in `DEMO_ADMIN_EMAILS`
4. **Manual Override**: Users can still use `?demo=1` URL parameter for testing

## Crash Prevention

The demo mode implementation includes **bulletproof error handling** to prevent crashes:

- **Safe Auth Context**: Gracefully handles missing or undefined auth context
- **Safe Environment Access**: Safely accesses `import.meta.env` with try-catch
- **Safe URL Parsing**: Handles URLSearchParams safely, even in SSR contexts
- **Fallback Values**: Always returns a boolean value, never crashes

This ensures the app continues to work even if:
- User is not authenticated (401)
- Environment variables are missing
- Running in different contexts (SSR, production, etc.)

## Result

- **Giacomo** (`giacomo.cavalcabo14@gmail.com`) will always see demo data
- **All other users** will only see demo data if `?demo=1` is in the URL
- **Production/preview** environments are clean by default
- **No crashes** even in edge cases or error conditions

## Testing

Run the Playwright tests to ensure crash prevention:

```bash
npm run test:demo-mode
```

These tests verify that the demo mode doesn't crash the app in various scenarios.
