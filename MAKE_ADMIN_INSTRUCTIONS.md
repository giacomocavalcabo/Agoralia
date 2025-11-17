# Istruzioni per rendere admin tenant_id = 2

## Metodo 1: SQL diretto (più veloce)

Esegui questo SQL nel database:

```sql
UPDATE users 
SET is_admin = 1 
WHERE tenant_id = 2;
```

**Per verificare:**
```sql
SELECT id, email, tenant_id, is_admin 
FROM users 
WHERE tenant_id = 2;
```

## Metodo 2: API Endpoint

Se il backend è in esecuzione:

```bash
# 1. Imposta la variabile (opzionale)
export ADMIN_TOOLS_ENABLED=true

# 2. Chiama l'endpoint con un token valido
curl -X POST https://api.agoralia.app/admin-tools/make-admin/2 \
  -H "Authorization: Bearer <tuo_token>"
```

## Metodo 3: Python script (se hai ambiente virtuale)

```bash
cd backend
python scripts/make_admin.py 2
```

## Dopo l'aggiornamento

1. L'utente deve fare **logout e login** per aggiornare il token JWT
2. Oppure chiamare `/auth/me` per aggiornare lo stato
3. Il frontend leggerà automaticamente il nuovo stato admin

