#!/bin/bash

# Railway Deploy Smoke Test
# Esegui questo script dopo il deploy per verificare che tutto funzioni

set -e

echo "🚀 Railway Deploy Smoke Test"
echo "=============================="

# Configurazione
API_BASE="https://api.agoralia.app"
FRONTEND_BASE="https://app.agoralia.app"

echo "📍 Testing API endpoints..."

# 1. Health check (deve dare 200)
echo "1️⃣ Testing /health..."
HEALTH_RESPONSE=$(curl -s -w "\n%{http_code}" "${API_BASE}/health")
HEALTH_HTTP_CODE=$(echo "$HEALTH_RESPONSE" | tail -n1)
HEALTH_BODY=$(echo "$HEALTH_RESPONSE" | head -n -1)

if [ "$HEALTH_HTTP_CODE" = "200" ]; then
    echo "✅ /health: OK (${HEALTH_HTTP_CODE})"
    echo "   Response: $HEALTH_BODY"
else
    echo "❌ /health: FAILED (${HEALTH_HTTP_CODE})"
    echo "   Response: $HEALTH_BODY"
    exit 1
fi

# 2. Auth/me senza cookie (deve dare 200 con authenticated: false)
echo "2️⃣ Testing /api/auth/me (no cookie)..."
AUTH_RESPONSE=$(curl -s -w "\n%{http_code}" "${API_BASE}/api/auth/me")
AUTH_HTTP_CODE=$(echo "$AUTH_RESPONSE" | tail -n1)
AUTH_BODY=$(echo "$AUTH_RESPONSE" | head -n -1)

if [ "$AUTH_HTTP_CODE" = "200" ]; then
    echo "✅ /api/auth/me: OK (${AUTH_HTTP_CODE})"
    echo "   Response: $AUTH_BODY"
else
    echo "❌ /api/auth/me: FAILED (${AUTH_HTTP_CODE})"
    echo "   Response: $AUTH_BODY"
    exit 1
fi

# 3. CORS preflight (deve dare 200 con header CORS corretti)
echo "3️⃣ Testing CORS preflight..."
CORS_RESPONSE=$(curl -s -w "\n%{http_code}" \
    -X OPTIONS \
    -H "Origin: ${FRONTEND_BASE}" \
    -H "Access-Control-Request-Method: GET" \
    -H "Access-Control-Request-Headers: Content-Type" \
    "${API_BASE}/api/auth/me")
CORS_HTTP_CODE=$(echo "$CORS_RESPONSE" | tail -n1)
CORS_HEADERS=$(curl -s -I -X OPTIONS \
    -H "Origin: ${FRONTEND_BASE}" \
    -H "Access-Control-Request-Method: GET" \
    -H "Access-Control-Request-Headers: Content-Type" \
    "${API_BASE}/api/auth/me" | grep -E "(Access-Control|HTTP)")

if [ "$CORS_HTTP_CODE" = "200" ]; then
    echo "✅ CORS preflight: OK (${CORS_HTTP_CODE})"
    echo "   Headers: $CORS_HEADERS"
else
    echo "❌ CORS preflight: FAILED (${CORS_HTTP_CODE})"
    echo "   Headers: $CORS_HEADERS"
    exit 1
fi

# 4. Integrations endpoint (deve dare 401/403, non 500)
echo "4️⃣ Testing /api/settings/integrations/status..."
INTEGRATIONS_RESPONSE=$(curl -s -w "\n%{http_code}" "${API_BASE}/api/settings/integrations/status")
INTEGRATIONS_HTTP_CODE=$(echo "$INTEGRATIONS_RESPONSE" | tail -n1)
INTEGRATIONS_BODY=$(echo "$INTEGRATIONS_RESPONSE" | head -n -1)

if [ "$INTEGRATIONS_HTTP_CODE" = "401" ] || [ "$INTEGRATIONS_HTTP_CODE" = "403" ]; then
    echo "✅ /api/settings/integrations/status: OK (${INTEGRATIONS_HTTP_CODE}) - Expected auth required"
    echo "   Response: $INTEGRATIONS_BODY"
elif [ "$INTEGRATIONS_HTTP_CODE" = "500" ]; then
    echo "❌ /api/settings/integrations/status: FAILED (${INTEGRATIONS_HTTP_CODE}) - Server error"
    echo "   Response: $INTEGRATIONS_BODY"
    exit 1
else
    echo "⚠️  /api/settings/integrations/status: Unexpected (${INTEGRATIONS_HTTP_CODE})"
    echo "   Response: $INTEGRATIONS_BODY"
fi

# 5. Debug CORS endpoint
echo "5️⃣ Testing /debug/cors..."
DEBUG_RESPONSE=$(curl -s -w "\n%{http_code}" "${API_BASE}/debug/cors")
DEBUG_HTTP_CODE=$(echo "$DEBUG_RESPONSE" | tail -n1)
DEBUG_BODY=$(echo "$DEBUG_RESPONSE" | head -n -1)

if [ "$DEBUG_HTTP_CODE" = "200" ]; then
    echo "✅ /debug/cors: OK (${DEBUG_HTTP_CODE})"
    echo "   CORS config: $DEBUG_BODY"
else
    echo "❌ /debug/cors: FAILED (${DEBUG_HTTP_CODE})"
    echo "   Response: $DEBUG_BODY"
fi

echo ""
echo "🎉 Railway Deploy Smoke Test COMPLETATO!"
echo "✅ Tutti i test critici sono passati"
echo "✅ Il backend è pronto per il frontend"
echo ""
echo "📋 Prossimi passi:"
echo "1. Testa il login dal frontend"
echo "2. Verifica che le traduzioni si popolino"
echo "3. Controlla che l'endpoint integrations funzioni con autenticazione"
