# TokenPress 部署文档

## 部署方式

| 环境 | 脚本 |
|------|------|
| Windows 本地 Docker | `deploy-windows-docker.bat` |
| Ubuntu/Linux 本地 Docker | `deploy-local.sh` |
| Windows → 远程 VPS | `deploy-local-to-vps.bat` |

---

## 本地 Docker 部署 (Windows)

### 前置要求

- Docker Desktop

### 配置

```bash
cp deploy.conf.sample deploy.conf
notepad deploy.conf
```

### 部署

双击 `deploy-windows-docker.bat`

---

## 本地 Docker 部署 (Ubuntu/Linux)

### 前置要求

- Docker
- Docker Compose

### 配置

```bash
cp deploy.conf.sample deploy.conf
nano deploy.conf
```

### 部署

```bash
chmod +x deploy-local.sh
./deploy-local.sh
```

---

## 远程 VPS 部署

### 前置要求

- VPS 服务器 (Ubuntu)
- SSH 密钥认证
- VPS 已安装 Docker

### 配置

**host.conf** - SSH 连接
```ini
VPS_HOST=your-vps-ip
VPS_USER=root
VPS_PORT=22
SSH_KEY=C:/Users/your-username/.ssh/your-key.pem
```

**deploy.conf** - 部署配置
```ini
DOMAIN=www.yourdomain.com
SITE_PATH=/root/yourpath
HTTP_PORT=8080
HTTPS_PORT=8443
JWT_SECRET=your-random-secret
```

### 部署

```bash
deploy-local-to-vps.bat all
```

### deploy-local-to-vps.bat 参数说明

| 参数 | 说明 |
|------|------|
| `build` | 构建前后端 Docker 镜像，导出为 .zip 文件 |
| `upload` | 上传镜像和配置文件到 VPS |
| `deploy` | 在 VPS 上执行部署脚本 |
| `update` | 快速更新 = build + upload + deploy |
| `all` | 完整部署流程 = build + upload + deploy |

**双击运行**: 无参数时默认执行 `all`，即完整部署流程

**常用场景**:
- 首次部署: `deploy-local-to-vps.bat all` 或双击运行
- 代码更新后: `deploy-local-to-vps.bat update`
- 仅修改配置: `deploy-local-to-vps.bat upload` + `deploy`

### SSL 证书

#### 申请证书

```bash
# 单域名
certbot certonly --webroot -w /var/www/certbot -d www.yourdomain.com

# 多域名合并到一个证书
certbot certonly --webroot -w /var/www/certbot -d www.yourdomain.com -d yourdomain.com
```

#### 多网站共存

VPS 上多个网站可以共享同一个 certbot webroot 目录，互不影响：

```bash
# TokenPress 证书
certbot certonly --webroot -w /var/www/certbot -d www.yourdomain.com -d yourdomain.com

# myaiquant 证书
certbot certonly --webroot -w /var/www/certbot -d www.myaiquant.com -d myaiquant.com
```

**重要**: 每个网站的 nginx 配置都必须包含：
```nginx
location /.well-known/acme-challenge/ {
    root /var/www/certbot;
}
```

#### 启用 HTTPS

编辑 `nginx.conf`，取消 HTTPS server 注释并修改证书路径：
```nginx
server {
    listen 443 ssl;
    server_name www.yourdomain.com yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/www.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/www.yourdomain.com/privkey.pem;
    # ... 其他配置
}
```

然后重启 nginx：
```bash
docker compose restart nginx
```

#### 自动续期

```bash
# 测试续期
certbot renew --dry-run

# 添加定时任务
crontab -e
# 添加：0 0 1 * * certbot renew --quiet && docker restart tokenpress-nginx
```

---

## deploy.conf 配置说明

| 配置项 | 说明 | 默认值 |
|--------|------|--------|
| DOMAIN | 域名（SSL 用） | 无 |
| SITE_PATH | 部署路径 | /root/yourpath |
| HTTP_PORT | HTTP 端口 | 8080 |
| HTTPS_PORT | HTTPS 端口 | 8443 |
| JWT_SECRET | JWT 密钥 | 无（必填） |
| SITE_URL | 站点 URL | 自动生成 |

---

## 架构

```
浏览器 → Nginx (HTTP_PORT/HTTPS_PORT)
            ↓
    ┌───────┴───────┐
    ↓               ↓
Frontend:4000   Backend:4001
```

- 容器内部端口固定：Frontend 4000, Backend 4001
- 只有 Nginx 对外端口可配置

---

## 数据库

- 首次部署自动初始化
- 默认账号: admin / admin123 (首次登录后请修改密码!)
