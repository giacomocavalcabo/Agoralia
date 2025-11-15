#!/bin/bash

# Script per aggiornare un lead per disabilitare le quiet hours
# Usage: ./update_lead_quiet_hours.sh <phone_number> [base_url] [auth_token]

PHONE="${1:-+393408994869}"
BASE_URL="${2:-${AGORALIA_URL:-https://api.agoralia.app}}"
AUTH_TOKEN="${3:-${AUTH_TOKEN}}"

echo "=== 🔧 AGGIORNA LEAD: Disabilita Quiet Hours ==="
echo ""
echo "📞 Numero: $PHONE"
echo "🌐 Base URL: $BASE_URL"
echo ""

# Normalize phone number for search (remove spaces and special chars)
PHONE_NORMALIZED=$(echo "$PHONE" | tr -d ' ' | tr -d '-' | tr -d '(' | tr -d ')')

# Step 1: Cerca il lead per numero
echo "🔍 Step 1: Cerca lead per numero..."
SEARCH_RESPONSE=$(curl -s -X GET "${BASE_URL}/leads?q=${PHONE_NORMALIZED}" \
  -H "Authorization: Bearer ${AUTH_TOKEN}")

LEAD_ID=$(echo "$SEARCH_RESPONSE" | jq -r '.items[0].id // empty' 2>/dev/null || echo "")

if [ -z "$LEAD_ID" ]; then
    echo "❌ Lead non trovato per il numero $PHONE"
    echo ""
    echo "📋 Response:"
    echo "$SEARCH_RESPONSE" | jq '.' 2>/dev/null || echo "$SEARCH_RESPONSE"
    echo ""
    echo "💡 Puoi creare un nuovo lead con:"
    echo "curl -X POST ${BASE_URL}/leads \\"
    echo "  -H 'Authorization: Bearer ${AUTH_TOKEN}' \\"
    echo "  -H 'Content-Type: application/json' \\"
    echo "  -d '{\"name\": \"Test Personal\", \"phone\": \"${PHONE}\", \"nature\": \"personal\", \"quiet_hours_disabled\": true}'"
    exit 1
fi

echo "✅ Lead trovato: ID=$LEAD_ID"
echo ""

# Step 2: Aggiorna il lead per disabilitare quiet hours
echo "🔧 Step 2: Aggiorna lead per disabilitare quiet hours..."

UPDATE_RESPONSE=$(curl -s -w "\n%{http_code}" -X PATCH "${BASE_URL}/leads/${LEAD_ID}" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"quiet_hours_disabled\": true,
    \"nature\": \"personal\"
  }")

HTTP_CODE=$(echo "$UPDATE_RESPONSE" | tail -n1)
BODY=$(echo "$UPDATE_RESPONSE" | sed '$d')

echo "📥 Response (HTTP $HTTP_CODE):"
echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
echo ""

if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ Lead aggiornato con successo!"
    echo ""
    echo "📋 Dettagli:"
    echo "   • Lead ID: $LEAD_ID"
    echo "   • Phone: $PHONE"
    echo "   • quiet_hours_disabled: true"
    echo "   • nature: personal"
    echo ""
    echo "🎯 Ora puoi chiamare questo numero senza restrizioni di quiet hours!"
else
    echo "❌ Errore durante l'aggiornamento (HTTP $HTTP_CODE)"
    exit 1
fi

