# ✅ Checklist Post-Deploy Vercel

## 🔍 Verifica immediata (dopo deploy)

### 1. Test asset JavaScript
```bash
# Sostituisci XXXXX con l'hash reale dal tuo index.html
curl -I https://<tuo-dominio>/assets/index-XXXXX.js

# ✅ RISULTATO ATTESO:
# HTTP/2 200 
# Content-Type: application/javascript
# Cache-Control: public, max-age=31536000, immutable

# ❌ SE VEDI:
# Content-Type: text/html → rewrite ancora attivo
```

### 2. Test SPA fallback
```bash
curl -I -H "Accept: text/html" https://<tuo-dominio>/qualunque/percorso

# ✅ RISULTATO ATTESO:
# HTTP/2 200
# Content-Type: text/html
# (contenuto di index.html)
```

### 3. Verifica index.html
```bash
# Apri https://<tuo-dominio> e controlla:
# - Console browser: NO errori "Expected JavaScript but got text/html"
# - Network tab: /assets/*.js → 200 OK
# - Pagina: si carica (non più bianca)
```

## 🐞 Se resta bianco (asset ora OK)

### Problema: `Slot is not defined`
```bash
# Nel componente button.jsx, aggiungi:
import { Slot } from "@radix-ui/react-slot"
```

### Problema: Altri errori JS
- Controlla console browser per errori specifici
- Verifica che tutte le dipendenze siano installate

## 🔧 Configurazione Dashboard Vercel

### Build & Output
- **Framework Preset**: Vite (o Other)
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Root Directory**: `frontend`

### Routing (se non usi vercel.json)
1. **Elimina** rewrite globali `/(.*) → /index.html`
2. **Aggiungi** rewrite condizionale:
   - Source: `/(.*)`
   - Has: Header `Accept: text/html`
   - Destination: `/index.html`

## 📝 Note importanti

- ✅ `vercel.json` è in `frontend/` (non in root repo)
- ✅ `"handle": "filesystem"` serve PRIMA gli asset
- ✅ Fallback SPA solo DOPO per route senza estensione
- ✅ Cache headers per performance ottimali

## 🚀 Deploy

1. **Push** questo `vercel.json` su `main`
2. **Redeploy** su Vercel
3. **Testa** con la checklist sopra
4. **Verifica** che gli asset siano serviti correttamente
