#!/bin/bash
set -e

cd "$(dirname "$0")"

# Kill existing processes on ports
cleanup() {
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
echo "Starting backend on http://127.0.0.1:8000"
export VIDEO_LAB_CORS_ORIGINS="http://localhost:3000,http://127.0.0.1:3000"
python3 app.py &
BACKEND_PID=$!

# Start frontend
echo "Starting frontend on http://127.0.0.1:3000"
cd frontend
npm run dev &
FRONTEND_PID=$!
cd ..

echo ""
echo "  Backend:  http://127.0.0.1:8000"
echo "  Frontend: http://127.0.0.1:3000"
echo ""
echo "Press Ctrl+C to stop"

wait "$BACKEND_PID" "$FRONTEND_PID"
