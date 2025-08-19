# 🚀 Railway Deployment Guide

## ⚠️ WeasyPrint Fix Completo per Nixpacks

### Problema
WeasyPrint fallisce su Railway perché richiede **librerie native complete** per text shaping, font rendering e bi-directional text.

### Soluzione Completa
Il file `apt.txt` nella root contiene **TUTTE** le dipendenze necessarie:

```txt
# Core grafico
libcairo2
libgdk-pixbuf2.0-0

# Text shaping & layout
libpango-1.0-0
libpangocairo-1.0-0
libpangoft2-1.0-0
libharfbuzz0b
libfribidi0

# Varie utili
libffi-dev
shared-mime-info

# Font (evita crash con CJK/emoji/RTL)
fonts-dejavu-core
fonts-liberation
fonts-noto-core
fonts-noto-cjk
fonts-noto-color-emoji
```

## 🚀 Deploy Steps

### 1. Push su GitHub
```bash
git add -A
git commit -m "Fix WeasyPrint completo per Railway: apt.txt + lazy import"
git push origin main
```

### 2. Railway Auto-Deploy
- Railway rileva automaticamente il nuovo commit
- Nixpacks legge `apt.txt` e installa **TUTTE** le librerie
- Build completa con successo

### 3. Verifica Deploy
```bash
# Test locale (opzionale)
python backend/test_weasyprint.py

# Test endpoint health
curl https://your-app.railway.app/health

# Test WeasyPrint specifico
curl https://your-app.railway.app/weasyprint/health
```

## 📋 Checklist Pre-Deploy

- [ ] `apt.txt` presente nella root con **TUTTE** le dipendenze
- [ ] `railway.toml` configurato per Nixpacks
- [ ] `requirements.txt` include `weasyprint>=61.0`
- [ ] Import WeasyPrint **lazy** (non in cima ai moduli)
- [ ] Endpoint `/health` e `/weasyprint/health` funzionanti
- [ ] Test WeasyPrint passano localmente (opzionale)

## 🔍 Troubleshooting Completo

### Build Fallisce
```bash
# Verifica logs Railway
railway logs

# Controlla che apt.txt sia letto
# Dovrebbe vedere: "Installing system packages..."
# E poi: "Installing libcairo2, libpango-1.0-0, etc."
```

### WeasyPrint Import Error
```bash
# Test dipendenze sistema
python backend/test_weasyprint.py

# Verifica librerie installate
ldd /usr/local/lib/python3.11/site-packages/weasyprint/*.so
```

### Runtime Error con PDF
```bash
# Controlla health check WeasyPrint
curl /weasyprint/health

# Verifica font disponibili
ls /usr/share/fonts/truetype/
ls /usr/share/fonts/opentype/
```

### Errori Specifici

#### "Pango could not be initialized"
```bash
# Manca libpango-1.0-0
# Verifica apt.txt e redeploy
```

#### "Cairo surface could not be created"
```bash
# Manca libcairo2
# Verifica apt.txt e redeploy
```

#### "Font not found"
```bash
# Manca fonts-noto-core
# Verifica apt.txt e redeploy
```

#### "HarfBuzz error"
```bash
# Manca libharfbuzz0b
# Verifica apt.txt e redeploy
```

## 🎯 Perché Questa Soluzione Funziona

### Prima (Incompleta)
- Solo libcairo2, libpango-1.0-0
- Mancavano HarfBuzz, Fribidi, font
- WeasyPrint si inizializzava ma crashava al primo PDF

### Ora (Completa)
- **Tutte** le librerie native necessarie
- Font per tutte le lingue (CJK, arabo, RTL)
- Text shaping avanzato (HarfBuzz)
- Bi-directional text (Fribidi)

## 🚨 Se Ancora Fallisce

### 1. Verifica Logs Railway
```bash
railway logs --tail 100
```

### 2. Controlla Build Steps
Dovresti vedere:
```
Installing system packages...
Installing libcairo2...
Installing libpango-1.0-0...
Installing libharfbuzz0b...
Installing fonts-noto-core...
```

### 3. Alternative Estreme
Se ancora non funziona, passa a Dockerfile:
```dockerfile
FROM python:3.11-slim
RUN apt-get update && apt-get install -y \
    libcairo2 libpango-1.0-0 libharfbuzz0b \
    fonts-noto-core fonts-noto-cjk
# ... resto del Dockerfile
```

## 📚 Riferimenti

- [Railway Nixpacks](https://docs.railway.app/deploy/deployments/nixpacks)
- [WeasyPrint Dependencies](https://doc.courtbouillon.org/weasyprint/stable/first_steps.html#installation)
- [Apt.txt Format](https://docs.railway.app/deploy/deployments/nixpacks#apt-txt)
- [Pango/HarfBuzz](https://pango.gnome.org/)
- [Cairo Graphics](https://cairographics.org/)
