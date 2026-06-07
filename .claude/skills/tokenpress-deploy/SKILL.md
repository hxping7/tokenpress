---
name: yourdomain-deploy
description: "TokenPress 项目 Docker 部署技能。支持本地 Docker 部署和远程 VPS 部署。完整工作流：构建镜像→备份数据库→上传（断点续传+SHA256校验）→部署→健康检查→生成报告。配置通过 deploy.conf 和 host.conf 解耦，无硬编码凭据。适用于 TokenPress Next.js + Express 项目."
agent_created: true
---

# TokenPress Deploy Skill

## 工作流概览

```
用户请求部署 → 确认模式(local/vps) → 执行流程
                                         │
            ┌─────────────────────────────┼─────────────────────────────┐
            ▼                             ▼                             ▼
      Step 1: 构建镜像             Step 1: 构建镜像             Step 1: 构建镜像
      Step 2: 检查本地状态         Step 2: 检查本地状态         Step 2: 检查本地状态
      Step 3: 备份数据库(本地)     Step 3: 备份数据库(本地)     Step 3: 备份数据库(本地)
      Step 4: 部署到本地 Docker    Step 4: 上传到 VPS(断点续传)  Step 4: 上传到 VPS(断点续传)
      Step 5: 健康检查             Step 5: 部署到 VPS           Step 5: 部署到 VPS
      Step 6: 生成报告             Step 6: 健康检查             Step 6: 健康检查
                                   Step 7: 生成报告             Step 7: 生成报告
```

## 适用场景

- 用户说"部署 yourdomain"、"发布到服务器"、"更新 yourdomain"
- 用户说"deploy yourdomain"、"build and deploy"
- 用户要求构建 + 部署 TokenPress 项目到本地 Docker 或远程 VPS
- 用户需要"断点续传"、"检查部署状态"、"生成部署报告"
- 用户需要"SSL证书"、"HTTPS"、"Let's Encrypt"

## 前置条件

1. 项目根目录必须存在 `deploy.conf`（从 `deploy.conf.sample` 复制）
2. VPS 部署还需 `host.conf`（从 `host.conf.sample` 复制）
3. Docker Desktop 已安装并运行（本地模式）
4. VPS 已安装 Docker + Docker Compose（VPS 模式）
5. 支持 `ssh` 和 `scp` 命令（VPS 模式，Windows 10/11 自带 OpenSSH）
6. **可选** - SSL 证书：VPS 已安装 certbot（VPS 模式 + ENABLE_SSL=true）

## SSL 证书前置条件

如果需要自动配置 HTTPS：
- VPS 已安装 certbot: `apt install certbot python3-certbot-nginx`
- 域名已解析到 VPS IP
- 域名 DNS 检查通过（无红名等）

如果还没有域名，可在 `deploy.conf` 中先不设置 `DOMAIN`，跳过 SSL 配置。

## 平台选择

技能为 **Windows 和 Linux/macOS** 双平台设计。每个步骤有对应的 `.bat` 和 `.sh` 脚本：

| 平台 | 脚本后缀 | 执行方式 |
|------|----------|---------|
| Windows | `.bat` | `cmd /c script.bat ...`（通过 PowerShell 工具） |
| Linux/macOS / Git Bash | `.sh` | `bash script.sh` |

**Windows 执行注意事项：**

1. **编码**：所有 `.bat` 脚本使用 ASCII 安全输出，避免 `chcp 65001` 导致的 `for` 循环 bug。纯 ASCII 字符（`[UPLOAD]`、`[OK]` 等）在任何 codepage 下均正常。
2. **PowerShell**：SHA256 哈希计算、文件分片、gzip 压缩均通过 `powershell -NoProfile -ExecutionPolicy Bypass` 调用，不依赖 `gzip.exe` 或 Unix `split`。
3. **SSH/SCP**：VPS 操作前会自动检查 `ssh.exe` 是否存在（`where ssh >nul 2>&1`），若不存在则报错退出。
4. **路径**：所有文件路径使用双引号包裹，支持带空格的路径。
5. **执行方式**：
   - 从 **PowerShell 工具**：直接 `.\script.bat <args>`
   - 从 **Bash 工具**（Git Bash）：`cmd /c "script.bat <args>"`
6. **错误码**：每个脚本使用独立的 exit code（1-10），方便 AI 判断具体失败原因。

**注意：** 以下步骤说明以 `.sh` 脚本为例。在 Windows 上使用时，将命令中的 `.sh` 替换为 `.bat`。

## 技能文件结构

```
~/.workbuddy/skills/yourdomain-deploy/
├── SKILL.md                        # 本文件 - 部署流程指引
├── scripts/
│   ├── build-images.bat/.sh        # 构建 Docker 镜像并导出
│   ├── backup-db.bat/.sh           # 备份 SQLite 数据库
│   ├── check-status.bat/.sh        # 检查当前部署状态
│   ├── upload-vps.bat/.sh          # 分片上传到 VPS（断点续传）
│   ├── deploy-vps.bat/.sh          # 在 VPS 上执行部署
│   ├── deploy-local.bat/.sh        # 部署到本地 Docker
│   ├── verify-health.bat/.sh       # 健康检查验证
│   └── generate-report.bat/.sh     # 生成部署报告
└── references/
    └── deploy-config.md            # 配置参考文档
```

**注意：** 以下步骤说明以 `.sh` 脚本为例。在 Windows 上使用时，将命令中的 `.sh` 替换为 `.bat`，执行方式改为直接用 cmd 调用（例如 `build-images.bat <project-dir>`）。

---

## 执行流程

### Step 0: 确认部署模式

询问用户部署模式：

- **local** - 部署到本地 Docker（Windows/Linux Docker Desktop）
- **vps** - 构建后在本地，上传到远程 VPS 并部署

### Step 1: 构建镜像

调用 `build-images.sh` 构建前后端 Docker 镜像：

```bash
bash <SKILL_DIR>/scripts/build-images.sh <PROJECT_DIR>
```

**规则：**
- 构建分两步执行：先 `--target backend`，再 `--target frontend`
- 任意一步失败（exit code != 0），**立即终止流程**，向用户报告编译错误
- 成功后导出为 `yourdomain-backend.tar.gz` + `yourdomain-frontend.tar.gz`
- 同时生成 `.sha256` 校验文件供后续完整性验证
- 记录构建结果（成功/失败）

### Step 2: 检查部署状态

调用 `check-status.sh` 检查当前环境状态：

```bash
bash <SKILL_DIR>/scripts/check-status.sh <PROJECT_DIR> <mode>
```

本地模式检查项：
- Docker 是否可用
- Docker Compose 是否可用
- 镜像是否存在
- 容器是否在运行
- API 健康端点是否可达

VPS 模式额外检查：
- SSH 连接是否正常
- VPS 上的 Docker 版本
- 远程镜像和容器状态

**规则：**
- 如果检查到旧版本容器在运行，记录下来供后续对比
- 检查结果不影响流程继续（仅信息收集）

### Step 3: 备份数据库

调用 `backup-db.sh` 备份 SQLite 数据库：

```bash
bash <SKILL_DIR>/scripts/backup-db.sh <PROJECT_DIR> <mode>
```

**规则：**
- 备份文件命名：`yourdomain-db-backup-YYYYMMDD_HHMMSS.db`
- 保存在 `data/backups/` 目录
- 同时生成 `.sha256` 校验文件
- 自动清理旧备份（保留最近 10 个）
- VPS 模式通过 SSH 从远程容器或卷中复制数据库
- 如果数据库不存在（首次部署），记录为 WARNING 而非 ERROR

### Step 4: 上传文件（仅 VPS 模式）

调用 `upload-vps.sh` 执行分片上传：

```bash
bash <SKILL_DIR>/scripts/upload-vps.sh <PROJECT_DIR>
```

**断点续传机制：**
1. 文件按 `CHUNK_MB`（默认 50MB）分片
2. 每个分片生成 SHA256 校验和
3. 逐片上传到 VPS 临时目录
4. 上传后立即校验分片完整性
5. 如果校验失败，自动重试（最多 3 次）
6. 所有分片上传完成后，在 VPS 上合并
7. 合并后对整个文件做 SHA256 完整性校验
8. 确认完整后，清理临时分片

**网络波动处理：**
- 单分片上传失败自动重试（最多 3 次）
- 重试间隔 2 秒
- 已上传成功且校验通过的分片自动跳过
- 如果中间中断，重新运行会从断点继续

**文件完整性保障：**
- 分片级别：每个分片 SHA256 校验
- 文件级别：最终合并后 SHA256 对比
- 入站验证：对比远程文件 SHA256 与本地 `.sha256` 文件

### Step 4 (local): 部署到本地 Docker

调用 `deploy-local.sh`：

```bash
bash <SKILL_DIR>/scripts/deploy-local.sh <PROJECT_DIR>
```

流程：
1. 检查 Docker + Docker Compose
2. 导入构建好的镜像（回退到 `docker compose build`）
3. 生成 `.env` 配置文件
4. 停止旧容器 → 启动新容器
5. 等待后端健康（最多 90 秒）

### Step 5 (vps): 在 VPS 上执行部署

调用 `deploy-vps.sh`：

```bash
bash <SKILL_DIR>/scripts/deploy-vps.sh <PROJECT_DIR>
```

流程：
1. 确保 `deploy.sh` 在 VPS 上可执行（修复行尾符）
2. SSH 执行 `deploy.sh`
3. 等待服务启动（最多 90 秒）
4. 输出部署日志路径

### Step 5.5: Nginx + SSL 配置（仅 VPS 模式，仅当 ENABLE_SSL=true）

**如果用户没有配置域名**，跳过此步骤并告知用户：
> 当前未配置域名，无法自动申请 SSL 证书。如需 HTTPS，请：
> 1. 在 `deploy.conf` 中设置 `DOMAIN=yourdomain.com`
> 2. 将域名解析到 VPS IP
> 3. 重新运行部署

**如果有域名**，调用 `configure-ssl.sh`（新增）：

```bash
bash <SKILL_DIR>/scripts/configure-ssl.sh <PROJECT_DIR>
```

流程：
1. **���查当前 SSL 状态**
   - 检查 `/etc/letsencrypt/live/{DOMAIN}/` 是否已有证书
   - 如已有有效证书，跳过申请步骤

2. **创建 Let's Encrypt 目录**
   ```bash
   ssh <HOST> "mkdir -p /var/www/certbot"
   ```

3. **申请 SSL 证书**（webroot 方式）
   ```bash
   ssh <HOST> "certbot certonly --webroot -w /var/www/certbot -d \${DOMAIN} -d www.\${DOMAIN}"
   ```

4. **生成独立 Nginx 配置**
   - 创建 `/etc/nginx/conf.d/yourdomain.conf`
   - 只包含本项目的 server 块（HTTPS 启用）
   - 不修改主 nginx 配置或其他网站配置

5. **配置自动续期**
   ```bash
   ssh <HOST> "echo '0 3 * * * certbot renew --quiet && docker restart yourdomain-nginx' | crontab -"
   ```

6. **测试续期**
   ```bash
   ssh <HOST> "certbot renew --dry-run"
   ```

**增量修改原则：**
- 每个项目使用独立的 nginx 配置文件
- 证书存放在项目专属目录 `/etc/letsencrypt/live/{DOMAIN}/`
- 自动续期只重启本项目的容器
- 不影响 VPS 上其他网站

### Step 6: 健康检查

调用 `verify-health.sh`：

```bash
bash <SKILL_DIR>/scripts/verify-health.sh <PROJECT_DIR> <mode>
```

检查项：
1. **Docker 容器状态** - 所有 yourdomain- 容器是否正常运行
2. **API 健康端点** - `GET /api/v1/health` 返回 200
3. **前端可达性** - `GET /` 返回 200/301/302
4. **API 响应时间** - 是否在可接受范围内
5. **磁盘使用率**（VPS 模式）

**规则：**
- 容器检查和前端检查为 WARN 级别（不影响总体结果）
- API 健康检查为 ERROR 级别（失败则标记整体为 FAILED）

### Step 7: 生成部署报告

调用 `generate-report.sh`：

```bash
bash <SKILL_DIR>/scripts/generate-report.sh <PROJECT_DIR> <mode> <build-result> <backup-result> <upload-result> <deploy-result> <verify-result>
```

参数说明：
- `build-result` - 构建步骤结果（"success" / "failed" / "skipped"）
- `backup-result` - 备份步骤结果
- `upload-result` - 上传步骤结果（local 模式为 "N/A"）
- `deploy-result` - 部署步骤结果
- `verify-result` - 健康检查结果（"true" / "false" / "skipped"）

**规则：**
- 报告保存为 `.deploy-state/deploy-report-YYYYMMDD_HHMMSS.md`
- 包含：时间、模式、目标、Git 信息、各步骤结果、镜像大小
- 报告文件路径通过工具结果返回

---

## 配置参考

完整的配置字段说明见 `references/deploy-config.md`。

**关键原则：IP、SSH 密钥等敏感信息不写入技能文件本身，通过项目目录下的两个配置文件管理：**

| 文件 | 内容 |
|------|------|
| `deploy.conf` | 端口、域名、JWT_SECRET、SITE_PATH |
| `host.conf` | VPS_HOST、VPS_USER、VPS_PORT、SSH_KEY |

---

## 错误处理指南

### 构建失败
- **原因**: 代码编译错误
- **处理**: 立即终止，向用户报告具体错误信息，不进行后续步骤

### 上传中断
- **原因**: 网络断开、SCP超时
- **处理**: 重新运行技能，upload-vps.sh 会自动检测已上传分片并继续

### 部署失败
- **原因**: Docker 服务异常、配置错误
- **处理**: 检查部署日志（保存于 `.deploy-state/`），修复后重新运行

### 健康检查失败
- **原因**: 服务未完全启动、端口冲突
- **处理**: 
  - 等待更长时间后重试健康检查
  - 检查容器日志：`docker logs yourdomain-backend --tail 50`
  - 检查端口冲突：`netstat -ano | findstr :PORT`

### 报告生成
即便某步骤失败，仍应生成报告以记录失败结果供排查。
