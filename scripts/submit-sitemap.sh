#!/usr/bin/env bash
#
# 向搜索引擎提交 sitemap（手动运行用）。
#
# 说明：
# - 本脚本需在能够访问公网的环境运行（本地或部署服务器均可）。
# - SITE 域名固定为 https://www.token00.com，sitemap 地址为 https://www.token00.com/sitemap.xml。
# - 百度主动推送需要 token：请在百度搜索资源平台（ziyuan.baidu.com）获取，
#   并以环境变量 BAIDU_PUSH_TOKEN 传入，例如：
#       BAIDU_PUSH_TOKEN=xxxx ./scripts/submit-sitemap.sh
#
set -euo pipefail

SITE="https://www.token00.com"
SITEMAP_URL="${SITE}/sitemap.xml"

echo "==> 提交 sitemap: ${SITEMAP_URL}"

# Google ping
echo "--> Google"
curl "https://www.google.com/ping?sitemap=${SITEMAP_URL}" || echo "Google ping 失败（可忽略）"

# Bing ping
echo "--> Bing"
curl "https://www.bing.com/ping?sitemap=${SITEMAP_URL}" || echo "Bing ping 失败（可忽略）"

# 百度主动推送（需要 token）
if [ -z "${BAIDU_PUSH_TOKEN:-}" ]; then
  echo "--> 百度: 未设置 BAIDU_PUSH_TOKEN，跳过主动推送"
else
  echo "--> 百度主动推送"
  curl -H "Content-Type: text/plain" \
    -X POST \
    "http://data.zz.baidu.com/sitesubmit/index?site=${SITE}&token=${BAIDU_PUSH_TOKEN}" \
    --data-binary @<(curl -s "${SITEMAP_URL}" | grep -oE '<loc>[^<]+</loc>' | sed 's/<loc>//; s/<\/loc>//') \
    || echo "百度推送失败（可忽略）"
fi

echo "==> 完成"
