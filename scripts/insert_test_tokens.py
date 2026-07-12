import sqlite3, json

DB = '/app/apps/server/data/token00.db'
conn = sqlite3.connect(DB)
cur = conn.cursor()

# pick a real user (prefer superadmin)
cur.execute("SELECT id, username, role FROM users ORDER BY (role='superadmin') DESC, id ASC LIMIT 5")
users = cur.fetchall()
print("USERS:", users)
uid = users[0][0]
print("Using userId:", uid)

# cleanup any prior test tokens
cur.execute("DELETE FROM api_tokens WHERE token LIKE 't00_sk_LOCAL_%'")
conn.commit()

tokens = [
    ('t00_sk_LOCAL_shwrite', ['statichtml:write', 'statichtml:read'], 'local_sh_write'),
    ('t00_sk_LOCAL_shread', ['statichtml:read'], 'local_sh_read'),
    ('t00_sk_LOCAL_shnoperm', ['article:write'], 'local_sh_noperm'),
]

for tok, perms, name in tokens:
    cur.execute(
        "INSERT INTO api_tokens (user_id, token, name, permissions, is_active, created_at) VALUES (?,?,?,?,1, datetime('now'))",
        (uid, tok, name, json.dumps(perms)),
    )
    print("INSERTED", name, "->", tok, perms)

conn.commit()
conn.close()
print("DONE")
