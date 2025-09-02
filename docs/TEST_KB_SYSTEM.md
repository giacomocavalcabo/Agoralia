# Test Sistema Knowledge Base - Sprint 8

## **Stato Attuale**
✅ **COMPLETATO (G1 + G2)**
- Backend: Modelli, API, migrazioni, worker
- Frontend: Routing, componenti, RBAC, autosave
- UI: Editor, Import Manager, Assignments

## **Test da Eseguire**

### **1. Navigazione Base**
- [ ] Apri `/knowledge` → Mostra overview con cards
- [ ] Click su "Crea Company KB" → Naviga a editor
- [ ] Sidebar mostra tutte le sezioni KB
- [ ] Routing funziona per tutti i path

### **2. Creazione Company KB**
- [ ] Editor si apre in modalità creazione
- [ ] Template Company KB con sezioni predefinite
- [ ] Campi nome, tipo, descrizione editabili
- [ ] Sezioni: purpose, vision, icp, operating_areas, contacts
- [ ] Calcolo completeness funziona
- [ ] Publish button disabilitato se < 60%

### **3. Import Manager**
- [ ] Click "Importa" → Apre wizard
- [ ] Step 1: Upload CSV/File/URL funziona
- [ ] Step 2: Mapping (placeholder per ora)
- [ ] Step 3: Review & Commit
- [ ] Gestione errori 422/409/429
- [ ] Polling job status funziona

### **4. Assignments**
- [ ] Tab "Per Numero" → Select KB funziona
- [ ] Tab "Per Campagna" → Select KB funziona  
- [ ] Tab "Per Agente" → Select KB funziona
- [ ] Precedence banner visibile
- [ ] Conflitti mostrati correttamente
- [ ] PrecedenceImpact badges colorati

### **5. Autosave & RBAC**
- [ ] Campi salvano automaticamente (800ms debounce)
- [ ] Toast "Salvato • hh:mm" appare
- [ ] RequireRole blocca accesso non autorizzato
- [ ] Workspace context funziona

## **Come Testare**

### **Avvia Frontend**
```bash
cd frontend
npm run dev
```

### **Avvia Backend (se locale)**
```bash
cd backend
source venv/bin/activate
uvicorn main:app --reload
```

### **Test Flow Completo**
1. Vai a `/knowledge`
2. Crea Company KB
3. Compila sezioni (purpose, vision, icp)
4. Verifica completeness > 60%
5. Pubblica KB
6. Vai a Assignments
7. Assegna KB a numero/campagna
8. Testa Import Manager

## **Risultati Attesi**

### **G1 (Foundation) - 100% ✅**
- Database models e migrazioni
- API endpoints completi
- Background worker Dramatiq
- RBAC e workspace ownership

### **G2 (Core UI) - 95% ✅**
- Routing e navigazione
- Editor con sezioni
- Import wizard 3-step
- Assignments con precedenza
- Autosave e validazioni

### **G3 (Import Pipeline) - 30% 🔄**
- UI wizard completa ✅
- Backend job processing 🔄
- CSV/file/URL handling 🔄
- Cost estimation 🔄

### **G4-G6 - 0% ❌**
- AI extraction
- Embeddings
- Provider integration
- Performance optimization

## **Prossimi Passi**
1. **Completare G3**: Implementare processing backend import
2. **Testare G2**: Verificare tutti i componenti UI
3. **Iniziare G4**: AI pipeline per extraction
4. **Preparare G5**: Provider integration

## **Note**
- Sistema funziona senza PostgreSQL locale (Railway)
- Frontend mock data per demo
- Backend API già implementato
- Focus su completamento UI e integrazione
