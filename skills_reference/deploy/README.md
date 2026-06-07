# TokenPress 部署工具

完整的 Docker 部署工作流，支持**本地部署**和**远程 VPS 部署**。

## 快速开始

### 1. 配置

```bash
# 复制配置模板
cp deploy/config/deploy.conf.sample deploy.conf
cp deploy/config/host.conf.sample host.conf

# 编辑配置
# deploy.conf - 端口、域名、JWT密钥
# host.conf   - VPS的SSH连接信息（仅VPS部署需要）
```

### 2. 部署

**Windows：**
```bash
deploy\deploy.bat local     # 部署到本地 Docker
deploy\deploy.bat vps       # 构建 + 上传 VPS + 部署
deploy\deploy.bat vps skip-build  # 跳过构建，只用已有镜像
```

**Linux / macOS / Git Bash：**
```bash
chmod +x deploy/deploy.sh
./deploy/deploy.sh local
./deploy/deploy.sh vps
./deploy/deploy.sh vps skip-build
```

## 工作流

| 步骤 | 说明 | 脚本 |
|------|------|------|
| 1. Build | 构建前后端 Docker 镜像 | `scripts/build-images.*` |
| 2. Status | 检查当前部署状态 | `scripts/check-status.*` |
| 3. Backup | 备份 SQLite 数据库 | `scripts/backup-db.*` |
| 4. Upload | 分片上传到 VPS（断点续传） | `scripts/upload-vps.*` |
| 5. Deploy | 本地/远程执行部署 | `scripts/deploy-local.*` / `scripts/deploy-vps.*` |
| 6. Verify | 健康检查（API + 容器状态） | `scripts/verify-health.*` |
| 7. Report | 生成部署报告 | `scripts/generate-report.*` |

## 核心特性

- **断点续传**：文件分片上传（默认50MB），SHA256校验，自动跳过已上传分片
- **网络容错**：每分片最多3次重试，SHA256保障文件完整性
- **数据库备份**：自动备份并保留最近10个，同时保存SHA256校验
- **配置解耦**：IP/SSH密钥/部署参数分离配置，无硬编码
- **双平台**：同时提供 `.bat`(Windows) 和 `.sh`(Linux/Git Bash) 脚本

## 单步使用

也可单独调用各步骤脚本：

```bash
# Windows
deploy\scripts\build-images.bat .
deploy\scripts\check-status.bat . vps
deploy\scripts\backup-db.bat . local
deploy\scripts\upload-vps.bat .
deploy\scripts\deploy-vps.bat .
deploy\scripts\verify-health.bat . vps

# Linux
bash deploy/scripts/build-images.sh .
bash deploy/scripts/verify-health.sh . local
```

## 配置文件

| 文件 | 用途 | 敏感信息 |
|------|------|---------|
| `deploy.conf` | 端口、域名、JWT密钥 | JWT_SECRET |
| `host.conf` | VPS SSH连接（IP/端口/密钥路径） | SSH私钥路径 |
