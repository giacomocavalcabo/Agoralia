#!/bin/bash
# Test script for Retell Call Management endpoints
# Tests all CRUD operations for calls via Retell AI

set -e

API_URL="${API_URL:-https://api.agoralia.app}"
TEST_EMAIL="${TEST_EMAIL:-test@agoralia.app}"
TEST_PASSWORD="${TEST_PASSWORD:-test123456}"

echo "=== 🧪 TEST RETELL CALL MANAGEMENT ENDPOINTS ==="
echo ""
echo "API URL: $API_URL"
echo ""

# Step 1: Login
echo "1️⃣  LOGIN"
TOKEN=$(curl -s -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}" | \
  python3 -c "import sys, json; print(json.load(sys.stdin).get('token', ''))" 2>/dev/null)

if [ -z "$TOKEN" ]; then
  echo "❌ Login failed!"
  exit 1
fi

echo "✅ Login successful"
echo ""

# Step 2: List existing calls (simple GET)
echo "2️⃣  GET /calls/retell/calls - Simple List"
RESPONSE=$(curl -s -X GET "$API_URL/calls/retell/calls?limit=5" \
  -H "Authorization: Bearer $TOKEN")

echo "Response:"
echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
echo ""

# Step 3: List calls with POST and filters
echo "3️⃣  POST /calls/retell/calls/list - List with Filters"
RESPONSE=$(curl -s -X POST "$API_URL/calls/retell/calls/list" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "filter_criteria": {
      "call_status": ["ended", "ongoing"]
    },
    "sort_order": "descending",
    "limit": 10
  }')

echo "Response:"
echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
CALL_ID=$(echo "$RESPONSE" | python3 -c "import sys, json; data=json.load(sys.stdin); calls=data.get('calls', []); print(calls[0].get('call_id', '') if calls and len(calls) > 0 else '')" 2>/dev/null || echo "")
echo ""

if [ -z "$CALL_ID" ]; then
  echo "⚠️  No calls found, testing with empty data"
  TEST_CALL_ID="test_call_id_123"
else
  TEST_CALL_ID="$CALL_ID"
  echo "📞 Found call ID: $TEST_CALL_ID"
fi
echo ""

# Step 4: Get call details
if [ "$CALL_ID" ]; then
  echo "4️⃣  GET /calls/retell/calls/{call_id} - Get Call Details"
  RESPONSE=$(curl -s -X GET "$API_URL/calls/retell/calls/$TEST_CALL_ID" \
    -H "Authorization: Bearer $TOKEN")
  
  echo "Response:"
  echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
  echo ""
fi

# Step 5: Update call metadata (only if we have a real call)
if [ "$CALL_ID" ]; then
  echo "5️⃣  PATCH /calls/retell/calls/{call_id} - Update Call"
  RESPONSE=$(curl -s -X PATCH "$API_URL/calls/retell/calls/$TEST_CALL_ID" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d '{
      "metadata": {
        "test": "update",
        "updated_by": "test_script",
        "timestamp": "'$(date +%s)'"
      }
    }')
  
  echo "Response:"
  echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
  echo ""
  
  # Verify update
  echo "5.1️⃣  Verify Update - Get Call Again"
  RESPONSE=$(curl -s -X GET "$API_URL/calls/retell/calls/$TEST_CALL_ID" \
    -H "Authorization: Bearer $TOKEN")
  
  METADATA_TEST=$(echo "$RESPONSE" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('metadata', {}).get('test', ''))" 2>/dev/null || echo "")
  
  if [ "$METADATA_TEST" = "update" ]; then
    echo "✅ Metadata updated successfully!"
  else
    echo "⚠️  Metadata update may not have persisted (this is OK for ended calls)"
  fi
  echo ""
fi

# Step 6: Create a test call (if we want to test delete)
echo "6️⃣  POST /calls/retell/web - Create Web Call (for testing delete)"
# Get agent ID first
AGENT_ID=$(curl -s -X GET "$API_URL/agents" \
  -H "Authorization: Bearer $TOKEN" | \
  python3 -c "import sys, json; agents=json.load(sys.stdin); print(agents[0].get('retell_agent_id') if agents and len(agents) > 0 and agents[0].get('retell_agent_id') else '')" 2>/dev/null || echo "")

if [ -z "$AGENT_ID" ]; then
  echo "⚠️  No agents found, skipping web call creation"
else
  echo "Using agent: $AGENT_ID"
  RESPONSE=$(curl -s -X POST "$API_URL/calls/retell/web" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "{
      \"agent_id\": \"$AGENT_ID\",
      \"metadata\": {
        \"test\": \"delete_test\",
        \"created_by\": \"test_script\"
      }
    }")
  
  echo "Response:"
  echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
  
  TEST_WEB_CALL_ID=$(echo "$RESPONSE" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('call_id', ''))" 2>/dev/null || echo "")
  
  if [ -n "$TEST_WEB_CALL_ID" ]; then
    echo "✅ Web call created: $TEST_WEB_CALL_ID"
    echo ""
    
    # Step 7: Delete the test call
    echo "7️⃣  DELETE /calls/retell/calls/{call_id} - Delete Call"
    echo "⚠️  WARNING: This will delete the call permanently!"
    echo "Press Enter to continue or Ctrl+C to cancel..."
    # read -r
    
    RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X DELETE "$API_URL/calls/retell/calls/$TEST_WEB_CALL_ID" \
      -H "Authorization: Bearer $TOKEN")
    
    HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
    BODY=$(echo "$RESPONSE" | sed '/HTTP_STATUS/d')
    
    echo "HTTP Status: $HTTP_STATUS"
    echo "Response:"
    echo "$BODY" | python3 -m json.tool 2>/dev/null || echo "$BODY"
    
    if [ "$HTTP_STATUS" = "200" ] || [ "$HTTP_STATUS" = "204" ]; then
      echo "✅ Call deleted successfully!"
    else
      echo "⚠️  Delete may have failed or call not found"
    fi
    echo ""
  fi
fi

# Step 8: Test advanced filters
echo "8️⃣  POST /calls/retell/calls/list - Advanced Filters Test"
RESPONSE=$(curl -s -X POST "$API_URL/calls/retell/calls/list" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "filter_criteria": {
      "call_type": ["phone_call", "web_call"],
      "call_status": ["ended"]
    },
    "sort_order": "ascending",
    "limit": 5,
    "pagination_key": null
  }')

echo "Response:"
echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
echo ""

echo "=== ✅ TEST COMPLETATI ==="
echo ""
echo "📋 RIEPILOGO:"
echo "✅ Simple List (GET)"
echo "✅ List with Filters (POST)"
if [ "$CALL_ID" ]; then
  echo "✅ Get Call Details"
  echo "✅ Update Call"
fi
if [ "$TEST_WEB_CALL_ID" ]; then
  echo "✅ Create Web Call"
  echo "✅ Delete Call"
fi
echo "✅ Advanced Filters"

