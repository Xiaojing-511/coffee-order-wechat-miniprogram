#!/usr/bin/env bash
# 部署宣传售卖落地页到 CloudBase 静态托管（应用部署 tcb app deploy）
# 用法：先 cloudbase login 登录（持有 cloud1-7gjfr85i3b664708 的账号），再运行本脚本
set -e
cd "$(dirname "$0")/.."

ENV_ID="cloud1-7gjfr85i3b664708"
SERVICE_NAME="crazy-coffee-landing"

echo "==> 校验登录状态"
cloudbase env list >/dev/null 2>&1 || { echo "请先执行: cloudbase login"; exit 1; }

echo "==> 部署静态站点 ($SERVICE_NAME -> $ENV_ID)"
tcb app deploy "$SERVICE_NAME" \
  --framework static \
  --build-command "" \
  --output-dir ./landing \
  -e "$ENV_ID" \
  -f

echo ""
echo "==> 部署完成，线上地址："
echo "    https://$SERVICE_NAME-$ENV_ID.webapps.tcloudbase.com/"
