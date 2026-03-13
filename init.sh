#!/bin/bash
# init.sh — Bootstrap the tts-audio-mcp development environment
set -e

DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

echo "=== tts-audio-mcp — Environment Bootstrap ==="
echo ""

PASS=0
FAIL=0
WARN=0

check() {
  local label="$1"
  local result="$2"
  if [ "$result" = "pass" ]; then
    echo "  ✓ $label"
    PASS=$((PASS + 1))
  elif [ "$result" = "warn" ]; then
    echo "  ⚠ $label"
    WARN=$((WARN + 1))
  else
    echo "  ✗ $label"
    FAIL=$((FAIL + 1))
  fi
}

# ── 1. Check whisper.cpp ──────────────────────
echo "Checking whisper.cpp..."
if command -v whisper-cli &>/dev/null; then
  check "whisper-cli found at $(which whisper-cli)" "pass"
elif [ -f "$DIR/bin/whisper-cli" ]; then
  check "whisper-cli found at $DIR/bin/whisper-cli" "pass"
else
  check "whisper-cli not found — run: brew install whisper-cpp" "fail"
fi

# Check for whisper model
WHISPER_MODEL="${WHISPER_MODEL_PATH:-}"
if [ -z "$WHISPER_MODEL" ]; then
  # Check common locations
  for candidate in \
    "$HOME/.local/share/whisper-cpp/ggml-large-v3-turbo.bin" \
    "$HOME/.cache/whisper/ggml-large-v3-turbo.bin" \
    "/usr/local/share/whisper-cpp/models/ggml-large-v3-turbo.bin" \
    "$DIR/models/ggml-large-v3-turbo.bin"; do
    if [ -f "$candidate" ]; then
      WHISPER_MODEL="$candidate"
      break
    fi
  done
fi

if [ -n "$WHISPER_MODEL" ] && [ -f "$WHISPER_MODEL" ]; then
  SIZE=$(du -h "$WHISPER_MODEL" | cut -f1)
  check "Whisper model found: $WHISPER_MODEL ($SIZE)" "pass"
else
  check "Whisper large-v3-turbo model not found — download needed" "warn"
fi

# ── 2. Check Python + NISQA ───────────────────
echo ""
echo "Checking NISQA..."
if python3 -c "import nisqa" 2>/dev/null; then
  check "NISQA Python library installed" "pass"
else
  check "NISQA not installed — run: pip install nisqa" "fail"
fi

# ── 3. Check Node.js dependencies ─────────────
echo ""
echo "Checking Node.js project..."
if [ -f "$DIR/package.json" ]; then
  check "package.json exists" "pass"
else
  check "package.json missing — project not scaffolded yet" "fail"
fi

if [ -d "$DIR/node_modules" ]; then
  check "node_modules exists" "pass"
else
  if [ -f "$DIR/package.json" ]; then
    echo "  → Installing dependencies..."
    npm install --silent
    check "npm install completed" "pass"
  else
    check "node_modules missing (no package.json)" "fail"
  fi
fi

# Check if it builds
if [ -f "$DIR/tsconfig.json" ]; then
  if npm run build --silent 2>/dev/null; then
    check "TypeScript builds successfully" "pass"
  else
    check "TypeScript build failed" "fail"
  fi
fi

# ── 4. Check Ollama (for context — not required) ──
echo ""
echo "Checking Ollama (optional, for LLM integration)..."
if curl -s http://localhost:11434/api/version &>/dev/null; then
  VERSION=$(curl -s http://localhost:11434/api/version | python3 -c "import sys,json; print(json.load(sys.stdin).get('version','?'))" 2>/dev/null || echo "?")
  check "Ollama running (v$VERSION)" "pass"
else
  check "Ollama not running (optional — MCP server works standalone)" "warn"
fi

# ── Summary ───────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Results: $PASS passed, $FAIL failed, $WARN warnings"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ "$FAIL" -gt 0 ]; then
  echo ""
  echo "Fix the failures above before starting development."
  exit 1
fi

echo ""
echo "Ready for development."
