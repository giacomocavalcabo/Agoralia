#!/bin/bash

# Test script to verify RetellAI create-agent endpoint with curl
# This will help us understand if the endpoint works directly

# Get API key from environment or use the one from logs
API_KEY="${RETELL_API_KEY:-key_d7c699587b8774f10a5c4ff0bc2b}"

echo "Testing RetellAI create-agent endpoint..."
echo "API Key: ${API_KEY:0:20}..."
echo ""

# First, create an LLM (we need llm_id for response_engine)
echo "Step 1: Creating Retell LLM..."
LLM_RESPONSE=$(curl -s -X POST "https://api.retellai.com/create-retell-llm" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o-mini",
    "start_speaker": "agent",
    "begin_message": "Hello! How can I help you today?"
  }')

echo "LLM Response: $LLM_RESPONSE"
echo ""

# Extract llm_id from response
LLM_ID=$(echo "$LLM_RESPONSE" | grep -o '"llm_id":"[^"]*"' | cut -d'"' -f4 || echo "$LLM_RESPONSE" | grep -o '"retell_llm_id":"[^"]*"' | cut -d'"' -f4 || echo "$LLM_RESPONSE" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)

if [ -z "$LLM_ID" ]; then
    echo "ERROR: Failed to extract llm_id from LLM creation response"
    echo "Full response: $LLM_RESPONSE"
    exit 1
fi

echo "Extracted LLM ID: $LLM_ID"
echo ""

# Now try to create agent with minimal payload
echo "Step 2: Creating Agent with minimal payload (only required fields)..."
AGENT_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST "https://api.retellai.com/create-agent" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"response_engine\": {
      \"type\": \"retell-llm\",
      \"llm_id\": \"$LLM_ID\"
    },
    \"voice_id\": \"11labs-Adrian\"
  }")

HTTP_STATUS=$(echo "$AGENT_RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
RESPONSE_BODY=$(echo "$AGENT_RESPONSE" | sed '/HTTP_STATUS/d')

echo "HTTP Status: $HTTP_STATUS"
echo "Response Body: $RESPONSE_BODY"
echo ""

if [ "$HTTP_STATUS" = "201" ] || [ "$HTTP_STATUS" = "200" ]; then
    echo "✅ SUCCESS: Agent created successfully!"
    AGENT_ID=$(echo "$RESPONSE_BODY" | grep -o '"agent_id":"[^"]*"' | cut -d'"' -f4)
    echo "Agent ID: $AGENT_ID"
else
    echo "❌ FAILED: Agent creation returned $HTTP_STATUS"
    echo ""
    echo "Trying alternative endpoint /v2/create-agent..."
    AGENT_RESPONSE_V2=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST "https://api.retellai.com/v2/create-agent" \
      -H "Authorization: Bearer $API_KEY" \
      -H "Content-Type: application/json" \
      -d "{
        \"response_engine\": {
          \"type\": \"retell-llm\",
          \"llm_id\": \"$LLM_ID\"
        },
        \"voice_id\": \"11labs-Adrian\"
      }")
    
    HTTP_STATUS_V2=$(echo "$AGENT_RESPONSE_V2" | grep "HTTP_STATUS" | cut -d: -f2)
    RESPONSE_BODY_V2=$(echo "$AGENT_RESPONSE_V2" | sed '/HTTP_STATUS/d')
    
    echo "HTTP Status: $HTTP_STATUS_V2"
    echo "Response Body: $RESPONSE_BODY_V2"
fi

