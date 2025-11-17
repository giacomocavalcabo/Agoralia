"""Script to execute SQL directly on the database"""
import os
import sys
from pathlib import Path

# Add backend to path
BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from dotenv import load_dotenv
load_dotenv(BACKEND_DIR / ".env")

from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session


def execute_sql(sql: str):
    """Execute SQL statement"""
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        print("❌ DATABASE_URL not set")
        sys.exit(1)
    
    engine = create_engine(database_url)
    
    try:
        with Session(engine) as session:
            result = session.execute(text(sql))
            session.commit()
            
            # Try to fetch results if it's a SELECT
            if sql.strip().upper().startswith("SELECT"):
                rows = result.fetchall()
                if rows:
                    print(f"✅ Query executed. Found {len(rows)} row(s):")
                    for row in rows:
                        print(f"  {dict(row._mapping)}")
                else:
                    print("✅ Query executed. No rows returned.")
            else:
                print("✅ SQL executed successfully")
                
    except Exception as e:
        print(f"❌ Error executing SQL: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python execute_sql.py '<SQL statement>'")
        print("Example: python execute_sql.py 'UPDATE users SET is_admin = 1 WHERE tenant_id = 2'")
        sys.exit(1)
    
    sql = sys.argv[1]
    execute_sql(sql)

