# Fix per Timeout Database su Railway

## Problema Identificato

- `/health` e `/crm/health` rispondono in millisecondi → l'app è **su**
- `/auth/login` risponde **500 dopo ~135s** → timeout connessione DB
- Stacktrace: **psycopg2.OperationalError: connection to server … timed out** verso `postgres.railway.internal:5432`

## Root Cause

Il backend **non riesce ad aprire** una connessione al DB (non è un errore di query, è proprio handshake/connect).

## Fix Implementati

### 1. Database Engine Resiliente (`backend/db.py`)

```python
# Forza un connect timeout breve per evitare hang di 135s
sep = '&' if '?' in url else '?'
db_url = f"{url}{sep}connect_timeout=5"

engine = create_engine(
    db_url, 
    pool_pre_ping=True,           # Scarta connessioni morte
    pool_size=3,                  # Piccolo ma prevedibile
    max_overflow=0,               # Evita esplosioni di connessioni
    pool_recycle=1800,            # Ricicla connessioni vecchie (30 min)
    connect_args={
        "options": "-c statement_timeout=5000"  # Taglia query bloccate
    }
)
```

### 2. Endpoint Health Check Database (`/db/health`)

```python
@app.get("/db/health")
def db_health(db: Session = Depends(get_db)):
    """
    Health check specifico per il database - testa la connessione
    Se fallisce, il problema è connessione DB, non la logica dell'app
    """
    try:
        db.execute("SELECT 1")
        return {"db": "ok", "timestamp": datetime.now(timezone.utc).isoformat()}
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Database not reachable: {str(e)}")
```

### 3. Gestione Errori Migliorata in `/auth/login`

- **OperationalError** → `503 Database unavailable` (connessione fallita)
- **Altri errori** → `500 Internal server error` (logica fallita)
- **Timeout** → Massimo 5 secondi invece di 135s

### 4. Riduzione Worker Uvicorn

- **Prima**: `--workers 2` (concorrenza ma più connessioni DB)
- **Dopo**: `--workers 1` (meno connessioni, più prevedibile)

## Checklist Railway

- [ ] `DATABASE_URL` proviene dal Postgres **di questo progetto** Railway
- [ ] Private Networking attivo per Backend & Postgres
- [ ] Engine SQLAlchemy configurato con timeout brevi
- [ ] `uvicorn --workers 1`
- [ ] `/db/health` aggiunto e testato

## Test Post-Deploy

1. **Health Check Base**: `/health` → deve rispondere in <100ms
2. **Health Check DB**: `/db/health` → deve rispondere in <1s
3. **Login**: `/auth/login` → deve fallire in <5s se DB non raggiungibile

## Risultato Atteso

- **Prima**: Login fallisce dopo 135s con 500 generico
- **Dopo**: Login fallisce in <5s con 503 specifico per DB

## File Modificati

- `backend/db.py` - Configurazione engine resiliente
- `backend/main.py` - Gestione errori migliorata + `/db/health`
- `Procfile` - Riduzione worker
- `railway.toml` - Configurazione Railway aggiornata
