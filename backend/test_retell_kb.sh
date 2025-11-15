#!/bin/bash

# Test script for Retell Knowledge Base endpoints
# Tests CRUD operations for Retell KB

BASE_URL="${AGORALIA_URL:-https://api.agoralia.app}"
AUTH_TOKEN="${AUTH_TOKEN:-test-token}"  # Default test token

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "=== 🧪 TEST RETELL KNOWLEDGE BASE ENDPOINTS ==="
echo ""
echo "📋 Test Plan:"
echo "1. Create Knowledge Base"
echo "2. Get Knowledge Base"
echo "3. List Knowledge Bases"
echo "4. Add Sources to KB"
echo "5. Get Updated KB"
echo "6. Delete Source from KB"
echo "7. Delete Knowledge Base"
echo ""

# Test 1: Create Knowledge Base
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🧪 TEST 1: Create Knowledge Base"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

CREATE_BODY=$(cat <<EOF
{
  "knowledge_base_name": "Test KB $(date +%s)",
  "knowledge_base_texts": [
    {
      "text": "Agoralia is a voice AI platform for sales calls.",
      "title": "Platform Overview"
    },
    {
      "text": "Use BANT framework for lead qualification: Budget, Authority, Need, Timeline.",
      "title": "BANT Qualification"
    }
  ],
  "knowledge_base_urls": [
    "https://www.retellai.com"
  ],
  "enable_auto_refresh": false
}
EOF
)

echo "📤 Request:"
echo "$CREATE_BODY" | jq '.' 2>/dev/null || echo "$CREATE_BODY"
echo ""

RESPONSE1=$(curl -s -X POST "${BASE_URL}/calls/retell/knowledge-bases" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -d "$CREATE_BODY")

echo "📥 Response:"
echo "$RESPONSE1" | jq '.' 2>/dev/null || echo "$RESPONSE1"
echo ""

if echo "$RESPONSE1" | grep -q "knowledge_base_id"; then
    echo -e "${GREEN}✅ TEST 1 PASSED: Knowledge Base created successfully${NC}"
    KB_ID=$(echo "$RESPONSE1" | jq -r '.knowledge_base_id // .response.knowledge_base_id // empty' 2>/dev/null || echo "")
    if [ -z "$KB_ID" ]; then
        # Try to extract from response object
        KB_ID=$(echo "$RESPONSE1" | jq -r '.response.knowledge_base_id // empty' 2>/dev/null || echo "")
    fi
    echo "📌 KB ID: ${KB_ID:-not found in response}"
else
    echo -e "${RED}❌ TEST 1 FAILED: Knowledge Base creation failed${NC}"
    KB_ID=""
fi

echo ""
echo ""

# If KB creation failed, skip remaining tests
if [ -z "$KB_ID" ]; then
    echo -e "${YELLOW}⚠️  Skipping remaining tests (KB creation failed)${NC}"
    exit 1
fi

# Test 2: Get Knowledge Base
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🧪 TEST 2: Get Knowledge Base"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

RESPONSE2=$(curl -s -X GET "${BASE_URL}/calls/retell/knowledge-bases/${KB_ID}" \
  -H "Authorization: Bearer ${AUTH_TOKEN}")

echo "📥 Response:"
echo "$RESPONSE2" | jq '.' 2>/dev/null || echo "$RESPONSE2"
echo ""

if echo "$RESPONSE2" | grep -q "knowledge_base_id"; then
    echo -e "${GREEN}✅ TEST 2 PASSED: Knowledge Base retrieved successfully${NC}"
else
    echo -e "${RED}❌ TEST 2 FAILED: Knowledge Base retrieval failed${NC}"
fi

echo ""
echo ""

# Test 3: List Knowledge Bases
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🧪 TEST 3: List Knowledge Bases"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

RESPONSE3=$(curl -s -X GET "${BASE_URL}/calls/retell/knowledge-bases" \
  -H "Authorization: Bearer ${AUTH_TOKEN}")

echo "📥 Response:"
echo "$RESPONSE3" | jq '.' 2>/dev/null || echo "$RESPONSE3"
echo ""

if echo "$RESPONSE3" | grep -q "knowledge_base_id\|\["; then
    echo -e "${GREEN}✅ TEST 3 PASSED: Knowledge Bases listed successfully${NC}"
    KB_COUNT=$(echo "$RESPONSE3" | jq 'if type == "array" then length else (.[] | length) end' 2>/dev/null || echo "unknown")
    echo "📌 Found ${KB_COUNT} knowledge base(s)"
else
    echo -e "${RED}❌ TEST 3 FAILED: Knowledge Bases listing failed${NC}"
fi

echo ""
echo ""

# Test 4: Add Sources to KB
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🧪 TEST 4: Add Sources to Knowledge Base"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

ADD_SOURCES_BODY=$(cat <<EOF
{
  "knowledge_base_texts": [
    {
      "text": "Always be professional and courteous during calls.",
      "title": "Call Etiquette"
    }
  ],
  "knowledge_base_urls": [
    "https://docs.retellai.com"
  ]
}
EOF
)

echo "📤 Request:"
echo "$ADD_SOURCES_BODY" | jq '.' 2>/dev/null || echo "$ADD_SOURCES_BODY"
echo ""

RESPONSE4=$(curl -s -X POST "${BASE_URL}/calls/retell/knowledge-bases/${KB_ID}/sources" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -d "$ADD_SOURCES_BODY")

echo "📥 Response:"
echo "$RESPONSE4" | jq '.' 2>/dev/null || echo "$RESPONSE4"
echo ""

if echo "$RESPONSE4" | grep -q "knowledge_base_id\|success"; then
    echo -e "${GREEN}✅ TEST 4 PASSED: Sources added successfully${NC}"
else
    echo -e "${RED}❌ TEST 4 FAILED: Adding sources failed${NC}"
fi

echo ""
echo ""

# Test 5: Get Updated KB (check sources)
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🧪 TEST 5: Get Updated Knowledge Base (verify sources)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

RESPONSE5=$(curl -s -X GET "${BASE_URL}/calls/retell/knowledge-bases/${KB_ID}" \
  -H "Authorization: Bearer ${AUTH_TOKEN}")

echo "📥 Response:"
echo "$RESPONSE5" | jq '.' 2>/dev/null || echo "$RESPONSE5"
echo ""

SOURCE_COUNT=$(echo "$RESPONSE5" | jq '[.response.knowledge_base_sources[]?] | length' 2>/dev/null || echo "0")
echo "📌 Knowledge Base has ${SOURCE_COUNT} source(s)"

if echo "$RESPONSE5" | grep -q "knowledge_base_id"; then
    echo -e "${GREEN}✅ TEST 5 PASSED: Updated Knowledge Base retrieved successfully${NC}"
else
    echo -e "${RED}❌ TEST 5 FAILED: Updated Knowledge Base retrieval failed${NC}"
fi

echo ""
echo ""

# Test 6: Delete Source (only if we have sources)
if [ "$SOURCE_COUNT" -gt "0" ]; then
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "🧪 TEST 6: Delete Source from Knowledge Base"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    
    # Try to get first source_id
    SOURCE_ID=$(echo "$RESPONSE5" | jq -r '.response.knowledge_base_sources[0].source_id // empty' 2>/dev/null || echo "")
    
    if [ -n "$SOURCE_ID" ]; then
        echo "📤 Deleting source: ${SOURCE_ID}"
        echo ""
        
        RESPONSE6=$(curl -s -X DELETE "${BASE_URL}/calls/retell/knowledge-bases/${KB_ID}/sources/${SOURCE_ID}" \
          -H "Authorization: Bearer ${AUTH_TOKEN}")
        
        echo "📥 Response:"
        echo "$RESPONSE6" | jq '.' 2>/dev/null || echo "$RESPONSE6"
        echo ""
        
        if echo "$RESPONSE6" | grep -q "success\|knowledge_base_id"; then
            echo -e "${GREEN}✅ TEST 6 PASSED: Source deleted successfully${NC}"
        else
            echo -e "${RED}❌ TEST 6 FAILED: Deleting source failed${NC}"
        fi
    else
        echo -e "${YELLOW}⚠️  TEST 6 SKIPPED: No source_id found in KB${NC}"
    fi
    
    echo ""
    echo ""
else
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "🧪 TEST 6: Delete Source from Knowledge Base"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo -e "${YELLOW}⚠️  TEST 6 SKIPPED: No sources available to delete${NC}"
    echo ""
    echo ""
fi

# Test 7: Delete Knowledge Base
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🧪 TEST 7: Delete Knowledge Base"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "📤 Deleting KB: ${KB_ID}"
echo ""

RESPONSE7=$(curl -s -X DELETE "${BASE_URL}/calls/retell/knowledge-bases/${KB_ID}" \
  -H "Authorization: Bearer ${AUTH_TOKEN}")

echo "📥 Response:"
echo "$RESPONSE7" | jq '.' 2>/dev/null || echo "$RESPONSE7"
echo ""

if echo "$RESPONSE7" | grep -q "success\|message"; then
    echo -e "${GREEN}✅ TEST 7 PASSED: Knowledge Base deleted successfully${NC}"
else
    echo -e "${RED}❌ TEST 7 FAILED: Deleting Knowledge Base failed${NC}"
fi

echo ""
echo ""

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ TEST SUMMARY"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 Tests completed. Check results above."
echo ""

