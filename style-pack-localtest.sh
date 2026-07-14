#!/usr/bin/env bash
# TokenPress Style Pack — 本地 Docker 验收脚本（不碰 VPS）
# 前置：docker compose build 已完成且 docker compose up -d 已启动
set -u
BASE="${BASE:-http://localhost:8081}"
UA="Mozilla/5.0"
DB="/app/apps/server/data/token00.db"
PASS=0; FAIL=0
ok(){ echo "✅ PASS: $1"; PASS=$((PASS+1)); }
bad(){ echo "❌ FAIL: $1"; FAIL=$((FAIL+1)); }
# 返回 HTTP 状态码
code(){ curl -s -o /dev/null -w "%{http_code}" -A "$UA" "$@"; }
# 返回 body
body(){ curl -s -A "$UA" "$@"; }

echo "===== BASE=$BASE ====="

# 1) 健康检查
c=$(code "$BASE/api/v1/health"); [ "$c" = "200" ] && ok "health 200" || bad "health -> $c"

# 2) 公开 active 默认 blog
r=$(body "$BASE/api/v1/styles/active")
echo "  active(默认): $r"
echo "$r" | grep -q '"activeStyle":"blog"' && ok "默认 activeStyle=blog" || bad "默认 activeStyle 非 blog"
echo "$r" | grep -q '"defaultTheme":"light"' && ok "blog 出厂配色=light" || bad "blog defaultTheme 异常"

# 3) 读接口无 token → 401/403（权限隔离 AC-8）
c=$(code "$BASE/api/v1/styles"); { [ "$c" = "401" ] || [ "$c" = "403" ]; } && ok "GET /styles 无 token=401/403" || bad "GET /styles 无 token -> $c"

# 4) 插入带 styles:write/read + settings:write 的测试 token
TOKEN=$(docker exec -i tokenpress-backend python3 - <<PY
import sqlite3, json, secrets
db=sqlite3.connect("$DB")
u=db.execute("SELECT id FROM users WHERE role IN ('superadmin','admin') ORDER BY id LIMIT 1").fetchone()
uid=u[0] if u else 1
tok="t00_sk_"+secrets.token_hex(16)
db.execute("INSERT INTO api_tokens(user_id,token,name,permissions,expires_at,is_active) VALUES(?,?,?,?,NULL,1)",
           (uid,tok,"localtest-style",json.dumps(["styles:write","styles:read","settings:write"])))
db.commit()
print(tok)
PY
)
echo "  测试 token: ${TOKEN:0:18}..."
AUTH="Authorization: Bearer $TOKEN"

# 5) 带 token 列出三包
r=$(body -H "$AUTH" "$BASE/api/v1/styles")
n=$(echo "$r" | grep -o '"id":"[a-z]*"' | wc -l)
echo "$r" | grep -q '"id":"blog"' && echo "$r" | grep -q '"id":"enterprise"' && echo "$r" | grep -q '"id":"design"' \
  && ok "列出 3 内置包(blog/enterprise/design)" || bad "列包不全: $r"

# 6) 上传第四包（AC-7）
NEWID="agency"
# 幂等：先清掉可能残留的测试包（非内置可删）
code -X DELETE -H "$AUTH" "$BASE/api/v1/styles/$NEWID" >/dev/null 2>&1 || true
r=$(body -X POST -H "$AUTH" -H "Content-Type: application/json" "$BASE/api/v1/styles" \
  -d "{\"id\":\"$NEWID\",\"manifest\":{\"name\":\"测试代理包\",\"description\":\"x\",\"version\":\"1.0.0\",\"builtin\":false},\"theme\":\":root{--bg-primary:#ffffff;}\",\"layouts\":{\"homepage\":{\"sections\":[{\"component\":\"Hero\",\"variant\":\"carousel\"}]}},\"header\":{\"logo\":{\"src\":\"/uploads/logo.svg\"}},\"footer\":{}}")
echo "  上传返回: $r"
echo "$r" | grep -q '"success":true' && ok "POST /styles 上传第四包成功(201/200)" || bad "上传失败: $r"

# 7) 安全校验（AC-9）
# 7a theme 含 @import
c=$(code -X PUT -H "$AUTH" -H "Content-Type: application/json" "$BASE/api/v1/styles/$NEWID" \
  -d '{"theme":":root{@import url(http://evil);}"}')
[ "$c" = "400" ] && ok "theme 含 @import 被拒(400)" || bad "theme @import 未拒 -> $c"
# 7b id 穿越
c=$(code -X POST -H "$AUTH" -H "Content-Type: application/json" "$BASE/api/v1/styles" \
  -d '{"id":"../etc/passwd","manifest":{"name":"x"},"theme":":root{}"}')
[ "$c" = "400" ] && ok "id 含 .. 被拒(400)" || bad "id 穿越 -> $c"
# 7c 未知 component
c=$(code -X PUT -H "$AUTH" -H "Content-Type: application/json" "$BASE/api/v1/styles/$NEWID" \
  -d '{"layouts":{"homepage":{"sections":[{"component":"Backdoor","variant":"x"}]}}}')
[ "$c" = "400" ] && ok "未知 component 被拒(400)" || bad "未知 component 未拒 -> $c"
# 7d 内置包不可覆盖 POST
c=$(code -X POST -H "$AUTH" -H "Content-Type: application/json" "$BASE/api/v1/styles" \
  -d '{"id":"blog","manifest":{"name":"x"},"theme":":root{}"}')
{ [ "$c" = "409" ] || [ "$c" = "400" ]; } && ok "内置包 POST 覆盖被拒($c)" || bad "内置包覆盖 -> $c"
# 7e 内置包不可删除
c=$(code -X DELETE -H "$AUTH" "$BASE/api/v1/styles/blog")
[ "$c" = "403" ] && ok "内置包 DELETE 被拒(403)" || bad "内置包删除 -> $c"

# 8) 切换 active_style = enterprise（直接改库，模拟后台激活）
docker exec -i tokenpress-backend python3 - "$DB" <<PY
import sqlite3
db=sqlite3.connect("$DB")
db.execute("INSERT INTO site_settings(key,value) VALUES('active_style','enterprise') ON CONFLICT(key) DO UPDATE SET value='enterprise'")
db.commit()
PY
sleep 1
r=$(body "$BASE/api/v1/styles/active")
echo "$r" | grep -q '"activeStyle":"enterprise"' && ok "切换 active_style=enterprise 生效" || bad "切换 enterprise 未生效: $r"
# AC-1 SSR：enterprise 的 Header 动作「联系我们」应出现在首页 HTML
h=$(body "$BASE/")
echo "$h" | grep -q "联系我们" && ok "AC-1 首页 SSR 渲染 enterprise 动作(联系我们)" || bad "首页未渲染 enterprise 动作"
# enterprise 出厂配色 light
echo "$r" | grep -q '"defaultTheme":"light"' && ok "enterprise 出厂配色=light" || bad "enterprise defaultTheme 异常"

# 9) AC-2 配色正交：enterprise 布局下带 night cookie，应注入覆盖层（url 中带 --bg-primary 的 night 值）
h=$(body --cookie "token00_theme=night" "$BASE/")
echo "$h" | grep -q "style-theme-override" && ok "AC-2 night 配色覆盖层已注入(不影响布局)" || bad "night 覆盖层未注入"
# 布局未因配色变化：仍含 enterprise 动作
echo "$h" | grep -q "联系我们" && ok "AC-2 布局保持 enterprise(联系我们仍在)" || bad "配色切换改变了布局"

# 10) 切回 blog，首页不应再有「联系我们」
docker exec -i tokenpress-backend python3 - "$DB" <<PY
import sqlite3
db=sqlite3.connect("$DB")
db.execute("UPDATE site_settings SET value='blog' WHERE key='active_style'")
db.commit()
PY
sleep 1
h=$(body "$BASE/")
echo "$h" | grep -q "联系我们" && bad "blog 下首页仍含 enterprise 动作" || ok "切回 blog 后 enterprise 动作消失"

# 11) 静态资源预览图经 nginx→backend 可访问
c=$(code "$BASE/styles/blog/preview.png"); [ "$c" = "200" ] && ok "preview.png 静态可访问(200)" || bad "preview.png -> $c"

# 12) AC-4 板块页（blog）应返回 200 且为文章列表形态
c=$(code "$BASE/ai-coding"); [ "$c" = "200" ] && ok "板块页 /ai-coding 200" || bad "/ai-coding -> $c"

echo "===== 结果: PASS=$PASS FAIL=$FAIL ====="
