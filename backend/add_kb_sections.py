#!/usr/bin/env python3
"""Script per aggiungere sezioni fittizie a una KB per test"""
import sys
import os

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy.orm import Session
from config.database import engine
from models.agents import KnowledgeSection, KnowledgeBase

def add_test_sections(kb_id: int, tenant_id: int = None):
    """Aggiunge sezioni di test a una KB"""
    with Session(engine) as session:
        # Verifica che la KB esista
        kb = session.get(KnowledgeBase, kb_id)
        if not kb:
            print(f"❌ KB {kb_id} non trovata")
            return False
        
        # Verifica tenant_id se fornito
        if tenant_id is not None and kb.tenant_id != tenant_id:
            print(f"❌ KB {kb_id} non appartiene al tenant {tenant_id}")
            return False
        
        print(f"📝 Aggiungendo sezioni di test a KB {kb_id} (lang: {kb.lang}, scope: {kb.scope})...")
        
        # Contenuto di test
        sections_data = [
            {
                "kind": "knowledge",
                "content_text": "La nostra azienda si chiama Agoralia e offre soluzioni di AI vocale per business. Siamo specializzati in chiamate automatiche intelligenti che utilizzano tecnologia avanzata per qualificare lead e gestire conversazioni professionali."
            },
            {
                "kind": "knowledge",
                "content_text": "Il nostro prodotto principale permette di automatizzare le chiamate di vendita, qualificazione lead e supporto clienti. Utilizziamo intelligenza artificiale per rendere le conversazioni naturali e efficaci."
            },
            {
                "kind": "rules",
                "content_text": "Durante la conversazione, ricordati sempre di: 1) Essere cortese e professionale, 2) Ascoltare attentamente le risposte del cliente, 3) Qualificare il lead secondo i criteri BANT (Budget, Authority, Need, Timeline), 4) Non essere insistente o aggressivo, 5) Rispettare le pause e i silenzi dell'interlocutore."
            },
            {
                "kind": "style",
                "content_text": "Lo stile di comunicazione deve essere: professionale ma amichevole, chiaro e diretto, empatico e attento alle esigenze del cliente. Usa un tono di voce naturale e conversazionale, evitando suoni robotici o troppo meccanici."
            }
        ]
        
        # Aggiungi sezioni
        added_count = 0
        for sec_data in sections_data:
            # Verifica se la sezione esiste già (evita duplicati)
            existing = (
                session.query(KnowledgeSection)
                .filter(
                    KnowledgeSection.kb_id == kb_id,
                    KnowledgeSection.kind == sec_data["kind"],
                    KnowledgeSection.content_text == sec_data["content_text"]
                )
                .first()
            )
            
            if existing:
                print(f"   ⚠️  Sezione {sec_data['kind']} già esistente, skip")
                continue
            
            sec = KnowledgeSection(
                kb_id=kb_id,
                tenant_id=kb.tenant_id,
                kind=sec_data["kind"],
                content_text=sec_data["content_text"]
            )
            session.add(sec)
            added_count += 1
            print(f"   ✅ Aggiunta sezione: {sec_data['kind']} ({len(sec_data['content_text'])} caratteri)")
        
        session.commit()
        print(f"\n✅ Completato! Aggiunte {added_count} sezioni alla KB {kb_id}")
        return True

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python add_kb_sections.py <kb_id> [tenant_id]")
        print("")
        print("Esempio:")
        print("  python add_kb_sections.py 1")
        print("  python add_kb_sections.py 1 123")
        sys.exit(1)
    
    kb_id = int(sys.argv[1])
    tenant_id = int(sys.argv[2]) if len(sys.argv) > 2 else None
    
    success = add_test_sections(kb_id, tenant_id)
    sys.exit(0 if success else 1)

