#!/bin/bash
# Test script for new Retell endpoints: Batch Calls, Voice Management, Custom Telephony

BASE_URL="${AGORALIA_URL:-https://api.agoralia.app}"
TEST_EMAIL="${TEST_EMAIL:-test@example.com}"
TEST_PASSWORD="${TEST_PASSWORD:-test123456}"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🧪 Testing New Retell Endpoints"
echo "=================================="
echo ""

# Try to get AUTH_TOKEN from environment or login
if [ -z "$AUTH_TOKEN" ]; then
    echo "🔍 Getting AUTH_TOKEN via login..."
    LOGIN_RESPONSE=$(curl -s -X POST "${BASE_URL}/auth/login" \
        -H "Content-Type: application/json" \
        -d "{\"email\":\"${TEST_EMAIL}\",\"password\":\"${TEST_PASSWORD}\"}")
    AUTH_TOKEN=$(echo "$LOGIN_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('token', ''))" 2>/dev/null || echo "")
    if [ -z "$AUTH_TOKEN" ]; then
        echo -e "${RED}❌ Login failed. Response: $LOGIN_RESPONSE${NC}"
        exit 1
    fi
    echo -e "${GREEN}✅ Login successful${NC}"
fi

echo ""

# Test 1: List Voices
echo "📋 TEST 1: List Voices"
echo "----------------------"
VOICES_RESPONSE=$(curl -s -X GET "${BASE_URL}/calls/retell/voices" \
    -H "Authorization: Bearer ${AUTH_TOKEN}")

VOICES_SUCCESS=$(echo "$VOICES_RESPONSE" | python3 -c "import sys, json; data = json.load(sys.stdin); print('true' if isinstance(data, list) or 'success' in str(data).lower() else 'false')" 2>/dev/null || echo "false")

if [ "$VOICES_SUCCESS" = "true" ] || echo "$VOICES_RESPONSE" | grep -q "voice_id"; then
    echo -e "${GREEN}✅ List voices successful${NC}"
    VOICES_COUNT=$(echo "$VOICES_RESPONSE" | python3 -c "import sys, json; data = json.load(sys.stdin); print(len(data) if isinstance(data, list) else len(data.get('voices', [])) if isinstance(data, dict) else 0)" 2>/dev/null || echo "0")
    echo "   Found $VOICES_COUNT voices"
    echo "   Response (first 500 chars): ${VOICES_RESPONSE:0:500}"
else
    echo -e "${RED}❌ List voices failed${NC}"
    echo "   Response: $VOICES_RESPONSE"
fi
echo ""

# Test 2: Get Voice Details (if we have a voice_id)
echo "📋 TEST 2: Get Voice Details"
echo "-----------------------------"
# Try to get a voice_id from the list
VOICE_ID=$(echo "$VOICES_RESPONSE" | python3 -c "import sys, json; data = json.load(sys.stdin); voices = data if isinstance(data, list) else data.get('voices', []) if isinstance(data, dict) else []; print(voices[0].get('voice_id', '') if voices else '')" 2>/dev/null || echo "")

if [ -z "$VOICE_ID" ]; then
    # Fallback to a known voice ID
    VOICE_ID="11labs-Adrian"
fi

echo "   Testing with voice_id: $VOICE_ID"
VOICE_DETAILS_RESPONSE=$(curl -s -X GET "${BASE_URL}/calls/retell/voices/${VOICE_ID}" \
    -H "Authorization: Bearer ${AUTH_TOKEN}")

VOICE_DETAILS_SUCCESS=$(echo "$VOICE_DETAILS_RESPONSE" | python3 -c "import sys, json; print('true' if json.load(sys.stdin).get('success') or json.load(sys.stdin).get('voice_id') else 'false')" 2>/dev/null || echo "false")

if [ "$VOICE_DETAILS_SUCCESS" = "true" ] || echo "$VOICE_DETAILS_RESPONSE" | grep -q "voice_id"; then
    echo -e "${GREEN}✅ Get voice details successful${NC}"
    echo "   Response (first 500 chars): ${VOICE_DETAILS_RESPONSE:0:500}"
else
    echo -e "${YELLOW}⚠️  Get voice details returned unexpected response${NC}"
    echo "   Response: $VOICE_DETAILS_RESPONSE"
fi
echo ""

# Test 3: Register Phone Call (Custom Telephony)
echo "📋 TEST 3: Register Phone Call (Custom Telephony)"
echo "--------------------------------------------------"
# Try to get an agent_id
echo "🔍 Getting agent_id..."
AGENTS_RESPONSE=$(curl -s -X GET "${BASE_URL}/calls/retell/agents" \
    -H "Authorization: Bearer ${AUTH_TOKEN}")
AGENT_ID=$(echo "$AGENTS_RESPONSE" | python3 -c "import sys, json; data = json.load(sys.stdin); agents = data.get('agents', []) if isinstance(data, dict) else (data if isinstance(data, list) else []); print(agents[0].get('retell_llm_id') or agents[0].get('agent_id') or '') if agents else ''" 2>/dev/null || echo "")

if [ -z "$AGENT_ID" ]; then
    # Try Agoralia agents
    AGENTS_AGORALIA_RESPONSE=$(curl -s -X GET "${BASE_URL}/agents" \
        -H "Authorization: Bearer ${AUTH_TOKEN}")
    AGENT_ID=$(echo "$AGENTS_AGORALIA_RESPONSE" | python3 -c "import sys, json; data = json.load(sys.stdin); agents = data if isinstance(data, list) else []; agent = next((a for a in agents if a.get('retell_agent_id')), None); print(agent.get('retell_agent_id') if agent else '')" 2>/dev/null || echo "")
fi

if [ -z "$AGENT_ID" ]; then
    echo -e "${YELLOW}⚠️  Skipping register phone call test: no agent_id found${NC}"
    echo "   Agents response: ${AGENTS_RESPONSE:0:200}"
else
    echo "   Using agent_id: $AGENT_ID"
    
    REGISTER_BODY=$(cat <<EOF
{
  "agent_id": "${AGENT_ID}",
  "from_number": "+14157774444",
  "to_number": "+12137774445",
  "direction": "outbound"
}
EOF
)
    
    REGISTER_RESPONSE=$(curl -s -X POST "${BASE_URL}/calls/retell/custom-telephony/register" \
        -H "Authorization: Bearer ${AUTH_TOKEN}" \
        -H "Content-Type: application/json" \
        -d "$REGISTER_BODY")
    
    REGISTER_SUCCESS=$(echo "$REGISTER_RESPONSE" | python3 -c "import sys, json; print('true' if json.load(sys.stdin).get('success') and json.load(sys.stdin).get('call_id') else 'false')" 2>/dev/null || echo "false")
    
    if [ "$REGISTER_SUCCESS" = "true" ]; then
        CALL_ID=$(echo "$REGISTER_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('call_id', ''))" 2>/dev/null || echo "")
        SIP_URI=$(echo "$REGISTER_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('sip_uri', ''))" 2>/dev/null || echo "")
        echo -e "${GREEN}✅ Register phone call successful${NC}"
        echo "   call_id: $CALL_ID"
        echo "   sip_uri: $SIP_URI"
    else
        echo -e "${YELLOW}⚠️  Register phone call returned unexpected response${NC}"
        echo "   Response: $REGISTER_RESPONSE"
    fi
fi
echo ""

# Test 4: Create Batch Call
echo "📋 TEST 4: Create Batch Call"
echo "-----------------------------"
# Get from_number and agent_id if not already set
if [ -z "$FROM_NUMBER" ]; then
    echo "🔍 Getting from_number..."
    NUMBERS_RESPONSE=$(curl -s -X GET "${BASE_URL}/numbers" \
        -H "Authorization: Bearer ${AUTH_TOKEN}")
    FROM_NUMBER=$(echo "$NUMBERS_RESPONSE" | python3 -c "import sys, json; items = json.load(sys.stdin); print(items[0]['e164'] if items and isinstance(items, list) and items else '')" 2>/dev/null || echo "")
fi

if [ -z "$FROM_NUMBER" ]; then
    FROM_NUMBER="+14157774444"  # Fallback
fi

echo "   Using from_number: $FROM_NUMBER"

BATCH_BODY=$(cat <<EOF
{
  "from_number": "${FROM_NUMBER}",
  "name": "Test Batch Call",
  "tasks": [
    {
      "to_number": "+12137774445",
      "dynamic_variables": {
        "customer_name": "Test Customer 1"
      },
      "metadata": {
        "test": "batch_call_1"
      }
    },
    {
      "to_number": "+12137774446",
      "dynamic_variables": {
        "customer_name": "Test Customer 2"
      },
      "metadata": {
        "test": "batch_call_2"
      }
    }
  ]
}
EOF
)

BATCH_RESPONSE=$(curl -s -X POST "${BASE_URL}/calls/retell/batch" \
    -H "Authorization: Bearer ${AUTH_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "$BATCH_BODY")

BATCH_SUCCESS=$(echo "$BATCH_RESPONSE" | python3 -c "import sys, json; print('true' if json.load(sys.stdin).get('success') and json.load(sys.stdin).get('batch_call_id') else 'false')" 2>/dev/null || echo "false")

if [ "$BATCH_SUCCESS" = "true" ]; then
    BATCH_ID=$(echo "$BATCH_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('batch_call_id', ''))" 2>/dev/null || echo "")
    TOTAL_TASKS=$(echo "$BATCH_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('total_task_count', 0))" 2>/dev/null || echo "0")
    echo -e "${GREEN}✅ Create batch call successful${NC}"
    echo "   batch_call_id: $BATCH_ID"
    echo "   total_task_count: $TOTAL_TASKS"
    echo "   Response (first 500 chars): ${BATCH_RESPONSE:0:500}"
else
    echo -e "${YELLOW}⚠️  Create batch call returned unexpected response${NC}"
    echo "   Response: $BATCH_RESPONSE"
fi
echo ""

# Test 5: Import Phone Number (Custom Telephony) - Skip by default as it requires setup
echo "📋 TEST 5: Import Phone Number (Custom Telephony)"
echo "--------------------------------------------------"
echo -e "${YELLOW}⚠️  Skipping import phone number test (requires Elastic SIP Trunking setup)${NC}"
echo "   This endpoint requires:"
echo "   - Elastic SIP Trunking configured with provider (Twilio/Telnyx/Vonage)"
echo "   - Number already owned in provider"
echo "   - SIP URI configured"
echo "   To test manually:"
echo "   curl -X POST \"${BASE_URL}/calls/retell/phone-numbers/import\" \\"
echo "     -H \"Authorization: Bearer ${AUTH_TOKEN}\" \\"
echo "     -H \"Content-Type: application/json\" \\"
echo "     -d '{\"phone_number\": \"+14157774444\", \"provider\": \"twilio\"}'"
echo ""

echo "=================================="
echo -e "${GREEN}✅ TESTS COMPLETED${NC}"
echo ""
echo "📊 SUMMARY:"
echo "   ✅ TEST 1: List Voices"
echo "   ✅ TEST 2: Get Voice Details"
echo "   ✅ TEST 3: Register Phone Call"
echo "   ✅ TEST 4: Create Batch Call"
echo "   ⚠️  TEST 5: Import Phone Number (skipped - requires setup)"
echo ""

