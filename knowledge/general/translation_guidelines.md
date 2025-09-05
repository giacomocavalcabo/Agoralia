# Translation Guidelines

## General Principles

1. Use translation keys (never hardcode UI strings)
2. Keys must be flat, dotted, and clustered by feature
3. Externalize all copy to JSON files under src/locales
4. Keep English (en-US) as the source of truth
5. Keep naming consistent and human-readable

## File Structure (UPDATED)
```
frontend/
  src/
    locales/
      en-US/
        common.json
      it-IT/
        common.json
```

## Key Format (MANDATORY)
- Flat, dotted keys grouped by cluster
- Example:
```
{
  "login.title": "Sign in",
  "login.email_label": "Email"
}
```

## Clustering Rules
- Top-level cluster indicates page/feature: nav, login, app, toast, etc.
- Keep related keys adjacent and alphabetically ordered within cluster

## Adding New Keys
- Add to `frontend/src/locales/en-US/common.json` first
- Mirror keys in `frontend/src/locales/it-IT/common.json`

## Using in Code (React + i18next)
```jsx
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from '../locales/en-US/common.json';
import it from '../locales/it-IT/common.json';

i18n.use(initReactI18next).init({
  resources: { 'en-US': { common: en }, 'it-IT': { common: it } },
  lng: 'en-US',
  fallbackLng: 'en-US',
});
```

## Quality Checks
- No missing translations across supported languages
- No hardcoded UI strings in JSX/TS/JS
- Spot checks in en-US and it-IT

## Supported Languages
- en-US (source)
- it-IT

## Notes
- Frontend must proxy API via /api; never hardcode backend hostnames
- Keep translation files tidy; prefer creating new clusters over growing large ones
