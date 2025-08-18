import os
import json
from datetime import datetime, timezone

from .db import SessionLocal
from .models import Notification, NotificationTarget

try:
    import dramatiq  # type: ignore
except Exception:  # pragma: no cover
    dramatiq = None  # type: ignore

try:
    import redis  # type: ignore
except Exception:  # pragma: no cover
    redis = None  # type: ignore


BROKER = None
if dramatiq is not None:
    try:
        from dramatiq.brokers.redis import RedisBroker  # type: ignore

        redis_url = os.getenv("REDIS_URL") or os.getenv("REDIS_TLS_URL")
        if redis_url:
            BROKER = RedisBroker(url=redis_url)
            dramatiq.set_broker(BROKER)
    except Exception:  # pragma: no cover
        BROKER = None


def _update_notification_stats(notif_id: str, **kwargs) -> None:
    with SessionLocal() as db:
        n = db.query(Notification).filter(Notification.id == notif_id).first()
        if not n:
            return
        stats = (n.stats_json or {})
        stats.update(kwargs)
        n.stats_json = stats
        db.add(n)
        db.commit()


def _deliver_email(to_email: str, subject: str, html: str) -> bool:
    # Minimal mock sender; integrate Postmark/Sendgrid here
    # Pretend success in dev
    return True if to_email else False


if dramatiq is not None:
    @dramatiq.actor(max_retries=0, time_limit=120000)
    def send_notification_job(notif_id: str) -> None:  # type: ignore
        with SessionLocal() as db:
            n = db.query(Notification).filter(Notification.id == notif_id).first()
            if not n:
                return
            targets = db.query(NotificationTarget).filter(NotificationTarget.notification_id == notif_id).all()
            sent = 0
            errors = 0
            for t in targets:
                # For demo, route by kind
                ok = True
                if (n.kind or "email") == "email":
                    html = f"<h1>{n.subject or ''}</h1><div><pre>{(n.body_md or '')}</pre></div>"
                    ok = _deliver_email(to_email=t.user_id, subject=n.subject or "", html=html)
                # in_app would insert into a hypothetical feed table; skipped here
                if ok:
                    sent += 1
                else:
                    errors += 1
            _update_notification_stats(notif_id, queued=len(targets), sent=sent, errors=errors, finished_at=datetime.now(timezone.utc).isoformat())


