import glob
import sqlite3

for db_file in glob.glob("*.db"):
    conn = sqlite3.connect(db_file)
    cur = conn.cursor()
    cols = [r[1] for r in cur.execute("PRAGMA table_info(service_requests)").fetchall()]
    print(f"Database: {db_file}")
    print(f"Existing columns in service_requests: {cols}")
    if cols:
        for col_name, col_type in [
            ("selected_machine_id", "INTEGER"),
            ("selected_date", "DATE"),
            ("selected_slot", "VARCHAR(50)"),
        ]:
            if col_name not in cols:
                print(f"Adding column {col_name} to {db_file}...")
                cur.execute(f"ALTER TABLE service_requests ADD COLUMN {col_name} {col_type}")
        conn.commit()
    conn.close()

print("Schema update completed successfully!")
