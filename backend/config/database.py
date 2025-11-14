"""Database configuration and initialization"""
import os
from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase

# Backend directory
BACKEND_DIR = Path(__file__).resolve().parent.parent

# Database configuration
DB_PATH = BACKEND_DIR / "data.db"
DATABASE_URL = os.getenv("DATABASE_URL")

if DATABASE_URL:
    engine = create_engine(DATABASE_URL, echo=False, future=True, pool_pre_ping=True)
else:
    engine = create_engine(f"sqlite:///{DB_PATH}", echo=False, future=True)


class Base(DeclarativeBase):
    """Base class for all SQLAlchemy models"""
    pass


def init_db():
    """Initialize database tables (non-blocking, for dev only)"""
    try:
        Base.metadata.create_all(engine)
    except Exception as e:
        import sys
        print(f"Warning: Could not create database tables at startup: {e}", file=sys.stderr)
        print("Database will be initialized via Alembic migrations.", file=sys.stderr)


def run_migrations():
    """Run Alembic migrations to upgrade database schema"""
    import sys
    
    try:
        # Import Alembic directly instead of using subprocess
        from alembic.config import Config
        from alembic import command
        from alembic.script import ScriptDirectory
        from sqlalchemy import inspect, text
        
        database_url = os.getenv("DATABASE_URL")
        if not database_url:
            print("⚠ DATABASE_URL not set, skipping migrations", file=sys.stderr)
            return
        
        # Configure Alembic
        alembic_ini_path = BACKEND_DIR / "alembic.ini"
        alembic_cfg = Config(str(alembic_ini_path))
        
        # Set absolute path for script_location (alembic directory)
        alembic_script_location = BACKEND_DIR / "alembic"
        alembic_cfg.set_main_option("script_location", str(alembic_script_location))
        alembic_cfg.set_main_option("sqlalchemy.url", database_url)
        
        # Check if alembic_version table exists and has current revision
        try:
            inspector = inspect(engine)
            
            # Check if alembic_version table exists
            has_alembic_version = "alembic_version" in inspector.get_table_names()
            
            if has_alembic_version:
                # Table exists, check current revision
                with engine.connect() as conn:
                    result = conn.execute(text("SELECT version_num FROM alembic_version ORDER BY version_num DESC LIMIT 1"))
                    row = result.fetchone()
                    current_rev = row[0] if row else None
                    
                if current_rev:
                    print(f"Current database revision: {current_rev}", file=sys.stderr)
                else:
                    print("⚠ alembic_version table exists but is empty", file=sys.stderr)
            else:
                # alembic_version doesn't exist - check if tables exist (means schema was created manually)
                has_calls_table = "calls" in inspector.get_table_names()
                has_campaigns_table = "campaigns" in inspector.get_table_names()
                
                if has_calls_table or has_campaigns_table:
                    print("⚠ Database tables exist but alembic_version is missing", file=sys.stderr)
                    print("Attempting to stamp database with current migration state...", file=sys.stderr)
                    
                    # Get all migration revisions to find the highest one
                    script = ScriptDirectory.from_config(alembic_cfg)
                    revisions = [rev.revision for rev in script.walk_revisions()]
                    
                    # Check which migrations have been applied based on table existence
                    # If calls table exists, at least 0001_init was applied
                    if has_calls_table:
                        # Check for newer migrations by looking at table columns/features
                        # If calls has new columns (disposition_outcome, etc), stamp with 0005
                        # Otherwise stamp with latest before 0005
                        
                        # Check if calls table has new optimized columns
                        calls_columns = [col['name'] for col in inspector.get_columns('calls')]
                        has_optimized_columns = 'disposition_outcome' in calls_columns or 'media_json' in calls_columns
                        
                        # Check if country_rules table exists (0004)
                        has_country_rules = "country_rules" in inspector.get_table_names()
                        # Check if campaigns has extended fields (0003)
                        if has_campaigns_table:
                            campaigns_columns = [col['name'] for col in inspector.get_columns('campaigns')]
                            has_extended_campaigns = 'agent_id' in campaigns_columns or 'budget_cents' in campaigns_columns
                        else:
                            has_extended_campaigns = False
                        
                        # Determine stamp revision by finding the matching revision ID
                        script = ScriptDirectory.from_config(alembic_cfg)
                        stamp_rev = None
                        
                        if has_optimized_columns:
                            # Find revision 0005_optimize_calls_schema
                            for rev in script.walk_revisions():
                                if "0005_optimize_calls_schema" in rev.doc or "optimize_calls_schema" in rev.revision:
                                    stamp_rev = rev.revision
                                    break
                        elif has_country_rules:
                            # Find revision 0004_country_rules_lead_nature
                            for rev in script.walk_revisions():
                                if "0004_country_rules_lead_nature" in rev.doc or "country_rules_lead_nature" in rev.revision:
                                    stamp_rev = rev.revision
                                    break
                        elif has_extended_campaigns:
                            # Find revision 0003_extend_campaigns
                            for rev in script.walk_revisions():
                                if "0003_extend_campaigns" in rev.doc or "extend_campaigns" in rev.revision:
                                    stamp_rev = rev.revision
                                    break
                        elif "subscriptions" in inspector.get_table_names():
                            # Find revision 0002_billing_sched_kb
                            for rev in script.walk_revisions():
                                if "0002_billing_sched_kb" in rev.doc or "billing_sched_kb" in rev.revision:
                                    stamp_rev = rev.revision
                                    break
                        else:
                            # Find revision 0001_init
                            for rev in script.walk_revisions():
                                if "0001_init" in rev.doc or rev.down_revision is None:
                                    stamp_rev = rev.revision
                                    break
                        
                        if stamp_rev:
                            print(f"Stamping database with revision: {stamp_rev}", file=sys.stderr)
                            command.stamp(alembic_cfg, stamp_rev)
                        print("✓ Database stamped successfully", file=sys.stderr)
                    else:
                        print("⚠ No existing tables found, will create from scratch", file=sys.stderr)
                        
        except Exception as check_error:
            print(f"⚠ Could not check migration state: {check_error}", file=sys.stderr)
            print("Proceeding with migration...", file=sys.stderr)
        
        # Run upgrade to head
        print("Running database migrations...", file=sys.stderr)
        try:
            command.upgrade(alembic_cfg, "head")
            print("✓ Database migrations applied successfully", file=sys.stderr)
        except Exception as migration_error:
            # Check if it's a duplicate table error - this means migrations were already applied
            error_str = str(migration_error)
            if "already exists" in error_str or "DuplicateTable" in error_str:
                print("⚠ Some tables already exist - checking current revision state...", file=sys.stderr)
                # Try to stamp with appropriate revision and retry
                try:
                    script = ScriptDirectory.from_config(alembic_cfg)
                    # Stamp with head to mark everything as applied
                    current_head = script.get_current_head()
                    if current_head:
                        print(f"Stamping database with head revision: {current_head}", file=sys.stderr)
                        command.stamp(alembic_cfg, "head")
                        print("✓ Database stamped - migrations already applied", file=sys.stderr)
                except Exception as stamp_error:
                    print(f"⚠ Could not stamp database: {stamp_error}", file=sys.stderr)
                    raise migration_error
            else:
                raise migration_error
                
    except ImportError:
        # Alembic not installed, skip migrations
        print("⚠ Alembic not found, skipping migrations", file=sys.stderr)
    except Exception as e:
        print(f"⚠ Could not run migrations: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc(file=sys.stderr)

