#!/bin/bash
set -e

cd "$(dirname "$0")"
ROOT_DIR="$(pwd)"

cleanup() {
    echo ""
    echo "Shutting down..."
    kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null
    wait "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null
    exit 0
}
trap cleanup INT TERM

# Kill anything on port 8000/3000
lsof -ti:8000 | xargs kill -9 2>/dev/null || true
lsof -ti:3000 | xargs kill -9 2>/dev/null || true
sleep 1

# Start backend
echo "[backend] starting on http://127.0.0.1:8000 ..."
export VIDEO_LAB_CORS_ORIGINS="http://localhost:3000,http://127.0.0.1:3000"
export VIDEO_LAB_DATA_DIR="$ROOT_DIR/data"
cd apps/backend
source "$ROOT_DIR/.venv/bin/activate" && python3 app.py > /tmp/video-backend.log 2>&1 &
BACKEND_PID=$!
cd "$ROOT_DIR"

# Wait for backend to be ready
echo "[backend] waiting for health check..."
for i in $(seq 1 30); do
    if curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8000/api/health 2>/dev/null | grep -q "200"; then
        echo "[backend] ready (pid=$BACKEND_PID)"
        break
    fi
    if [ "$i" -eq 30 ]; then
        echo "[backend] FAILED to start — last log:"
        tail -20 /tmp/video-backend.log
        cleanup
        exit 1
    fi
    sleep 1
done

# Start frontend
echo "[frontend] starting on http://127.0.0.1:3000 ..."
cd apps/frontend
npm run dev > /tmp/video-frontend.log 2>&1 &
FRONTEND_PID=$!
cd "$ROOT_DIR"

# Wait for frontend to be ready
echo "[frontend] waiting for health check..."
for i in $(seq 1 60); do
    if curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3000 2>/dev/null | grep -q "200"; then
        echo "[frontend] ready (pid=$FRONTEND_PID)"
        break
    fi
    if [ "$i" -eq 60 ]; then
        echo "[frontend] FAILED to start — last log:"
        tail -20 /tmp/video-frontend.log
        cleanup
        exit 1
    fi
    sleep 1
done

echo ""
echo "  Backend:  http://127.0.0.1:8000"
echo "  Frontend: http://127.0.0.1:3000"
echo "  Logs:     /tmp/video-backend.log  /tmp/video-frontend.log"
echo ""
echo "Both servers ready. Press Ctrl+C to stop."

wait "$BACKEND_PID" "$FRONTEND_PID"
