"""
Timezone utilities for consistent timezone handling across the application.

This module provides utilities to:
- Pick the appropriate timezone (user > workspace > UTC)
- Convert between UTC and local timezones
- Handle timezone-aware datetime operations
"""

from __future__ import annotations
from datetime import datetime, timezone
from zoneinfo import ZoneInfo
from typing import Optional


def pick_tz(user_tz: Optional[str], workspace_tz: Optional[str]) -> ZoneInfo:
    """
    Pick the appropriate timezone based on priority:
    1. User timezone (if set)
    2. Workspace timezone (if set)
    3. UTC (fallback)
    
    Args:
        user_tz: User's timezone preference
        workspace_tz: Workspace's default timezone
        
    Returns:
        ZoneInfo object for the selected timezone
    """
    name = (user_tz or workspace_tz or "UTC").strip() or "UTC"
    try:
        return ZoneInfo(name)
    except Exception:
        # If timezone is invalid, fallback to UTC
        return ZoneInfo("UTC")


def to_utc(dt: datetime, src_tz: ZoneInfo) -> datetime:
    """
    Convert a datetime to UTC.
    
    Args:
        dt: Datetime to convert (can be naive or aware)
        src_tz: Source timezone to interpret naive datetimes
        
    Returns:
        UTC datetime
    """
    # If datetime is naive, interpret it in the source timezone
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=src_tz)
    return dt.astimezone(timezone.utc)


def utc_to_local(dt_utc: datetime, dst_tz: ZoneInfo) -> datetime:
    """
    Convert a UTC datetime to local timezone.
    
    Args:
        dt_utc: UTC datetime (can be naive or aware)
        dst_tz: Destination timezone
        
    Returns:
        Local datetime in the destination timezone
    """
    # If datetime is naive, assume it's UTC
    if dt_utc.tzinfo is None:
        dt_utc = dt_utc.replace(tzinfo=timezone.utc)
    return dt_utc.astimezone(dst_tz)


def parse_datetime_with_tz(dt_str: str, tz: ZoneInfo) -> datetime:
    """
    Parse a datetime string and interpret it in the given timezone.
    
    Args:
        dt_str: ISO datetime string (can be naive or with timezone info)
        tz: Timezone to interpret naive datetimes
        
    Returns:
        UTC datetime
    """
    try:
        # Try to parse as ISO format
        dt = datetime.fromisoformat(dt_str.replace('Z', '+00:00'))
        
        # If naive, interpret in the given timezone
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=tz)
        
        # Convert to UTC
        return dt.astimezone(timezone.utc)
    except Exception:
        # Fallback: try to parse as naive datetime and interpret in timezone
        try:
            dt = datetime.fromisoformat(dt_str)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=tz)
            return dt.astimezone(timezone.utc)
        except Exception:
            raise ValueError(f"Invalid datetime format: {dt_str}")


def format_datetime_for_display(dt_utc: datetime, display_tz: ZoneInfo) -> str:
    """
    Format a UTC datetime for display in a specific timezone.
    
    Args:
        dt_utc: UTC datetime
        display_tz: Timezone for display
        
    Returns:
        ISO string in the display timezone
    """
    local_dt = utc_to_local(dt_utc, display_tz)
    return local_dt.isoformat()


def is_in_quiet_hours(dt_utc: datetime, quiet_hours: dict, user_tz: Optional[str], workspace_tz: Optional[str]) -> bool:
    """
    Check if a datetime falls within quiet hours.
    
    Args:
        dt_utc: UTC datetime to check
        quiet_hours: Quiet hours configuration
        user_tz: User's timezone
        workspace_tz: Workspace's timezone
        
    Returns:
        True if in quiet hours, False otherwise
    """
    if not quiet_hours:
        return False
    
    # Convert to local time for quiet hours check
    local_tz = pick_tz(user_tz, workspace_tz)
    local_dt = utc_to_local(dt_utc, local_tz)
    
    # Use existing quiet hours logic but with timezone-aware datetime
    from backend.main import _time_in_any_window
    return _time_in_any_window(quiet_hours, local_dt)
