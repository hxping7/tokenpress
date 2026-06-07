# TokenPress 部署配置参考

## 配置文件体系

部署配置分为两个文件，职责分离：

| 文件 | 用途 | 是否版本控制 | 敏感信息 |
|------|------|-------------|---------|
| `deploy.conf` | 部署参数（端口、域名、JWT密钥等） | 否（`deploy.conf.sample` 可提交） | JWT_SECRET |
| `host.conf` | VPS SSH连接信息 | 否（`host.conf.sample` 可提交） | SSH_KEY路径 |

## deploy.conf

```ini
# 站点域名（SSL证书用）
DOMAIN=www.yourdomain.com

# VPS 上部署路径
SITE_PATH=/root/yourdomain

# 端口
HTTP_PORT=8081
HTTPS_PORT=8444

# JWT 密钥（必填）
JWT_SECRET=your-random-secret-here

# 站点URL（可选，自动生成）
SITE_URL=
```

### 字段说明

| 字段 | 必填 | 默认值 | 说明 |
|------|------|--------|------|
| `DOMAIN` | 否 | 空 | 域名，用于nginx配置和SSL证书申请 |
| `SITE_PATH` | 否 | `/root/yourdomain` | VPS上部署的绝对路径 |
| `HTTP_PORT` | 否 | `8080` | Nginx对外HTTP端口 |
| `HTTPS_PORT` | 否 | `8443` | Nginx对外HTTPS端口 |
| `JWT_SECRET` | **是** | 无 | JWT签名密钥，必须唯一且保密 |
| `SITE_URL` | 否 | 自动生成 | 站点完整URL，如 `https://www.yourdomain.com` |

## SSL 配置 (ENABLE_SSL)

当需要使用 HTTPS 时，在 `deploy.conf` 中设置：

```ini
# 是否申请 Let's Encrypt 证书
ENABLE_SSL=true

# 证书续期 cron 表达式（可选）
SSL_RENEWAL_SCHEDULE=0 3 * * *
```

### 字段说明

| 字段 | 必填 | 默认值 | 说明 |
|------|------|--------|------|
| `ENABLE_SSL` | 否 | `false` | 是否申请 Let's Encrypt 证书 |
| `SSL_RENEWAL_SCHEDULE` | 否 | `0 3 * * *` | 证书续期检查时间（每天凌晨3点） |

### SSL 自动配置流程

当 `ENABLE_SSL=true` 时，部署流程会自动执行：

1. **创建 Let's Encrypt 目录**
   ```bash
   mkdir -p /var/www/certbot
   ```

2. **申请 SSL 证书**（webroot 方式）
   ```bash
   certbot certonly --webroot -w /var/www/certbot -d www.yourdomain.com -d yourdomain.com
   ```

3. **生成独立 Nginx 配置**
   - 创建 `/etc/nginx/conf.d/yourdomain.conf`
   - 只包含本项目的 server 块，不影响其他网站
   - 自动取消 HTTPS server 块的注释

4. **配置自动续期**
   - 添加 crontab 任务
   - 续期成功后自动重启 nginx

### 增量修改原则

- **不修改主 nginx 配置** - 只在 `conf.d/` 下创建独立文件
- **不影响其他网站** - 每个项目有独立的配置文件
- **可单独管理** - 删除配置文件即可移除本项目的 nginx 配置

### 手动申请 SSL（如果不想自动配置）

如果用户暂时没有域名，可以先跳过 SSL 配置，后续手动申请：

```bash
# 1. 安装 certbot
apt install certbot python3-certbot-nginx

# 2. 申请证书（需要域名已解析到 VPS）
certbot --nginx -d www.yourdomain.com -d yourdomain.com

# 3. 自动续期测试
certbot renew --dry-run
```

## host.conf

```ini
# VPS主机IP或域名
VPS_HOST=your-vps-ip

# SSH用户
VPS_USER=root

# SSH端口
VPS_PORT=22

# SSH私钥路径（Windows用反斜杠或正斜杠均可）
SSH_KEY=C:/Users/hxpin/.ssh/bd-1-k-VXkFo9Mc.txt
```

### 字段说明

| 字段 | 必填 | 默认值 | 说明 |
|------|------|--------|------|
| `VPS_HOST` | **是** | 无 | VPS IP地址或域名 |
| `VPS_USER` | 否 | `root` | SSH登录用户 |
| `VPS_PORT` | 否 | `22` | SSH端口 |
| `SSH_KEY` | **是** | 无 | SSH私钥文件绝对路径 |

## 初始化配置

```bash
# 从示例复制
cp deploy.conf.sample deploy.conf
cp host.conf.sample host.conf

# 编辑配置（Windows用记事本即可）
notepad deploy.conf
notepad host.conf
```

## 上传配置（VPS upload-vps.sh）

脚本内支持以下变量（可通过环境变量覆盖）：

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `CHUNK_MB` | `50` | 分片大小（MB），网络差可减小为10 |
| `MAX_RETRIES` | `3` | 每片最大重试次数 |

分片上传机制（全链路断点续传）：
1. 文件按 `CHUNK_MB` 大小切分
2. 每个分片生成 SHA256 校验和
3. 逐个上传到 VPS 固定临时目录 `/root/yourdomain-upload`
4. 上传后立即验证完整性（比对 SHA256）
5. 上传 Manifest 到 VPS（记录分片清单）
6. 所有分片校验通过后，在 VPS 上合并
7. 合并后整体 SHA256 校验
8. 校验通过后清理远程分片 + Manifest

**断点续传机制（跨会话）：**
- VPS 临时目录名固定（`/root/yourdomain-upload`），不再使用 PID
- 每次运行先检查 VPS 上已有分片及其 SHA256
- 已上传校验通过的分片自动跳过
- Manifest 记录了分片总数和所有 SHA256
- 即使进程被强杀，下次运行也能基于 Manifest + 已有分片继续
- 设计覆盖所有中断场景：网络断开→重试、进程重启→续传、部分损坏→重新上传损坏分片
