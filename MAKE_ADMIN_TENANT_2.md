# Rendere Admin Tenant ID = 2

## Metodo 1: Dalla Console del Browser (PIÙ VELOCE)

1. Apri l'app in `https://app.agoralia.app` e fai login
2. Apri la Console del Browser (F12 → Console)
3. Incolla e esegui questo codice:

```javascript
// Ottieni il token corrente
const token = localStorage.getItem('auth_token');
const tenantId = localStorage.getItem('tenant_id');

// Chiama l'endpoint per rendere admin
fetch(`https://api.agoralia.app/admin-tools/make-admin/2`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
})
.then(r => r.json())
.then(data => {
  console.log('✅ Success!', data);
  alert(`✅ ${data.updated_to_admin} user(s) promoted to admin!\n\nPlease logout and login again to refresh your token.`);
})
.catch(err => {
  console.error('❌ Error:', err);
  alert('❌ Error: ' + err.message);
});
```

4. Fai **logout e login** per aggiornare il token JWT

## Metodo 2: SQL Diretto (se hai accesso al database)

Esegui questo SQL nel database Railway:

```sql
UPDATE users 
SET is_admin = 1 
WHERE tenant_id = 2;
```

## Metodo 3: Curl (se hai un token)

```bash
curl -X POST https://api.agoralia.app/admin-tools/make-admin/2 \
  -H "Authorization: Bearer <tuo_token>"
```

