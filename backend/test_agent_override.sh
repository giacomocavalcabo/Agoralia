#!/bin/bash

# Test script for Agent Override and Dynamic Variables
# Tests both Agoralia API and direct Retell AI calls

BASE_URL="${AGORALIA_URL:-https://api.agoralia.app}"
RETELL_API_KEY="${RETELL_API_KEY}"
AUTH_TOKEN="${AUTH_TOKEN:-test-token}"  # Default test token

if [ -z "$RETELL_API_KEY" ]; then
    echo "⚠️  RETELL_API_KEY not set. Some tests will be skipped."
    echo "   Set RETELL_API_KEY to enable direct Retell AI tests."
    SKIP_RETELL_DIRECT=1
else
    SKIP_RETELL_DIRECT=0
fi

echo "=== 🧪 TEST AGENT OVERRIDE & DYNAMIC VARIABLES ==="
echo ""
echo "📋 Test Plan:"
echo "1. Test Agent Override (voice settings)"
echo "2. Test Dynamic Variables"
echo "3. Test Combined (Agent Override + Dynamic Variables)"
echo "4. Direct Retell AI test"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test 1: Agent Override - Voice settings
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🧪 TEST 1: Agent Override (Voice Settings)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

TEST1_BODY=$(cat <<EOF
{
  "to": "+393408994869",
  "agent_id": "agent_d96425328c574cd8ae683142fc",
  "agent_override": {
    "agent": {
      "voice_id": "11labs-Adrian",
      "voice_temperature": 0.6,
      "interruption_sensitivity": 0.8,
      "max_call_duration_ms": 1800000
    },
    "retell_llm": {
      "model": "gpt-4o-mini",
      "model_temperature": 0.2,
      "start_speaker": "agent",
      "begin_message": "Ciao, sono l'assistente virtuale personalizzato per questa chiamata."
    }
  },
  "metadata": {
    "test": "agent_override_voice",
    "legal_accepted": true
  }
}
EOF
)

echo "📤 Request:"
echo "$TEST1_BODY" | jq '.' 2>/dev/null || echo "$TEST1_BODY"
echo ""

RESPONSE1=$(curl -s -X POST "${BASE_URL}/calls/retell/outbound" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -d "$TEST1_BODY")

echo "📥 Response:"
echo "$RESPONSE1" | jq '.' 2>/dev/null || echo "$RESPONSE1"
echo ""

if echo "$RESPONSE1" | grep -q "call_id\|id"; then
    echo -e "${GREEN}✅ TEST 1 PASSED: Agent Override applied successfully${NC}"
    CALL1_ID=$(echo "$RESPONSE1" | jq -r '.call_id // .id // empty' 2>/dev/null || echo "")
else
    echo -e "${RED}❌ TEST 1 FAILED: Agent Override not applied${NC}"
fi

echo ""
echo ""

# Test 2: Dynamic Variables
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🧪 TEST 2: Dynamic Variables"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

TEST2_BODY=$(cat <<EOF
{
  "to": "+393408994869",
  "agent_id": "agent_d96425328c574cd8ae683142fc",
  "retell_llm_dynamic_variables": {
    "customer_name": "Mario Rossi",
    "product_name": "Prodotto Premium",
    "order_id": "ORD-12345",
    "appointment_date": "28 Marzo 2024"
  },
  "metadata": {
    "test": "dynamic_variables",
    "legal_accepted": true
  }
}
EOF
)

echo "📤 Request:"
echo "$TEST2_BODY" | jq '.' 2>/dev/null || echo "$TEST2_BODY"
echo ""

RESPONSE2=$(curl -s -X POST "${BASE_URL}/calls/retell/outbound" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -d "$TEST2_BODY")

echo "📥 Response:"
echo "$RESPONSE2" | jq '.' 2>/dev/null || echo "$RESPONSE2"
echo ""

if echo "$RESPONSE2" | grep -q "call_id\|id"; then
    echo -e "${GREEN}✅ TEST 2 PASSED: Dynamic Variables applied successfully${NC}"
    CALL2_ID=$(echo "$RESPONSE2" | jq -r '.call_id // .id // empty' 2>/dev/null || echo "")
else
    echo -e "${RED}❌ TEST 2 FAILED: Dynamic Variables not applied${NC}"
fi

echo ""
echo ""

# Test 3: Combined (Agent Override + Dynamic Variables)
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🧪 TEST 3: Combined (Agent Override + Dynamic Variables)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

TEST3_BODY=$(cat <<EOF
{
  "to": "+393408994869",
  "agent_id": "agent_d96425328c574cd8ae683142fc",
  "agent_override": {
    "retell_llm": {
      "model": "gpt-4o-mini",
      "model_temperature": 0.3,
      "begin_message": "Ciao {{customer_name}}, grazie per aver chiamato! Ho visto che sei interessato a {{product_name}}."
    }
  },
  "retell_llm_dynamic_variables": {
    "customer_name": "Luca Bianchi",
    "product_name": "Piano Pro"
  },
  "metadata": {
    "test": "combined_override_and_dynamic",
    "legal_accepted": true
  }
}
EOF
)

echo "📤 Request:"
echo "$TEST3_BODY" | jq '.' 2>/dev/null || echo "$TEST3_BODY"
echo ""

RESPONSE3=$(curl -s -X POST "${BASE_URL}/calls/retell/outbound" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -d "$TEST3_BODY")

echo "📥 Response:"
echo "$RESPONSE3" | jq '.' 2>/dev/null || echo "$RESPONSE3"
echo ""

if echo "$RESPONSE3" | grep -q "call_id\|id"; then
    echo -e "${GREEN}✅ TEST 3 PASSED: Combined Override + Dynamic Variables applied successfully${NC}"
    CALL3_ID=$(echo "$RESPONSE3" | jq -r '.call_id // .id // empty' 2>/dev/null || echo "")
else
    echo -e "${RED}❌ TEST 3 FAILED: Combined Override + Dynamic Variables not applied${NC}"
fi

echo ""
echo ""

# Test 4: Direct Retell AI Test
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🧪 TEST 4: Direct Retell AI Test"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ "$SKIP_RETELL_DIRECT" -eq 1 ]; then
    echo -e "${YELLOW}⚠️  RETELL_API_KEY not set. Skipping direct Retell AI test.${NC}"
    echo ""
elif [ -z "$DEFAULT_FROM_NUMBER" ]; then
    echo -e "${YELLOW}⚠️  DEFAULT_FROM_NUMBER not set. Skipping direct Retell AI test.${NC}"
    echo "   Set DEFAULT_FROM_NUMBER to enable direct Retell AI test."
else
    TEST4_BODY=$(cat <<EOF
{
  "from_number": "${DEFAULT_FROM_NUMBER}",
  "to_number": "+12025551235",
  "override_agent_id": "agent_d96425328c574cd8ae683142fc",
  "agent_override": {
    "agent": {
      "voice_temperature": 0.7,
      "interruption_sensitivity": 0.5
    },
    "retell_llm": {
      "begin_message": "Hello {{customer_name}}, how can I help you today?"
    }
  },
  "retell_llm_dynamic_variables": {
    "customer_name": "John Doe"
  }
}
EOF
)

    echo "📤 Request to Retell AI:"
    echo "$TEST4_BODY" | jq '.' 2>/dev/null || echo "$TEST4_BODY"
    echo ""

    RESPONSE4=$(curl -s -X POST "https://api.retellai.com/v2/create-phone-call" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer ${RETELL_API_KEY}" \
      -d "$TEST4_BODY")

    echo "📥 Response from Retell AI:"
    echo "$RESPONSE4" | jq '.' 2>/dev/null || echo "$RESPONSE4"
    echo ""

    if echo "$RESPONSE4" | grep -q "call_id\|id"; then
        echo -e "${GREEN}✅ TEST 4 PASSED: Direct Retell AI call with Agent Override + Dynamic Variables successful${NC}"
    else
        echo -e "${RED}❌ TEST 4 FAILED: Direct Retell AI call failed${NC}"
    fi
fi

echo ""
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ TEST SUMMARY"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 Tests completed. Check results above."
echo ""

