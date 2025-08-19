# 🚀 Railway Deployment Guide - Agoralia

## ✅ Chromium PDF Generator Fix Completo per Nixpacks

Chromium headless fallisce su Railway perché richiede **binario completo** per rendering HTML e generazione PDF.

### 🔧 Soluzione: apt.txt + Chromium Headless

1. **Aggiungi `apt.txt` nella root del servizio backend:**

```txt
chromium
fonts-dejavu-core
fonts-liberation
fonts-noto-core
fonts-noto-cjk
fonts-noto-color-emoji
```

2. **Commit e push:**

```bash
git add apt.txt
git commit -m "Fix Chromium completo per Railway: apt.txt + headless mode"
git push
```

3. **Railway rebuild automatico** → installerà Chromium

4. **Test locale (opzionale):**

```bash
# Test Chromium specifico
curl https://your-app.railway.app/pdf/health
```

### 📋 Checklist Pre-Deploy

- [ ] `apt.txt` include `chromium` e fonts
- [ ] `requirements.txt` non include `weasyprint`
- [ ] Endpoint `/pdf/health` e `/pdf/generate` funzionanti
- [ ] Test PDF passano localmente (opzionale)

### 🚨 Troubleshooting

#### Chromium Not Found Error

```bash
# Controlla se Chromium è installato
which chromium
which chromium-browser

# Controlla health check Chromium
curl /pdf/health
```

#### PDF Generation Fails

```bash
# Controlla log Railway per errori Chromium
# Verifica che --no-sandbox sia usato
# Controlla che fonts siano installati
```

### 📚 Risorse

- [Chromium Headless Documentation](https://chromium.googlesource.com/chromium/src/+/HEAD/docs/headless.md)
- [Railway Nixpacks](https://docs.railway.app/deploy/deployments/nixpacks)
- [Container PDF Generation](https://github.com/puppeteer/puppeteer/blob/main/docs/troubleshooting.md#running-puppeteer-in-docker)

### 🔄 Migrazione da WeasyPrint

**Prima (WeasyPrint):**
- Librerie native complesse (GTK, Pango, Cairo)
- Problemi di compatibilità container
- CSS support limitato

**Ora (Chromium):**
- Binario standalone
- Container-friendly con `--no-sandbox`
- CSS moderno completo (flexbox, grid, media queries)
- Rendering identico al browser
