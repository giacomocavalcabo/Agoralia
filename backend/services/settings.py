"""Settings service functions"""
from sqlalchemy.orm import Session
from config.database import engine
from models.settings import AppSettings, AppMeta


def get_settings() -> AppSettings:
    """Get or create settings"""
    with Session(engine) as session:
        row = session.query(AppSettings).order_by(AppSettings.id.asc()).first()
        if not row:
            row = AppSettings()
            session.add(row)
            session.commit()
            session.refresh(row)
        return row


def get_meta() -> AppMeta:
    """Get or create app metadata"""
    with Session(engine) as session:
        row = session.query(AppMeta).order_by(AppMeta.id.asc()).first()
        if not row:
            row = AppMeta()
            session.add(row)
            session.commit()
            session.refresh(row)
        return row

