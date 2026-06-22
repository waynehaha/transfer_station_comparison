#!/bin/zsh
set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
PORT=4173
URL="http://127.0.0.1:${PORT}/index.html"
API_URL="http://127.0.0.1:${PORT}/api/providers"
LOG_FILE="${PROJECT_DIR}/.price-compare-server.log"

cd "$PROJECT_DIR"

is_port_open() {
  nc -z 127.0.0.1 "$PORT" >/dev/null 2>&1
}

is_api_ready() {
  curl -fsS "$API_URL" >/dev/null 2>&1
}

stop_wrong_server_if_needed() {
  if is_port_open && ! is_api_ready; then
    echo "检测到旧版静态服务占用了端口，正在切换为可保存数据的新服务..."
    PIDS=$(lsof -ti tcp:"$PORT" 2>/dev/null || true)
    if [ -n "$PIDS" ]; then
      echo "$PIDS" | xargs kill 2>/dev/null || true
      sleep 0.5
    fi
  fi
}

echo "正在启动：中转站输出价格对比"
echo "项目目录：$PROJECT_DIR"
echo "访问地址：$URL"
echo "数据文件：$PROJECT_DIR/data/providers.json"
echo ""

stop_wrong_server_if_needed

if is_api_ready; then
  echo "保存服务已经在运行，直接打开页面。"
  open "$URL"
  sleep 3
  exit 0
fi

echo "正在启动本地保存服务..."
python3 "$PROJECT_DIR/server.py" > "$LOG_FILE" 2>&1 &
SERVER_PID=$!
echo "$SERVER_PID" > "$PROJECT_DIR/.price-compare-server.pid"

for i in {1..30}; do
  if is_api_ready; then
    echo "服务启动成功。"
    break
  fi
  sleep 0.2
done

if ! is_api_ready; then
  echo "服务启动失败，请查看日志：$LOG_FILE"
  read -k 1 "?按任意键关闭窗口..."
  exit 1
fi

open "$URL"
echo ""
echo "页面已打开。"
echo "数据会保存到项目文件：data/providers.json"
echo "换浏览器、换窗口再打开，只要项目文件还在，数据就还在。"
echo ""
echo "使用页面期间请保留这个窗口；关闭窗口会停止本地保存服务。"
echo "如果想停止服务，直接关闭这个窗口即可。"
wait "$SERVER_PID"
