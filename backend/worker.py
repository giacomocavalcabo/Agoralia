import os
import json
from datetime import datetime, timezone

from .db import SessionLocal
from .models import Notification, NotificationTarget
import httpx

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
    # Provider selection via env
    if not to_email:
        return False
    try:
        from_email = os.getenv("FROM_EMAIL", "noreply@example.com")
        postmark_token = os.getenv("POSTMARK_SERVER_TOKEN")
        sendgrid_key = os.getenv("SENDGRID_API_KEY")
        if postmark_token:
            # Postmark API
            resp = httpx.post(
                "https://api.postmarkapp.com/email",
                headers={
                    "Accept": "application/json",
                    "Content-Type": "application/json",
                    "X-Postmark-Server-Token": postmark_token,
                },
                json={
                    "From": from_email,
                    "To": to_email,
                    "Subject": subject,
                    "HtmlBody": html,
                },
                timeout=10.0,
            )
            return resp.status_code < 300
        if sendgrid_key:
            # Sendgrid API
            payload = {
                "personalizations": [{"to": [{"email": to_email}]}],
                "from": {"email": from_email},
                "subject": subject,
                "content": [{"type": "text/html", "value": html}],
            }
            resp = httpx.post(
                "https://api.sendgrid.com/v3/mail/send",
                headers={
                    "Authorization": f"Bearer {sendgrid_key}",
                    "Content-Type": "application/json",
                },
                json=payload,
                timeout=10.0,
            )
            return 200 <= resp.status_code < 300
        # Fallback: dev no-op success
        return True
    except Exception:
        return False


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
                # Route by kind
                kind = (n.kind or "email").lower()
                ok = True
                if kind == "email":
                    html = f"<h1>{n.subject or ''}</h1><div><pre>{(n.body_md or '')}</pre></div>"
                    ok = _deliver_email(to_email=t.user_id, subject=n.subject or "", html=html)
                elif kind == "in_app":
                    # Consider delivery successful; fetch via /me/inbox
                    ok = True
                if ok:
                    sent += 1
                else:
                    errors += 1
            # Update sent_at on notification
            n.sent_at = datetime.now(timezone.utc)
            db.add(n)
            db.commit()
            _update_notification_stats(notif_id, queued=len(targets), sent=sent, errors=errors, finished_at=n.sent_at.isoformat())


