#!/bin/bash
# Token00 VPS 部署脚本
set -e

echo "=== Token00 VPS 部署 ==="

CONFIG_FILE="/root/token00/deploy.conf"

# 默认值
DOMAIN=""
SITE_PATH="/root/token00"
JWT_SECRET=""
SITE_URL=""
HTTP_PORT=""
HTTPS_PORT=""

# 读取配置
if [ -f "$CONFIG_FILE" ]; then
    echo ">>> 读取配置..."
    while IFS='=' read -r key value; do
        case "$key" in
            DOMAIN) DOMAIN="$value" ;;
            SITE_PATH) SITE_PATH="$value" ;;
            JWT_SECRET) JWT_SECRET="$value" ;;
            SITE_URL) SITE_URL="$value" ;;
            HTTP_PORT) HTTP_PORT="$value" ;;
            HTTPS_PORT) HTTPS_PORT="$value" ;;
        esac
    done < "$CONFIG_FILE"
else
    echo "错误: 找不到配置文件 $CONFIG_FILE"
    exit 1
fi

# 验证必要配置
if [ -z "$JWT_SECRET" ]; then
    echo "错误: JWT_SECRET 未配置"
    exit 1
fi

# 设置默认值
: ${HTTP_PORT:=8080}
: ${HTTPS_PORT:=8443}

# 生成 SITE_URL
if [ -z "$SITE_URL" ]; then
    if [ -n "$DOMAIN" ]; then
        SITE_URL="http://$DOMAIN"
    else
        SITE_URL="http://localhost:$HTTP_PORT"
    fi
fi

echo "HTTP Port: $HTTP_PORT"
echo "HTTPS Port: $HTTPS_PORT"
echo "部署路径: $SITE_PATH"
echo "站点地址: $SITE_URL"
if [ -n "$DOMAIN" ]; then
    echo "域名: $DOMAIN"
fi

# 检查镜像 (支持 .tar, .tar.gz, .zip)
BACKEND_IMG=""
FRONTEND_IMG=""
for ext in .tar .tar.gz .zip; do
    if [ -f "/root/token00-backend$ext" ]; then
        BACKEND_IMG="/root/token00-backend$ext"
        break
    fi
done
for ext in .tar .tar.gz .zip; do
    if [ -f "/root/token00-frontend$ext" ]; then
        FRONTEND_IMG="/root/token00-frontend$ext"
        break
    fi
done

if [ -z "$BACKEND_IMG" ]; then
    echo "错误: 找不到后端镜像文件"
    exit 1
fi
if [ -z "$FRONTEND_IMG" ]; then
    echo "错误: 找不到前端镜像文件"
    exit 1
fi

# 导入镜像
echo ">>> [1/3] 导入镜像..."

# 检查当前运行的容器和镜像
echo ">>> 检查当前环境..."
CURRENT_BACKEND=$(docker ps -a --filter "name=token00-backend" --format "{{.Image}}" 2>/dev/null | head -1)
CURRENT_FRONTEND=$(docker ps -a --filter "name=token00-frontend" --format "{{.Image}}" 2>/dev/null | head -1)

if [ -n "$CURRENT_BACKEND" ]; then
    echo "  当前运行的后端镜像: $CURRENT_BACKEND"
fi
if [ -n "$CURRENT_FRONTEND" ]; then
    echo "  当前运行的前端镜像: $CURRENT_FRONTEND"
fi

# 清理旧容器（防止冲突）
echo ">>> 清理旧容器..."
docker ps -a --filter "name=token00-" -q | xargs -r docker rm -f 2>/dev/null || true
docker network prune -f 2>/dev/null || true

load_image() {
    local img=$1
    local img_name=$(basename "$img" .tar)
    img_name=${img_name%.tar.gz}
    img_name=${img_name%.zip}

    # 检查镜像是否已存在
    if docker images -q "$img_name:latest" &>/dev/null; then
        echo "  镜像 $img_name:latest 已存在，先移除..."
        docker rmi "$img_name:latest" 2>/dev/null || true
    fi

    if [[ "$img" == *.tar ]]; then
        docker load -i "$img"
    elif [[ "$img" == *.tar.gz ]]; then
        gunzip -c "$img" | docker load
    elif [[ "$img" == *.zip ]]; then
        if command -v unzip &> /dev/null; then
            unzip -p "$img" | docker load
        else
            echo "错误: 需要 unzip 来解压 .zip 文件"
            echo "安装: apt install unzip -y"
            exit 1
        fi
    fi
}
load_image "$BACKEND_IMG"
load_image "$FRONTEND_IMG"

# 创建目录
mkdir -p $SITE_PATH/certbot/conf
mkdir -p $SITE_PATH/certbot/www

# 复制文件
echo ">>> [2/3] 准备配置..."
cp -n $BACKEND_IMG $SITE_PATH/ 2>/dev/null || true
cp -n $FRONTEND_IMG $SITE_PATH/ 2>/dev/null || true

# 确保数据卷存在且使用固定名称
echo ">>> 检查数据卷..."
docker volume create token00-data 2>/dev/null || true

# 检查是否有旧卷数据需要迁移
OLD_VOLUMES=$(docker volume ls -q | grep -E "token00_data|token00_token00-data" || true)
if [ -n "$OLD_VOLUMES" ]; then
    echo "  检测到旧卷: $OLD_VOLUMES"
    echo "  数据已保留在 token00-data 卷中"
fi

# 生成 .env 文件
cat > $SITE_PATH/.env << EOF
HTTP_PORT=$HTTP_PORT
HTTPS_PORT=$HTTPS_PORT
JWT_SECRET=$JWT_SECRET
SITE_URL=$SITE_URL
FRONTEND_URL=$SITE_URL
NEXT_PUBLIC_API_URL=/api/v1
NEXT_PUBLIC_SITE_URL=$SITE_URL
EOF

# 更新 nginx.conf 中的域名
if [ -n "$DOMAIN" ]; then
    sed -i "s/server_name www.token00.com token00.com localhost;/server_name $DOMAIN;/g" $SITE_PATH/nginx.conf
fi

# 启动服务
echo ">>> [3/3] 启动服务..."
cd $SITE_PATH

# 检测 docker compose
get_compose_cmd() {
    # 优先使用 docker compose (v2)
    if docker compose version &> /dev/null; then
        echo "docker compose"
        return 0
    fi

    # 检查 docker-compose (v1)
    if command -v docker-compose &> /dev/null; then
        # 测试是否正常工作
        if docker-compose version &> /dev/null 2>&1; then
            echo "docker-compose"
            return 0
        fi

        # v1 有兼容性问题，尝试修复
        echo "检测到 docker-compose 兼容性问题，正在修复..."
        pip3 install --upgrade docker docker-compose requests urllib3 2>/dev/null || true

        # 重新测试
        if docker-compose version &> /dev/null 2>&1; then
            echo "docker-compose"
            return 0
        fi
    fi

    # 尝试安装 docker compose v2
    echo "正在安装 Docker Compose v2..."
    mkdir -p ~/.docker/cli-plugins
    COMPOSE_VERSION=$(curl -s https://api.github.com/repos/docker/compose/releases/latest | grep 'tag_name' | cut -d\" -f4)
    curl -SL "https://github.com/docker/compose/releases/download/${COMPOSE_VERSION}/docker-compose-linux-x86_64" -o ~/.docker/cli-plugins/docker-compose
    chmod +x ~/.docker/cli-plugins/docker-compose

    if docker compose version &> /dev/null; then
        echo "docker compose"
        return 0
    fi

    echo "错误: Docker Compose 安装失败"
    return 1
}

COMPOSE=$(get_compose_cmd)
if [ -z "$COMPOSE" ]; then
    exit 1
fi

echo "使用: $COMPOSE"

# 确保数据卷存在
docker volume create token00-data 2>/dev/null || true

# 停止并移除旧容器（使用 --remove-orphans 清理孤立服务）
$COMPOSE down --remove-orphans 2>/dev/null || true
$COMPOSE up -d

# 等待服务
sleep 5

# 验证
echo ""
echo "=== 服务状态 ==="
$COMPOSE ps

echo ""
echo "=== 测试 API ==="
HEALTH=$(curl -s http://localhost:$HTTP_PORT/api/v1/health)
if echo "$HEALTH" | grep -q '"status":"ok"'; then
    echo "✓ API 正常"
else
    echo "✗ API 异常"
    docker logs token00-backend --tail 20
fi

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║              部署完成!                               ║"
echo "╠══════════════════════════════════════════════════════╣"
echo "║  HTTP:   http://<IP>:$HTTP_PORT"
echo "║  HTTPS:  https://<IP>:$HTTPS_PORT (需要 SSL 证书)"
if [ -n "$DOMAIN" ]; then
    echo "║  SSL:    certbot certonly --webroot -w /var/www/certbot -d $DOMAIN"
fi
echo "║  账号:   admin / admin123 (首次登录后请修改密码!)           ║"
echo "╚══════════════════════════════════════════════════════╝"
