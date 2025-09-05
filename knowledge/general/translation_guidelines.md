# Translation Guidelines

## General Principles

1. Use translation keys (never hardcode UI strings)
2. Keys must be flat, dotted, and clustered by feature
3. Externalize all copy to JSON files under public/locales
4. Keep English (en-US) as the source of truth
5. Keep naming consistent and human-readable

## File Structure
```
frontend/
  public/
    locales/
      en-US/
        common.json
      it-IT/
        common.json
```

## Key Format (MANDATORY)
- Flat, dotted keys grouped by cluster
- Lowercase with dashes or underscores in value text, not in keys
- Example:
```
{
  "nav.to_login": "Go to Login",
  "nav.to_app": "Go to App",

  "login.title": "Sign in",
  "login.email_label": "Email",
  "login.password_label": "Password",
  "login.submit": "Sign in",

  "app.title": "Your Profile",
  "app.name_label": "Full name",
  "app.phone_label": "Phone number",
  "app.submit": "Save"
}
```

## Clustering Rules
- Top-level cluster indicates page/feature: nav, login, app, toast, settings, leads, etc.
- Keep related keys adjacent and alphabetically ordered within cluster
- Do not nest objects in JSON (only flat keys)

## Adding New Keys
- Add to en-US/common.json first
- Mirror keys in it-IT/common.json with translated values
- Avoid duplicate or overlapping clusters

## Using in Code (React + i18next)
```jsx
import { useTranslation } from 'react-i18next';

export function Login() {
  const { t } = useTranslation('common');
  return (
    <>
      <h1>{t('login.title')}</h1>
      <label>{t('login.email_label')}</label>
    </>
  );
}
```

## Quality Checks
- No missing translations across supported languages
- No hardcoded UI strings in JSX/TS/JS
- Run spot checks in both en-US and it-IT

## Supported Languages
- en-US (source)
- it-IT

## Notes
- Frontend must proxy API via /api; never hardcode backend hostnames
- Keep translation files small and tidy; prefer creating new clusters over growing large ones
