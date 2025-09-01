#!/usr/bin/env python3
"""
Worker entrypoint dedicato per ColdAI
Non importa backend.main per evitare conflitti con FastAPI
"""

import asyncio
import logging
import os
import sys
from pathlib import Path

# Aggiungi la root del progetto al PYTHONPATH
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from backend.config.settings import settings
from backend.logger import logger

# Configura logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

async def job_twilio_snapshot_rebuild():
    """Rebuild Twilio coverage snapshot"""
    try:
        from backend.services.twilio_coverage import build_twilio_snapshot
        from backend.services.coverage_cache import set_mem as set_coverage_cache, save_disk
        
        logger.info("Worker: rebuilding Twilio snapshot...")
        snapshot = build_twilio_snapshot()
        
        # Salva in cache e disco
        set_coverage_cache("twilio", snapshot)
        save_disk("twilio", snapshot)
        
        logger.info("Worker: Twilio snapshot rebuilt successfully")
    except Exception as e:
        logger.error(f"Worker: failed to rebuild Twilio snapshot: {e}")

async def job_cleanup_old_orders():
    """Cleanup old number orders"""
    try:
        from backend.models import NumberOrder
        from backend.db import get_db
        from sqlalchemy.orm import Session
        from datetime import datetime, timedelta
        
        # Simula accesso al DB (in produzione userai una connessione dedicata)
        logger.info("Worker: cleanup old orders...")
        
        # TODO: Implement actual cleanup logic
        # cutoff_date = datetime.utcnow() - timedelta(days=30)
        # orders_to_clean = db.query(NumberOrder).filter(
        #     NumberOrder.created_at < cutoff_date,
        #     NumberOrder.status.in_(["failed", "cancelled"])
        # ).all()
        
        logger.info("Worker: cleanup completed")
    except Exception as e:
        logger.error(f"Worker: failed to cleanup orders: {e}")

async def main_worker():
    """Main worker loop"""
    logger.info("Worker: starting ColdAI worker...")
    
    # Configura scheduler
    try:
        from apscheduler.schedulers.asyncio import AsyncIOScheduler
        from apscheduler.triggers.cron import CronTrigger
        
        scheduler = AsyncIOScheduler(timezone="UTC")
        
        # Job: rebuild Twilio snapshot ogni notte alle 2:00 UTC
        scheduler.add_job(
            job_twilio_snapshot_rebuild,
            CronTrigger(hour=2, minute=0),
            id="twilio_snapshot_rebuild",
            name="Rebuild Twilio coverage snapshot"
        )
        
        # Job: cleanup ordini ogni giorno alle 3:00 UTC
        scheduler.add_job(
            job_cleanup_old_orders,
            CronTrigger(hour=3, minute=0),
            id="cleanup_old_orders",
            name="Cleanup old number orders"
        )
        
        scheduler.start()
        logger.info("Worker: scheduler started successfully")
        
        # Mantieni il worker attivo
        while True:
            await asyncio.sleep(60)  # Check ogni minuto
            
    except ImportError:
        logger.warning("Worker: APScheduler not available, running in simple mode")
        # Fallback: esegui job una volta e poi esci
        await job_twilio_snapshot_rebuild()
        await job_cleanup_old_orders()
        logger.info("Worker: completed one-time jobs")
    except Exception as e:
        logger.error(f"Worker: scheduler failed: {e}")
        raise

def main():
    """Entrypoint principale"""
    try:
        # Verifica configurazione
        logger.info(f"Worker: environment: {settings.ENVIRONMENT}")
        logger.info(f"Worker: database: {settings.DATABASE_URL.split('@')[1] if '@' in settings.DATABASE_URL else 'local'}")
        
        # Avvia worker
        asyncio.run(main_worker())
        
    except KeyboardInterrupt:
        logger.info("Worker: received interrupt signal, shutting down...")
    except Exception as e:
        logger.error(f"Worker: fatal error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()


