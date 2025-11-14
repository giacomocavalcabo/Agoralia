#!/usr/bin/env python3
"""Script to run Alembic migrations manually"""
import os
import sys
from pathlib import Path

# Add backend to path
BACKEND_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BACKEND_DIR))

# Set up environment
os.environ["PYTHONPATH"] = str(BACKEND_DIR)

# Import and run Alembic
from alembic.config import Config
from alembic import command

def main():
    # Get DATABASE_URL
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        print("ERROR: DATABASE_URL environment variable is not set", file=sys.stderr)
        sys.exit(1)
    
    # Configure Alembic
    alembic_cfg = Config(str(BACKEND_DIR / "alembic.ini"))
    alembic_cfg.set_main_option("sqlalchemy.url", database_url)
    
    print("Running Alembic migrations...", file=sys.stderr)
    print(f"Database URL: {database_url[:20]}...", file=sys.stderr)
    
    try:
        # Run upgrade to head
        command.upgrade(alembic_cfg, "head")
        print("✓ Migrations completed successfully!", file=sys.stderr)
        sys.exit(0)
    except Exception as e:
        print(f"✗ Migration failed: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()

