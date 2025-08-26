# 🚀 Deploy Vercel - Frontend SPA

## ✅ Configurazione corretta implementata

Il file `vercel.json` è ora posizionato correttamente in `frontend/` per evitare il problema **"Expected JavaScript but got text/html"**.

### 🔑 Punti chiave della configurazione:

1. **`"handle": "filesystem"`** - Serve PRIMA i file che esistono (es. `/assets/*.js`)
2. **Fallback SPA** - Solo DOPO serve `index.html` per le route client-side
3. **Build command** - `npm --prefix frontend ci && npm --prefix frontend run build`
4. **Output directory** - `frontend/dist`

## 📋 Checklist di deploy

### 1. Verifica build locale
```bash
cd frontend
npm run build
ls -la dist/assets/  # deve contenere i file JS con hash
```

### 2. Verifica index.html
```bash
grep -o 'src="/assets/[^"]*"' dist/index.html
# deve mostrare: src="/assets/index-XXXXX.js"
```

### 3. Deploy su Vercel
- **Importa** il repository GitHub
- **Framework Preset**: Vite (se richiesto)
- **Build Command**: `npm ci && npm run build`
- **Output Directory**: `dist`
- **Root Directory**: `frontend` (IMPORTANTE!)

### 4. Test post-deploy
```bash
# Test asset JavaScript
curl -I https://<tuo-dominio>/assets/index-XXXXX.js
# Deve rispondere: 200 OK + Content-Type: application/javascript

# Test SPA fallback
curl -I https://<tuo-dominio>/qualunque/percorso
# Deve rispondere: 200 OK + Content-Type: text/html
```

## 🐞 Risoluzione problemi comuni

### Schermo bianco + "Expected JavaScript but got text/html"
- **Causa**: Rewrite che intercetta anche `/assets/*.js`
- **Soluzione**: Usa `"handle": "filesystem"` prima del fallback

### Asset non trovati (404)
- **Causa**: Output directory sbagliata
- **Soluzione**: Verifica `"outputDirectory": "frontend/dist"`

### Build fallisce
- **Causa**: Dependencies non installate
- **Soluzione**: Usa `npm ci` invece di `npm install`

## 🔄 Architettura consigliata

- **Frontend**: Vercel (SPA)
- **Backend**: Railway (FastAPI)
- **CORS**: Configurato per dominio Vercel
- **API calls**: `VITE_API_BASE_URL=https://api.tuodominio.com`

## 📝 Note importanti

- **Non** servire la stessa SPA dal backend FastAPI
- **Non** usare rewrites generiche senza `filesystem` handle
- **Verifica** sempre che gli asset JS siano serviti correttamente
- **Cache** degli asset configurato per performance ottimali
