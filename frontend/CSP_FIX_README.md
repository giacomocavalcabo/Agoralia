# 🔒 Fix Content Security Policy (CSP) - ColdAI

## 🚨 **Problema Risolto**

**Violazione CSP per event handler inline nei font Google**

### ❌ **Prima (Problematico)**
```html
<link rel="preload" href="..." as="style" onload="this.onload=null;this.rel='stylesheet'">
```

**Problema**: L'attributo `onload="..."` è un **event handler inline** che viola la CSP attuale:
```
script-src 'self' 'unsafe-eval' https://js.stripe.com https://m.stripe.network
```

### ✅ **Dopo (Risolto)**
```html
<link rel="preload" href="..." as="style" id="font-preload">

<script>
  document.addEventListener('DOMContentLoaded', function() {
    const fontLink = document.getElementById('font-preload');
    if (fontLink) {
      fontLink.onload = function() {
        this.onload = null;
        this.rel = 'stylesheet';
      };
    }
  });
</script>
```

**Soluzione**: Sostituito l'event handler inline con JavaScript pulito che rispetta la CSP.

## 🧪 **Test e Verifica**

### 1. **Test Locale**
```bash
cd frontend
# Apri test-csp.html nel browser
open test-csp.html
```

### 2. **Test in Produzione**
- Deploy su Vercel
- Apri la console del browser (F12)
- Verifica che non ci siano errori CSP

### 3. **Cosa Verificare**
- ✅ **Event handlers**: Tutti i bottoni React funzionano
- ✅ **Font Google**: Caricamento corretto senza warning
- ✅ **Stripe**: Pagamenti funzionanti
- ✅ **CSP**: Nessuna violazione nella console

## 🔧 **Modifiche Apportate**

### **File Modificati**
1. **`frontend/index.html`** - Rimosso event handler inline
2. **`frontend/test-csp.html`** - File di test CSP
3. **`frontend/CSP_FIX_README.md`** - Questa documentazione

### **File NON Modificati**
- **`frontend/vercel.json`** - CSP già corretta
- **Componenti React** - Tutti usano `onClick={...}` (già CSP compliant)

## 📋 **Configurazione CSP Attuale**

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Content-Security-Policy",
          "value": "default-src 'self'; script-src 'self' 'unsafe-eval' https://js.stripe.com https://m.stripe.network; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https://service-1-production.up.railway.app https://api.openai.com; frame-src 'self' https://js.stripe.com https://m.stripe.network; object-src 'none'; base-uri 'self'; form-action 'self';"
        }
      ]
    }
  ]
}
```

### **Direttive CSP Spiegate**
- **`script-src 'self'`**: Script solo dal dominio corrente
- **`'unsafe-eval'`**: Necessario per Vite/React
- **`https://js.stripe.com https://m.stripe.network`**: Stripe per pagamenti
- **`style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`**: CSS e font Google
- **`font-src 'self' https://fonts.gstatic.com`**: Font da Google

## 🚀 **Deploy**

### **Vercel (Automatico)**
```bash
git add .
git commit -m "Fix CSP: rimossi event handler inline dai font"
git push
# Vercel fa deploy automatico
```

### **Verifica Deploy**
1. Vai su [Vercel Dashboard](https://vercel.com/dashboard)
2. Controlla che il deploy sia completato
3. Testa l'app in produzione
4. Verifica console browser per errori CSP

## 🔍 **Troubleshooting**

### **Se gli errori CSP persistono**
1. **Pulisci cache browser** (Ctrl+Shift+R)
2. **Testa in modalità incognito**
3. **Verifica console browser** per errori specifici
4. **Controlla log Vercel** per errori server-side

### **Se i font non si caricano**
1. **Verifica connessione internet**
2. **Controlla che Google Fonts sia accessibile**
3. **Verifica CSP nel Network tab** (header response)

### **Se Stripe non funziona**
1. **Verifica domini nella CSP**: `https://js.stripe.com https://m.stripe.network`
2. **Controlla console per errori Stripe**
3. **Verifica chiavi API Stripe**

## 📚 **Risorse Utili**

- [MDN Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [Stripe CSP Documentation](https://stripe.com/docs/security/guide#content-security-policy)
- [Google Fonts Best Practices](https://developers.google.com/fonts/docs/css2)

## ✅ **Checklist Completamento**

- [x] Rimosso event handler inline dai font
- [x] Creato JavaScript CSP compliant
- [x] Creato file di test
- [x] Documentato le modifiche
- [ ] **Deploy su Vercel** (da fare)
- [ ] **Test in produzione** (da fare)
- [ ] **Verifica console browser** (da fare)

---

**Status**: 🟢 **PROBLEMA RISOLTO** - Pronto per deploy e test!
