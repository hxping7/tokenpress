# Token00 设置控制 API 参考

## 概述

本 API 允许 AI 智能体通过 API Token 远程读取与修改 Token00 全站系统设置：
基础 / UI / Logo / Hero / Banner / 页脚导航 / 页脚 / 分析 / 安全 / 备份 / 分享 / 轮播，
以及友链与顶部导航。

## 认证方式

所有**写**请求需要 Bearer Token 认证：

```
Authorization: Bearer t00_sk_xxxxx
```

- Token 格式：以 `t00_sk_` 开头的字符串
- Token 需要在管理后台「系统设置 → API Token」创建并分配对应权限
- **读**接口（GET）公开，无需 Token

## 权限矩阵

| 接口 | 权限 |
|------|------|
| `GET/PUT /api/v1/site-settings` | 读公开；写需 `settings:write` |
| `GET/POST/PUT/DELETE /api/v1/friend-links` | 读公开；写需 `friendlinks:write` |
| `GET/POST/PUT/DELETE /api/v1/sections` | 读公开；写需 `sections:write` |

> 安全隔离：给不同 agent 发不同权限的 Token。内容机器人只给 `article:write` 绝不给 `settings:write`；配置机器人给 `settings:write` 但不给 `sections:write`。

---

## 1. 读取全部设置

```
GET /api/v1/site-settings
```

**响应**
```json
{
  "success": true,
  "data": {
    "site_name": "TokenPress",
    "default_theme": "night",
    "home_banner_enabled": "false",
    "hero_cta_buttons": "[{\"label\":\"Token 套餐\",...}]"
  }
}
```

## 2. 按 key 读取

```
GET /api/v1/site-settings/keys/site_name,default_theme
```

## 3. 修改设置（单个/批量）

```
PUT /api/v1/site-settings
Content-Type: application/json
Authorization: Bearer t00_sk_xxxxx
```

**请求体**
```json
{
  "settings": {
    "site_name": "TokenPress",
    "default_theme": "cyber",
    "home_banner_enabled": "true",
    "home_banner_cta": "{\"title\":\"欢迎\",\"buttonText\":\"逛博客\",\"buttonLink\":\"/blog\",\"buttonTarget\":\"_self\",\"align\":\"center\"}"
  }
}
```

**成功响应**
```json
{
  "success": true,
  "data": { "site_name": "TokenPress", "default_theme": "cyber", "...": "..." }
}
```

**说明**
- `value` 一律为字符串；JSON 结构设置传入 JSON 文本。
- 修改后自动 `revalidatePath('/')`，首页 ISR 缓存约 60s 内生效。
- 修改 `review_*` 前缀会重新加载内容审核 provider。

## 4. 友链（friend-links）— `friendlinks:write`

### 列表
```
GET /api/v1/friend-links
```

### 新增
```
POST /api/v1/friend-links
Authorization: Bearer t00_sk_xxxxx
{ "name": "示例站", "url": "https://example.com", "description": "友链", "sortOrder": 0, "isActive": true }
```

### 更新
```
PUT /api/v1/friend-links/:id
Authorization: Bearer t00_sk_xxxxx
{ "name": "新名", "url": "https://new.com" }
```

### 删除
```
DELETE /api/v1/friend-links/:id
Authorization: Bearer t00_sk_xxxxx
```

## 5. 顶部导航（sections）— `sections:write`

### 列表
```
GET /api/v1/sections
```

### 新增
```
POST /api/v1/sections
Authorization: Bearer t00_sk_xxxxx
{ "name": "新板块", "path": "/new", "description": "描述", "sortOrder": 0, "isActive": true }
```

### 更新
```
PUT /api/v1/sections/:id
Authorization: Bearer t00_sk_xxxxx
{ "name": "改名", "isActive": false }
```

### 删除
```
DELETE /api/v1/sections/:id
Authorization: Bearer t00_sk_xxxxx
```

---

## 错误响应

### 认证错误（401）
```json
{ "success": false, "error": "API token not found" }
{ "success": false, "error": "API token has been revoked" }
{ "success": false, "error": "API token has expired" }
{ "success": false, "error": "Invalid API token" }
```

### 权限错误（403）
```json
{ "success": false, "error": "Missing required permission: settings:write" }
{ "success": false, "error": "Missing required permission: friendlinks:write" }
{ "success": false, "error": "Missing required permission: sections:write" }
```

### 请求错误（400）
```json
{ "success": false, "error": "Name and URL are required" }   // friend-links
{ "success": false, "error": "Name and path are required" }  // sections
{ "success": false, "error": "Settings object is required" }  // site-settings
```

### 冲突（409）
```json
{ "success": false, "error": "Section with this slug already exists" }
```

---

## 使用示例（Python）

```python
import urllib.request, json

TOKEN = "t00_sk_xxxxx"
BASE = "https://www.token00.com/api/v1"

def call(method, path, body=None):
    url = BASE + path
    data = json.dumps(body, ensure_ascii=False).encode() if body else None
    req = urllib.request.Request(url, data=data, method=method,
        headers={"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode())

# 读取全部设置
print(call("GET", "/site-settings"))

# 修改单个设置
call("PUT", "/site-settings", {"settings": {"default_theme": "cyber"}})

# 新增友链
call("POST", "/friend-links", {"name": "示例", "url": "https://example.com"})

# 新增顶部导航板块
call("POST", "/sections", {"name": "新板块", "path": "/new"})
```

详见技能脚本 `scripts/settings.py`（含客户端枚举/JSON 校验）。

## 完整 API 基础 URL

- 开发环境：`http://localhost:4001/api/v1`
- 生产环境：`https://www.token00.com/api/v1`

## 健康检查

```
GET /api/v1/health
```
