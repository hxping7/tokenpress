---
name: token00-settings
description: 通过 API Token 远程控制 Token00 网站 (www.token00.com) 的全部系统设置：基础/UI/Logo/Hero/Banner/页脚导航/页脚/分析/安全/备份/分享/轮播，以及友链与顶部导航。支持读取、批量修改、按分组修改，并通过不同权限的 access token 实现安全隔离。当用户提到"改设置"、"配置首页"、"设置 Hero"、"配置中部 banner"、"改导航"、"改友链"、"远程改站点配置"时触发。
agent_created: true
---

# Token00 Settings Controller

通过 API Token 远程读取与修改 Token00 全站系统设置。复用与 `token00-publisher` 相同的 `.token00.conf` 配置与鉴权方式，但权限不同（`settings:write` / `friendlinks:write` / `sections:write`）。

## 配置（`.token00.conf`）

与 `token00-publisher` 共用同一份配置（项目根目录，建议加入 `.gitignore`）：

```json
{
  "api_base": "https://www.token00.com/api/v1",
  "token": "t00_sk_xxxxx",
  "author": "GLM"
}
```

| 字段 | 必填 | 说明 |
|------|------|------|
| `api_base` | Y | API 基础 URL（本地 `http://localhost:4001/api/v1`） |
| `token` 或 `token_file` | Y* | API Token（直接值或文件路径） |

配置优先级：CLI 参数 `--api-base` / `--token` > 环境变量 `TOKEN00_API_BASE` / `TOKEN00_TOKEN` > `.token00.conf` > `pub_token.txt`

## 触发条件

| 意图 | 示例 |
|------|------|
| **读设置** | "看看现在站点名是什么"、"读取首页 banner 配置"、"导出全部设置" |
| **改设置** | "把站点名改成 X"、"首页 Hero CTA 改成『Token 套餐』"、"开启中部 banner 并设 CTA 连 /blog" |
| **改分组** | "把 UI 主题改成赛博风"、"把页脚版权信息改掉"、"开启内容审核" |
| **改导航/友链** | "加一个友链"、"顶部导航加一个板块"、"删除某个友链" |
| **批量改** | "按这份 JSON 更新设置" |

## ⚠️ 前置条件（每次使用前确认）

1. **必须有带对应权限的 API Token**（在管理后台「系统设置 → API Token」创建）：
   - 改 `site_settings` 类设置 → 需要权限 **`settings:write`**
   - 改友链 → 需要权限 **`friendlinks:write`**
   - 改顶部导航(sections) → 需要权限 **`sections:write`**
2. **安全隔离**：不同 agent / 不同用途发**不同 Token、给最小权限**。例如内容发布机器人只给 `article:write`，绝不给 `settings:write`；站点配置机器人给 `settings:write` 但不给 `sections:write`。Token 缺失/无权限会返回 401/403。
3. **IS 缓存**：首页有 `revalidate:60` 缓存，改完最多等约 1 分钟或强刷才能看到效果（部分设置由 `PUT /site-settings` 自动触发 `revalidatePath('/')`）。

## 权限隔离模型

| 资源 | 接口 | 所需 Token 权限 |
|------|------|----------------|
| 全部 KV 设置（基础/UI/Hero/Banner/页脚/分析/安全/备份/分享/轮播） | `GET/PUT /api/v1/site-settings` | `settings:write`（读为公开） |
| 友链 | `GET/POST/PUT/DELETE /api/v1/friend-links` | `friendlinks:write` |
| 顶部导航 | `GET/POST/PUT/DELETE /api/v1/sections` | `sections:write` |

> 公开读接口（如 `GET /site-settings`、`GET /sections`、`GET /friend-links`）无需 Token；写接口必须对应权限 Token 或管理员 JWT。

## 核心功能

### 1. 读取设置

```bash
# 读取全部设置（公开，无需 token）
python scripts/settings.py get

# 按 key 读取
python scripts/settings.py get --keys site_name,default_theme,home_banner_enabled

# 按分组读取（逻辑分组，脚本会自动挑选该组相关 key）
python scripts/settings.py get --group home
# 可选分组: basic ui logo home nav footer analytics security backup share hero banner
```

### 2. 修改设置（单个）

```bash
# 纯文本值
python scripts/settings.py set --key site_name --value "TokenPress"

# JSON 结构值（直接传 JSON 文本，脚本会做格式/枚举校验）
python scripts/settings.py set --key hero_cta_buttons --value '[{"label":"Token 套餐","href":"/token-plan","target":"_self","variant":"primary"}]'

# 开启中部 banner 并设为 CTA 类型、按钮连 /blog
python scripts/settings.py set --key home_banner_enabled --value "true"
python scripts/settings.py set --key home_banner_type --value "cta"
python scripts/settings.py set --key home_banner_cta --value '{"title":"欢迎","subtitle":"","buttonText":"逛博客","buttonLink":"/blog","buttonTarget":"_self","bgImage":"","gradient":"","align":"center"}'
```

### 3. 批量修改

```bash
# 从 JSON 文件批量更新（文件内容: {"key": "value", ...}）
python scripts/settings.py set-many --file my-settings.json

# 从命令行 JSON 字符串批量更新
python scripts/settings.py set-many --data '{"site_name":"TokenPress","default_theme":"cyber"}'
```

### 4. 友链管理（需 `friendlinks:write`）

```bash
python scripts/settings.py links list
python scripts/settings.py links add --name "示例站" --url "https://example.com" --description "友情链接" --sort-order 0
python scripts/settings.py links update --id 3 --name "新名字" --url "https://new.com"
python scripts/settings.py links delete --id 3
```

### 5. 顶部导航管理（需 `sections:write`）

```bash
python scripts/settings.py sections list
python scripts/settings.py sections add --name "新板块" --path "/new" --description "..." 
python scripts/settings.py sections update --id 2 --name "改名" --is-active true
python scripts/settings.py sections delete --id 2
```

### 6. 客户端校验（防脏写）

`set` / `set-many` 内置校验（见 `references/settings-schema.md`）：
- **枚举值**：`default_theme` ∈ `night|cyber|lava|light|space`，`home_banner_type` ∈ `cta|cards|image|notice` 等，非法值直接拒绝并报出可取值。
- **JSON 格式**：对期望 JSON 的 key（如 `hero_cta_buttons`、`home_banner_cta`、`footer_nav`、`share_config`），自动 `json.loads` 校验，解析失败报错。
- **布尔**：`*_enabled` 类接受 `true/false/1/0/yes/no`。

## 设置项完整契约

所有 key 的名称、格式、枚举、JSON 结构见 **`references/settings-schema.md`**。agent 在写设置前务必对照该契约，避免错 key 或坏 JSON。

## API 参考

完整接口文档（请求/响应/错误码）见 **`references/api-reference.md`**。

## 注意事项

1. **编码**：Windows 下脚本已用 Python 发送请求并处理 UTF-8，避免中文乱码。
2. **value 一律是字符串**：KV 表的 value 是字符串。JSON 结构设置请直接传 JSON 文本（脚本原样存储）。
3. **未知 key**：`PUT /site-settings` 会原样 upsert 任意 key，但脚本只校验「已知 key」；未知 key 也会尝试写入（方便未来扩展），仅做 JSON 合法性提示。
4. **限流**：服务端对发布接口有 10 次/分钟限制；设置接口暂无硬性限流，但请勿高频刷写。
5. **备份**：改重要设置前建议先 `python scripts/settings.py get --group all > before.json` 备份当前值。
