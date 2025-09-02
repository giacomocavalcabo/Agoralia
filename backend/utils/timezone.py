from zoneinfo import ZoneInfo
from datetime import datetime

def now_in_tz(tz: str) -> datetime:
    return datetime.now(ZoneInfo(tz))

def effective_tz(user_tz: str | None, workspace_tz: str | None) -> str:
    return (user_tz or workspace_tz or "UTC")

def violates_quiet_hours(start_at_utc: datetime, user_tz: str | None, ws_tz: str | None, quiet_hours) -> bool:
    tz = effective_tz(user_tz, ws_tz)
    local_dt = start_at_utc.astimezone(ZoneInfo(tz))
    # quiet_hours es.: {"start":"21:00","end":"08:00"} in tz effettiva
    sh, sm = map(int, quiet_hours["start"].split(":"))
    eh, em = map(int, quiet_hours["end"].split(":"))
    start_t = local_dt.time()
    in_window = (start_t >= start_t.replace(hour=sh, minute=sm, second=0, microsecond=0) or
                 start_t <= start_t.replace(hour=eh, minute=em, second=0, microsecond=0))
    return in_window
