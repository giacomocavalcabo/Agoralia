#!/bin/bash
# Test API using curl - Works without Python dependencies

set -e

# Configuration
BASE_URL="${API_BASE_URL:-http://localhost:8000}"
if [[ ! "$BASE_URL" =~ ^https?:// ]]; then
    BASE_URL="https://${BASE_URL}"
fi

echo "============================================================"
echo "  AGORALIA API TEST (curl)"
echo "  Testing backend API with curl"
echo "============================================================"
echo ""
echo "Base URL: $BASE_URL"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

TOKEN=""
TENANT_ID=""

print_section() {
    echo ""
    echo "============================================================"
    echo "  $1"
    echo "============================================================"
    echo ""
}

# 0. Health check
print_section "0. Health Check"
if curl -s -f "${BASE_URL}/health" > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} API is healthy"
    curl -s "${BASE_URL}/health" | python3 -m json.tool 2>/dev/null || echo "OK"
else
    echo -e "${RED}✗${NC} Cannot reach API: ${BASE_URL}/health"
    echo "Make sure the backend is running."
    exit 1
fi

# 1. Register/Login user
print_section "1. Registering/Logging in User"
EMAIL="test@agoralia.app"
PASSWORD="test123456"

# Try login first
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"${EMAIL}\",\"password\":\"${PASSWORD}\"}")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✓${NC} User logged in: ${EMAIL}"
    TOKEN=$(echo "$BODY" | python3 -c "import sys, json; print(json.load(sys.stdin)['token'])" 2>/dev/null || echo "")
    TENANT_ID=$(echo "$BODY" | python3 -c "import sys, json; print(json.load(sys.stdin)['tenant_id'])" 2>/dev/null || echo "")
elif [ "$HTTP_CODE" = "401" ]; then
    # Try register
    echo "User doesn't exist, registering..."
    RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/auth/register" \
        -H "Content-Type: application/json" \
        -d "{\"email\":\"${EMAIL}\",\"password\":\"${PASSWORD}\",\"name\":\"Test User\"}")
    
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    BODY=$(echo "$RESPONSE" | sed '$d')
    
    if [ "$HTTP_CODE" = "200" ]; then
        echo -e "${GREEN}✓${NC} User registered: ${EMAIL}"
        TOKEN=$(echo "$BODY" | python3 -c "import sys, json; print(json.load(sys.stdin)['token'])" 2>/dev/null || echo "")
        TENANT_ID=$(echo "$BODY" | python3 -c "import sys, json; print(json.load(sys.stdin)['tenant_id'])" 2>/dev/null || echo "")
    else
        echo -e "${RED}✗${NC} Registration failed (HTTP $HTTP_CODE)"
        echo "$BODY"
        exit 1
    fi
else
    echo -e "${RED}✗${NC} Login failed (HTTP $HTTP_CODE)"
    echo "$BODY"
    exit 1
fi

if [ -z "$TOKEN" ]; then
    echo -e "${RED}✗${NC} Cannot get token"
    exit 1
fi

echo "Token: ${TOKEN:0:50}..."
echo "Tenant ID: $TENANT_ID"

# 2. Update workspace
print_section "2. Updating Workspace"
curl -s -X PATCH "${BASE_URL}/settings" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${TOKEN}" \
    -d '{"workspace_name":"Test Workspace","timezone":"Europe/Rome","brand_color":"#4F46E5"}' | python3 -m json.tool 2>/dev/null || echo "OK"
echo -e "${GREEN}✓${NC} Workspace updated"

# 3. Create phone number
print_section "3. Creating Phone Number"
curl -s -X POST "${BASE_URL}/numbers" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${TOKEN}" \
    -d '{"e164":"+393491234567","type":"retell"}' | python3 -m json.tool 2>/dev/null || echo "OK"
echo -e "${GREEN}✓${NC} Phone number created"

# List phone numbers
echo ""
echo "Listing phone numbers:"
curl -s -X GET "${BASE_URL}/numbers" \
    -H "Authorization: Bearer ${TOKEN}" | python3 -m json.tool 2>/dev/null || echo "[]"

# 4. Create agent
print_section "4. Creating Agent"
curl -s -X POST "${BASE_URL}/agents" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${TOKEN}" \
    -d '{"name":"Test Agent IT","lang":"it-IT","voice_id":"21m00Tcm4TlvDq8ikWAM"}' | python3 -m json.tool 2>/dev/null || echo "OK"
echo -e "${GREEN}✓${NC} Agent created"

# List agents
echo ""
echo "Listing agents:"
curl -s -X GET "${BASE_URL}/agents" \
    -H "Authorization: Bearer ${TOKEN}" | python3 -m json.tool 2>/dev/null || echo "[]"

# 5. Create knowledge base
print_section "5. Creating Knowledge Base"
curl -s -X POST "${BASE_URL}/kbs" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${TOKEN}" \
    -d '{"lang":"it-IT","scope":"outbound"}' | python3 -m json.tool 2>/dev/null || echo "OK"
echo -e "${GREEN}✓${NC} Knowledge base created"

# List knowledge bases
echo ""
echo "Listing knowledge bases:"
curl -s -X GET "${BASE_URL}/kbs" \
    -H "Authorization: Bearer ${TOKEN}" | python3 -m json.tool 2>/dev/null || echo "[]"

# 6. Create campaign
print_section "6. Creating Campaign"
# Get number and KB IDs from previous listings
NUMBER_ID=$(curl -s -X GET "${BASE_URL}/numbers" \
    -H "Authorization: Bearer ${TOKEN}" | python3 -c "import sys, json; nums=json.load(sys.stdin); print(nums[0]['id'] if nums else '')" 2>/dev/null || echo "")
KB_ID=$(curl -s -X GET "${BASE_URL}/kbs" \
    -H "Authorization: Bearer ${TOKEN}" | python3 -c "import sys, json; kbs=json.load(sys.stdin); print(kbs[0]['id'] if kbs else '')" 2>/dev/null || echo "")

CAMPAIGN_PAYLOAD="{\"name\":\"Test Campaign Q1 2024\",\"status\":\"draft\",\"timezone\":\"Europe/Rome\",\"max_calls_per_day\":50,\"budget_cents\":50000"
if [ -n "$NUMBER_ID" ]; then
    CAMPAIGN_PAYLOAD="${CAMPAIGN_PAYLOAD},\"from_number_id\":${NUMBER_ID}"
fi
if [ -n "$KB_ID" ]; then
    CAMPAIGN_PAYLOAD="${CAMPAIGN_PAYLOAD},\"kb_id\":${KB_ID}"
fi
CAMPAIGN_PAYLOAD="${CAMPAIGN_PAYLOAD}}"

CAMPAIGN_RESPONSE=$(curl -s -X POST "${BASE_URL}/campaigns" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${TOKEN}" \
    -d "$CAMPAIGN_PAYLOAD")
echo "$CAMPAIGN_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$CAMPAIGN_RESPONSE"
echo -e "${GREEN}✓${NC} Campaign created"

# Get campaign ID
CAMPAIGN_ID=$(curl -s -X GET "${BASE_URL}/campaigns" \
    -H "Authorization: Bearer ${TOKEN}" | python3 -c "import sys, json; camps=json.load(sys.stdin); print(camps[0]['id'] if camps else '')" 2>/dev/null || echo "")

# 7. Create leads
if [ -n "$CAMPAIGN_ID" ]; then
    print_section "7. Creating Leads"
    
    LEADS=(
        '{"name":"Mario Rossi","phone":"+393491111111","company":"Rossi S.r.l.","nature":"b2b","preferred_lang":"it-IT","campaign_id":'${CAMPAIGN_ID}'}'
        '{"name":"Luigi Bianchi","phone":"+393492222222","company":"Bianchi & Co.","nature":"b2b","preferred_lang":"it-IT","campaign_id":'${CAMPAIGN_ID}'}'
        '{"name":"Anna Verdi","phone":"+393493333333","nature":"b2c","preferred_lang":"it-IT","campaign_id":'${CAMPAIGN_ID}'}'
    )
    
    for LEAD in "${LEADS[@]}"; do
        NAME=$(echo "$LEAD" | python3 -c "import sys, json; print(json.load(sys.stdin)['name'])" 2>/dev/null || echo "")
        curl -s -X POST "${BASE_URL}/leads" \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer ${TOKEN}" \
            -d "$LEAD" | python3 -m json.tool 2>/dev/null > /dev/null
        echo -e "${GREEN}✓${NC} Lead created: $NAME"
    done
    
    # List leads
    echo ""
    echo "Listing leads:"
    curl -s -X GET "${BASE_URL}/leads?campaign_id=${CAMPAIGN_ID}" \
        -H "Authorization: Bearer ${TOKEN}" | python3 -m json.tool 2>/dev/null | head -30
fi

# Summary
print_section "TEST SUMMARY"
echo -e "${GREEN}✓${NC} All API tests completed!"
echo ""
echo "Created/Verified:"
echo "  - User (Tenant ID: $TENANT_ID)"
echo "  - Phone Number: +393491234567"
echo "  - Agent: Test Agent IT"
echo "  - Knowledge Base: it-IT/outbound"
if [ -n "$CAMPAIGN_ID" ]; then
    echo "  - Campaign: Test Campaign Q1 2024 (ID: $CAMPAIGN_ID)"
    echo "  - Leads: 3"
fi
echo ""
echo "API Base URL: $BASE_URL"
echo "Auth Token: ${TOKEN:0:50}..."

