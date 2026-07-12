import sqlite3

DB = '/app/apps/server/data/token00.db'
conn = sqlite3.connect(DB)
cur = conn.cursor()
cur.execute("DELETE FROM api_tokens WHERE token LIKE 't00_sk_LOCAL_%'")
n = cur.rowcount
conn.commit()
conn.close()
print("Deleted test tokens:", n)
