# 🚀 Railway Deployment Guide

## ⚠️ WeasyPrint Fix per Nixpacks

### Problema
WeasyPrint fallisce su Railway perché richiede librerie native di sistema che Nixpacks non installa di default.

### Soluzione
Il file `apt.txt` nella root del progetto contiene le dipendenze necessarie:

```txt
libpango-1.0-0
libcairo2
libgdk-pixbuf2.0-0
libffi-dev
shared-mime-info
libpangoft2-1.0-0
libharfbuzz0b
libpng16-16
libjpeg62-turbo
libx11-6
libxext6
libxrender1
libxcb1
libxcb-render0
libxcb-shm0
```

## 🚀 Deploy Steps

### 1. Push su GitHub
```bash
git add -A
git commit -m "Fix WeasyPrint per Railway"
git push origin main
```

### 2. Railway Auto-Deploy
- Railway rileva automaticamente il nuovo commit
- Nixpacks legge `apt.txt` e installa le librerie
- Build completa con successo

### 3. Verifica Deploy
```bash
# Test locale WeasyPrint
python backend/test_weasyprint.py

# Test endpoint health
curl https://your-app.railway.app/health
```

## 📋 Checklist Pre-Deploy

- [ ] `apt.txt` presente nella root
- [ ] `railway.toml` configurato
- [ ] `requirements.txt` include `weasyprint==60.2`
- [ ] Endpoint `/health` funzionante
- [ ] Test WeasyPrint passano localmente

## 🔍 Troubleshooting

### Build Fallisce
```bash
# Verifica logs Railway
railway logs

# Controlla che apt.txt sia letto
# Dovrebbe vedere: "Installing system packages..."
```

### WeasyPrint Import Error
```bash
# Test dipendenze sistema
python backend/test_weasyprint.py

# Verifica librerie installate
ldd /usr/local/lib/python3.11/site-packages/weasyprint/*.so
```

### Runtime Error
```bash
# Controlla variabili ambiente
echo $PORT
echo $PYTHON_VERSION

# Verifica health check
curl -v /health
```

## 📚 Riferimenti

- [Railway Nixpacks](https://docs.railway.app/deploy/deployments/nixpacks)
- [WeasyPrint Dependencies](https://doc.courtbouillon.org/weasyprint/stable/first_steps.html#installation)
- [Apt.txt Format](https://docs.railway.app/deploy/deployments/nixpacks#apt-txt)
