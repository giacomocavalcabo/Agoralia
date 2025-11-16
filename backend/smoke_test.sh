#!/bin/bash
# Simple smoke test using curl - tests live endpoints
set -e

BASE_URL="${1:-http://127.0.0.1:8000}"
FAILED=0

test_endpoint() {
    local name="$1"
    local method="$2"
    local path="$3"
    local expected_status="${4:-200}"
    local data="${5:-}"
    
    echo -n "Testing $name... "
    
    if [ "$method" = "GET" ]; then
        STATUS=$(curl -s -o /tmp/response.json -w "%{http_code}" "$BASE_URL$path" 2>&1)
    else
        STATUS=$(curl -s -o /tmp/response.json -w "%{http_code}" -X "$method" \
            -H "Content-Type: application/json" \
            -d "$data" \
            "$BASE_URL$path" 2>&1)
    fi
    
    if [ "$STATUS" = "$expected_status" ]; then
        # Check if response is valid JSON
        if python3 -c "import json; json.load(open('/tmp/response.json'))" 2>/dev/null; then
            echo "✅ ($STATUS)"
        else
            echo "✅ ($STATUS, non-JSON)"
        fi
    else
        echo "❌ Expected $expected_status, got $STATUS"
        cat /tmp/response.json | head -100
        FAILED=$((FAILED + 1))
    fi
}

echo "🧪 Running smoke tests against $BASE_URL"
echo ""

test_endpoint "GET /health" "GET" "/health"
test_endpoint "GET /billing/entitlements" "GET" "/billing/entitlements"
test_endpoint "GET /auth/me (no token)" "GET" "/auth/me" "401"
test_endpoint "GET /metrics/daily" "GET" "/metrics/daily?days=7"
test_endpoint "GET /metrics/outcomes" "GET" "/metrics/outcomes?days=7"
test_endpoint "POST /auth/register (empty)" "POST" "/auth/register" "422" "{}"

echo ""
if [ $FAILED -eq 0 ]; then
    echo "✅ All smoke tests passed!"
    exit 0
else
    echo "❌ $FAILED test(s) failed"
    exit 1
fi

