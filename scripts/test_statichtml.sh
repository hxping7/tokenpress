 set -u
UA='Mozilla/5.0'
B=http://localhost:4001          # backend direct
N=http://localhost:8081          # nginx
WRITE=t00_sk_LOCAL_shwrite
READ=t00_sk_LOCAL_shread
NOPERM=t00_sk_LOCAL_shnoperm

# Clean any leftovers from prior runs (idempotency)
for p in item1 rf rf2 rnx1 rnx2; do
  curl -s -o /dev/null -A "$UA" -X DELETE "$B/api/v1/statichtml/folder" -H "Authorization: Bearer $WRITE" -H 'Content-Type: application/json' -d "{\"path\":\"$p\"}"
done

pass=0; fail=0
chk(){ # $1=name $2=expected_status $3=actual_status
  if [ "$2" = "$3" ]; then echo "  PASS [$1] -> $3"; pass=$((pass+1)); else echo "  FAIL [$1] expected $2 got $3"; fail=$((fail+1)); fi
}

echo "=== 1. No token -> write should be rejected (401) ==="
code=$(curl -s -o /dev/null -w '%{http_code}' -A "$UA" -X POST "$B/api/v1/statichtml/folder" -H 'Content-Type: application/json' -d '{"path":"x"}')
chk "no-token write" 401 "$code"

echo "=== 2. READ token on read endpoint (200) ==="
code=$(curl -s -o /dev/null -w '%{http_code}' -A "$UA" "$B/api/v1/statichtml/list" -H "Authorization: Bearer $READ")
chk "read-token list" 200 "$code"

echo "=== 3. WRITE token: create folder item1 (201) ==="
code=$(curl -s -o /dev/null -w '%{http_code}' -A "$UA" -X POST "$B/api/v1/statichtml/folder" -H "Authorization: Bearer $WRITE" -H 'Content-Type: application/json' -d '{"path":"item1"}')
chk "write-token mkdir item1" 201 "$code"

echo "=== 4. WRITE token: upload file item1/test1.html (201) ==="
code=$(curl -s -o /dev/null -w '%{http_code}' -A "$UA" -X POST "$B/api/v1/statichtml/file" -H "Authorization: Bearer $WRITE" -H 'Content-Type: application/json' -d '{"folder":"item1","filename":"test1.html","content":"<h1>Hello Static</h1>"}')
chk "write-token upload html" 201 "$code"

echo "=== 5. WRITE token: upload nested item1/sub/a.css (201) ==="
code=$(curl -s -o /dev/null -w '%{http_code}' -A "$UA" -X POST "$B/api/v1/statichtml/file" -H "Authorization: Bearer $WRITE" -H 'Content-Type: application/json' -d '{"folder":"item1/sub","filename":"a.css","content":"body{color:red}"}')
chk "write-token upload nested css" 201 "$code"

echo "=== 5b. Rename: file rf/old.html -> rf/new.html ; folder rf -> rf2 ==="
curl -s -o /dev/null -A "$UA" -X POST "$B/api/v1/statichtml/folder" -H "Authorization: Bearer $WRITE" -H 'Content-Type: application/json' -d '{"path":"rf"}'
curl -s -o /dev/null -A "$UA" -X POST "$B/api/v1/statichtml/file" -H "Authorization: Bearer $WRITE" -H 'Content-Type: application/json' -d '{"folder":"rf","filename":"old.html","content":"<p>rename me</p>"}'
code=$(curl -s -o /dev/null -w '%{http_code}' -A "$UA" -X PATCH "$B/api/v1/statichtml/file" -H "Authorization: Bearer $WRITE" -H 'Content-Type: application/json' -d '{"relPath":"rf/old.html","newName":"new.html"}')
chk "rename file 200" 200 "$code"
code=$(curl -s -o /dev/null -w '%{http_code}' -A "$UA" "$N/statichtml/rf/new.html")
chk "renamed file served 200" 200 "$code"
code=$(curl -s -o /dev/null -w '%{http_code}' -A "$UA" "$N/statichtml/rf/old.html")
chk "old file name 404" 404 "$code"
code=$(curl -s -o /dev/null -w '%{http_code}' -A "$UA" -X PATCH "$B/api/v1/statichtml/folder" -H "Authorization: Bearer $WRITE" -H 'Content-Type: application/json' -d '{"path":"rf","newName":"rf2"}')
chk "rename folder 200" 200 "$code"
code=$(curl -s -o /dev/null -w '%{http_code}' -A "$UA" "$N/statichtml/rf2/new.html")
chk "renamed folder served 200" 200 "$code"
code=$(curl -s -o /dev/null -w '%{http_code}' -A "$UA" "$N/statichtml/rf/new.html")
chk "old folder name 404" 404 "$code"

echo "=== 5c. Rename extension protection: .exe -> 400 ==="
code=$(curl -s -o /dev/null -w '%{http_code}' -A "$UA" -X PATCH "$B/api/v1/statichtml/file" -H "Authorization: Bearer $WRITE" -H 'Content-Type: application/json' -d '{"relPath":"rf2/new.html","newName":"bad.exe"}')
chk "rename to exe 400" 400 "$code"

echo "=== 6. Static serving via nginx (200 + correct body) ==="
body=$(curl -s -A "$UA" "$N/statichtml/item1/test1.html")
echo "  body: $body"
echo "$body" | grep -q "Hello Static" && { echo "  PASS [nginx serve html]"; pass=$((pass+1)); } || { echo "  FAIL [nginx serve html]"; fail=$((fail+1)); }
code=$(curl -s -o /dev/null -w '%{http_code}' -A "$UA" "$N/statichtml/item1/sub/a.css")
chk "nginx serve css" 200 "$code"

echo "=== 7. Static serving via backend direct (200) ==="
code=$(curl -s -o /dev/null -w '%{http_code}' -A "$UA" "$B/statichtml/item1/test1.html")
chk "backend serve html" 200 "$code"

echo "=== 8. tree returns structure ==="
tree=$(curl -s -A "$UA" "$B/api/v1/statichtml/tree" -H "Authorization: Bearer $READ")
echo "  tree: $tree" | head -c 400; echo
echo "$tree" | grep -q "test1.html" && { echo "  PASS [tree contains test1.html]"; pass=$((pass+1)); } || { echo "  FAIL [tree]"; fail=$((fail+1)); }

echo "=== 9. NOPERM token (article:write) write -> 403 ==="
code=$(curl -s -o /dev/null -w '%{http_code}' -A "$UA" -X POST "$B/api/v1/statichtml/folder" -H "Authorization: Bearer $NOPERM" -H 'Content-Type: application/json' -d '{"path":"zzz"}')
chk "noperm write 403" 403 "$code"

echo "=== 10. READ-only token write -> 403 ==="
code=$(curl -s -o /dev/null -w '%{http_code}' -A "$UA" -X POST "$B/api/v1/statichtml/folder" -H "Authorization: Bearer $READ" -H 'Content-Type: application/json' -d '{"path":"zzz"}')
chk "readonly write 403" 403 "$code"

echo "=== 11. Extension protection: .exe -> 400 ==="
code=$(curl -s -o /dev/null -w '%{http_code}' -A "$UA" -X POST "$B/api/v1/statichtml/file" -H "Authorization: Bearer $WRITE" -H 'Content-Type: application/json' -d '{"folder":"item1","filename":"evil.exe","content":"x"}')
chk "exe upload 400" 400 "$code"

echo "=== 12. Path traversal protection (backend must NOT serve /etc/passwd) ==="
body=$(curl -s -A "$UA" "$B/statichtml/..%2f..%2f..%2fetc%2fpasswd")
echo "$body" | grep -q "root:" && { echo "  FAIL [traversal leaked passwd]"; fail=$((fail+1)); } || { echo "  PASS [traversal blocked]"; pass=$((pass+1)); }
code=$(curl -s -o /dev/null -w '%{http_code}' -A "$UA" "$B/statichtml/..%2f..%2f..%2fetc%2fpasswd")
echo "  status=$code (non-200 or 404 expected; must not be 200 with passwd)"

echo "=== 13. PUT replace file content (200) ==="
code=$(curl -s -o /dev/null -w '%{http_code}' -A "$UA" -X PUT "$B/api/v1/statichtml/file" -H "Authorization: Bearer $WRITE" -H 'Content-Type: application/json' -d '{"relPath":"item1/test1.html","content":"<h1>Updated</h1>"}')
chk "put replace 200" 200 "$code"
body=$(curl -s -A "$UA" "$N/statichtml/item1/test1.html")
echo "$body" | grep -q "Updated" && { echo "  PASS [replace content]"; pass=$((pass+1)); } || { echo "  FAIL [replace content] got: $body"; fail=$((fail+1)); }

echo "=== 14. DELETE file (200) then 404 on re-GET ==="
code=$(curl -s -o /dev/null -w '%{http_code}' -A "$UA" -X DELETE "$B/api/v1/statichtml/file" -H "Authorization: Bearer $WRITE" -H 'Content-Type: application/json' -d '{"relPath":"item1/sub/a.css"}')
chk "delete file 200" 200 "$code"
code=$(curl -s -o /dev/null -w '%{http_code}' -A "$UA" "$N/statichtml/item1/sub/a.css")
chk "deleted file 404" 404 "$code"

echo "=== 15. DELETE folder recursive (200) ==="
code=$(curl -s -o /dev/null -w '%{http_code}' -A "$UA" -X DELETE "$B/api/v1/statichtml/folder" -H "Authorization: Bearer $WRITE" -H 'Content-Type: application/json' -d '{"path":"item1"}')
chk "delete folder 200" 200 "$code"
code=$(curl -s -o /dev/null -w '%{http_code}' -A "$UA" "$N/statichtml/item1/test1.html")
chk "deleted folder html 404" 404 "$code"
code=$(curl -s -o /dev/null -w '%{http_code}' -A "$UA" -X DELETE "$B/api/v1/statichtml/folder" -H "Authorization: Bearer $WRITE" -H 'Content-Type: application/json' -d '{"path":"rf2"}')
chk "delete rf2 folder 200" 200 "$code"

echo "=== SUMMARY ==="
echo "PASS=$pass FAIL=$fail"
