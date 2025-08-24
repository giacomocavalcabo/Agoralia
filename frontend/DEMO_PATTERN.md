# Demo vs Clean Pattern

## Overview
Pattern centralizzato per gestire la separazione tra dati demo e produzione, evitando placeholder e dati farlocchi in produzione.

## Architettura

### 1. Hook Unificato
```javascript
import { useIsDemo } from '../lib/demoGate.js';
// oppure
import { useDemoData } from '../lib/useDemoData.js';

const isDemo = useIsDemo(); // true/false
```

### 2. Generatori Dati Deterministici
```javascript
import { makeLeads, makeDashboardSummary } from '../lib/demo/fakes.js';

// Stessi input → stessi output (seed-based)
const leads = makeLeads({ total: 150, seed: 42 });
const summary = makeDashboardSummary({ seed: 7 });
```

### 3. API Wrapper con Fallback
```javascript
import { useApiWithDemo } from '../lib/demoGate.js';

const { get, post, put, del, isDemo } = useApiWithDemo();

// In demo: fallback automatico se API fallisce
// In produzione: solo errori reali
const data = await get('/leads');
```

### 4. Badge Demo in AppShell
- Mostra "Demo" solo quando `isDemo = true`
- Rimosso "Test Mode" hardcoded
- Indicatore visivo chiaro per utenti

## Regole di Implementazione

### ✅ **SEMPRE fare**
- Usare `useIsDemo()` per controllare comportamento
- Generare dati demo con `make*()` functions
- Usare `useApiWithDemo()` per chiamate API
- Aggiungere `__demo: true` ai dati generati

### ❌ **MAI fare**
- Hardcodare "Demo" o "Test" nell'UI
- Usare `Math.random()` direttamente
- Fallback a dati demo senza controllo `isDemo`
- Mostrare placeholder in produzione

## Esempi di Uso

### Componente con Dati Demo
```javascript
function LeadsTable() {
  const isDemo = useIsDemo();
  const [leads, setLeads] = useState([]);
  
  useEffect(() => {
    if (isDemo) {
      // Dati demo deterministici
      setLeads(makeLeads({ total: 150 }));
    } else {
      // API reale
      fetchLeads().then(setLeads);
    }
  }, [isDemo]);
  
  return (
    <div>
      {leads.map(lead => (
        <div key={lead.id}>
          {lead.name}
          {lead.__demo && <span className="text-xs text-amber-600">(Demo)</span>}
        </div>
      ))}
    </div>
  );
}
```

### API con Fallback
```javascript
function Dashboard() {
  const { get, isDemo } = useApiWithDemo();
  
  const loadData = async () => {
    try {
      const data = await get('/dashboard/summary');
      // Se API fallisce e siamo in demo → fallback automatico
      setData(data);
    } catch (error) {
      // Solo in produzione: gestisci errori reali
      if (!isDemo) {
        setError(error.message);
      }
    }
  };
}
```

## Configurazione Ambiente

### Variabili d'Ambiente
```bash
# Abilita demo mode globalmente
VITE_DEMO_MODE=true

# Whitelist email per demo
VITE_DEMO_WHITELIST=admin@example.com,test@example.com

# Base URL API
VITE_API_BASE_URL=https://api.agoralia.app
```

### URL Parameters
```bash
# Abilita demo per sessione
https://app.agoralia.com/?demo=1
```

### Backend Flag
```javascript
// User object dal backend
{
  email: "user@example.com",
  is_demo_allowed: true  // ← Controllato dal backend
}
```

## Benefici

1. **Separazione Chiara**: Demo vs Produzione sempre distinte
2. **Dati Coerenti**: Stessi seed → stessi dati demo
3. **Fallback Intelligente**: Solo quando necessario
4. **UI Pulita**: Nessun placeholder in produzione
5. **Debugging**: Log chiari per operazioni demo
6. **Performance**: Nessun overhead in produzione

## Troubleshooting

### Demo non si attiva
1. Controlla `VITE_DEMO_MODE`
2. Verifica whitelist email
3. Controlla parametro URL `?demo=1`
4. Verifica flag backend `is_demo_allowed`

### Dati demo inconsistenti
1. Usa seed fissi per test
2. Verifica che `make*()` functions siano deterministiche
3. Controlla che non ci sia `Math.random()` diretto

### Badge Demo non appare
1. Verifica che `useIsDemo()` restituisca `true`
2. Controlla che AppShell importi correttamente
3. Verifica che il badge sia condizionale
