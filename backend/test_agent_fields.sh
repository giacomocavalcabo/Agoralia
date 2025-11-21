#!/bin/bash

# Test script to determine which fields can be passed during agent creation
# We'll test different payload combinations to see what RetellAI accepts

API_KEY="${RETELL_API_KEY:-key_d7c699587b8774f10a5c4ff0bc2b}"

echo "=== Testing RetellAI Agent Creation with Different Fields ==="
echo ""

# Step 1: Create an LLM first (required for response_engine)
echo "Step 1: Creating Retell LLM..."
LLM_RESPONSE=$(curl -s -X POST "https://api.retellai.com/create-retell-llm" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o-mini",
    "start_speaker": "agent",
    "begin_message": "Hello! How can I help you today?"
  }')

LLM_ID=$(echo "$LLM_RESPONSE" | grep -o '"llm_id":"[^"]*"' | cut -d'"' -f4 || echo "$LLM_RESPONSE" | grep -o '"retell_llm_id":"[^"]*"' | cut -d'"' -f4 || echo "$LLM_RESPONSE" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)

if [ -z "$LLM_ID" ]; then
    echo "ERROR: Failed to create LLM"
    exit 1
fi

echo "✅ LLM created: $LLM_ID"
echo ""

# Test 1: Minimal payload (only required fields)
echo "=== Test 1: Minimal payload (response_engine + voice_id) ==="
RESPONSE1=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST "https://api.retellai.com/create-agent" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"response_engine\": {
      \"type\": \"retell-llm\",
      \"llm_id\": \"$LLM_ID\"
    },
    \"voice_id\": \"11labs-Adrian\"
  }")

HTTP_STATUS1=$(echo "$RESPONSE1" | grep "HTTP_STATUS" | cut -d: -f2)
BODY1=$(echo "$RESPONSE1" | sed '/HTTP_STATUS/d')

if [ "$HTTP_STATUS1" = "201" ]; then
    AGENT_ID1=$(echo "$BODY1" | grep -o '"agent_id":"[^"]*"' | cut -d'"' -f4)
    echo "✅ SUCCESS: Agent created with minimal payload"
    echo "Agent ID: $AGENT_ID1"
    echo "Response: $BODY1" | head -c 500
    echo ""
    echo ""
else
    echo "❌ FAILED: HTTP $HTTP_STATUS1"
    echo "$BODY1"
    exit 1
fi

# Test 2: Minimal + agent_name + language
echo "=== Test 2: Minimal + agent_name + language ==="
RESPONSE2=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST "https://api.retellai.com/create-agent" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"response_engine\": {
      \"type\": \"retell-llm\",
      \"llm_id\": \"$LLM_ID\"
    },
    \"voice_id\": \"11labs-Adrian\",
    \"agent_name\": \"Test Agent 2\",
    \"language\": \"en-US\"
  }")

HTTP_STATUS2=$(echo "$RESPONSE2" | grep "HTTP_STATUS" | cut -d: -f2)
BODY2=$(echo "$RESPONSE2" | sed '/HTTP_STATUS/d')

if [ "$HTTP_STATUS2" = "201" ]; then
    AGENT_ID2=$(echo "$BODY2" | grep -o '"agent_id":"[^"]*"' | cut -d'"' -f4)
    echo "✅ SUCCESS: Agent created with agent_name + language"
    echo "Agent ID: $AGENT_ID2"
    echo ""
else
    echo "❌ FAILED: HTTP $HTTP_STATUS2"
    echo "$BODY2"
fi

# Test 3: Minimal + voice settings
echo "=== Test 3: Minimal + voice settings (voice_temperature, voice_speed, volume) ==="
RESPONSE3=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST "https://api.retellai.com/create-agent" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"response_engine\": {
      \"type\": \"retell-llm\",
      \"llm_id\": \"$LLM_ID\"
    },
    \"voice_id\": \"11labs-Adrian\",
    \"agent_name\": \"Test Agent 3\",
    \"voice_temperature\": 1.0,
    \"voice_speed\": 1.0,
    \"volume\": 1.0
  }")

HTTP_STATUS3=$(echo "$RESPONSE3" | grep "HTTP_STATUS" | cut -d: -f2)
BODY3=$(echo "$RESPONSE3" | sed '/HTTP_STATUS/d')

if [ "$HTTP_STATUS3" = "201" ]; then
    AGENT_ID3=$(echo "$BODY3" | grep -o '"agent_id":"[^"]*"' | cut -d'"' -f4)
    echo "✅ SUCCESS: Agent created with voice settings"
    echo "Agent ID: $AGENT_ID3"
    echo ""
else
    echo "❌ FAILED: HTTP $HTTP_STATUS3"
    echo "$BODY3"
fi

# Test 4: Minimal + behavior settings
echo "=== Test 4: Minimal + behavior settings (responsiveness, interruption_sensitivity) ==="
RESPONSE4=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST "https://api.retellai.com/create-agent" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"response_engine\": {
      \"type\": \"retell-llm\",
      \"llm_id\": \"$LLM_ID\"
    },
    \"voice_id\": \"11labs-Adrian\",
    \"agent_name\": \"Test Agent 4\",
    \"responsiveness\": 1.0,
    \"interruption_sensitivity\": 1.0
  }")

HTTP_STATUS4=$(echo "$RESPONSE4" | grep "HTTP_STATUS" | cut -d: -f2)
BODY4=$(echo "$RESPONSE4" | sed '/HTTP_STATUS/d')

if [ "$HTTP_STATUS4" = "201" ]; then
    AGENT_ID4=$(echo "$BODY4" | grep -o '"agent_id":"[^"]*"' | cut -d'"' -f4)
    echo "✅ SUCCESS: Agent created with behavior settings"
    echo "Agent ID: $AGENT_ID4"
    echo ""
else
    echo "❌ FAILED: HTTP $HTTP_STATUS4"
    echo "$BODY4"
fi

# Test 5: Minimal + call settings
echo "=== Test 5: Minimal + call settings (end_call_after_silence_ms, max_call_duration_ms) ==="
RESPONSE5=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST "https://api.retellai.com/create-agent" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"response_engine\": {
      \"type\": \"retell-llm\",
      \"llm_id\": \"$LLM_ID\"
    },
    \"voice_id\": \"11labs-Adrian\",
    \"agent_name\": \"Test Agent 5\",
    \"end_call_after_silence_ms\": 600000,
    \"max_call_duration_ms\": 3600000
  }")

HTTP_STATUS5=$(echo "$RESPONSE5" | grep "HTTP_STATUS" | cut -d: -f2)
BODY5=$(echo "$RESPONSE5" | sed '/HTTP_STATUS/d')

if [ "$HTTP_STATUS5" = "201" ]; then
    AGENT_ID5=$(echo "$BODY5" | grep -o '"agent_id":"[^"]*"' | cut -d'"' -f4)
    echo "✅ SUCCESS: Agent created with call settings"
    echo "Agent ID: $AGENT_ID5"
    echo ""
else
    echo "❌ FAILED: HTTP $HTTP_STATUS5"
    echo "$BODY5"
fi

# Test 6: Minimal + webhook
echo "=== Test 6: Minimal + webhook settings ==="
RESPONSE6=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST "https://api.retellai.com/create-agent" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"response_engine\": {
      \"type\": \"retell-llm\",
      \"llm_id\": \"$LLM_ID\"
    },
    \"voice_id\": \"11labs-Adrian\",
    \"agent_name\": \"Test Agent 6\",
    \"webhook_url\": \"https://example.com/webhook\",
    \"webhook_timeout_ms\": 10000
  }")

HTTP_STATUS6=$(echo "$RESPONSE6" | grep "HTTP_STATUS" | cut -d: -f2)
BODY6=$(echo "$RESPONSE6" | sed '/HTTP_STATUS/d')

if [ "$HTTP_STATUS6" = "201" ]; then
    AGENT_ID6=$(echo "$BODY6" | grep -o '"agent_id":"[^"]*"' | cut -d'"' -f4)
    echo "✅ SUCCESS: Agent created with webhook settings"
    echo "Agent ID: $AGENT_ID6"
    echo ""
else
    echo "❌ FAILED: HTTP $HTTP_STATUS6"
    echo "$BODY6"
fi

# Test 7: Full payload (all fields we're currently sending)
echo "=== Test 7: Full payload (all fields) ==="
RESPONSE7=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST "https://api.retellai.com/create-agent" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"response_engine\": {
      \"type\": \"retell-llm\",
      \"llm_id\": \"$LLM_ID\"
    },
    \"voice_id\": \"11labs-Adrian\",
    \"agent_name\": \"Test Agent 7\",
    \"voice_temperature\": 1.0,
    \"voice_speed\": 1.0,
    \"volume\": 1.0,
    \"responsiveness\": 1.0,
    \"interruption_sensitivity\": 1.0,
    \"enable_backchannel\": true,
    \"backchannel_frequency\": 0.9,
    \"ambient_sound\": \"coffee-shop\",
    \"ambient_sound_volume\": 1.0,
    \"language\": \"en-US\",
    \"webhook_timeout_ms\": 10000,
    \"stt_mode\": \"fast\",
    \"vocab_specialization\": \"general\",
    \"denoising_mode\": \"noise-cancellation\",
    \"data_storage_setting\": \"everything\",
    \"opt_in_signed_url\": false,
    \"normalize_for_speech\": true,
    \"end_call_after_silence_ms\": 600000,
    \"max_call_duration_ms\": 3600000,
    \"begin_message_delay_ms\": 1000,
    \"ring_duration_ms\": 30000,
    \"post_call_analysis_model\": \"gpt-4o-mini\",
    \"allow_user_dtmf\": true
  }")

HTTP_STATUS7=$(echo "$RESPONSE7" | grep "HTTP_STATUS" | cut -d: -f2)
BODY7=$(echo "$RESPONSE7" | sed '/HTTP_STATUS/d')

if [ "$HTTP_STATUS7" = "201" ]; then
    AGENT_ID7=$(echo "$BODY7" | grep -o '"agent_id":"[^"]*"' | cut -d'"' -f4)
    echo "✅ SUCCESS: Agent created with full payload"
    echo "Agent ID: $AGENT_ID7"
    echo ""
else
    echo "❌ FAILED: HTTP $HTTP_STATUS7"
    echo "$BODY7"
fi

echo ""
echo "=== Summary ==="
echo "Tests completed. Check results above to see which fields can be passed during creation."
echo ""
echo "Agent IDs created (for cleanup):"
[ ! -z "$AGENT_ID1" ] && echo "  - $AGENT_ID1"
[ ! -z "$AGENT_ID2" ] && echo "  - $AGENT_ID2"
[ ! -z "$AGENT_ID3" ] && echo "  - $AGENT_ID3"
[ ! -z "$AGENT_ID4" ] && echo "  - $AGENT_ID4"
[ ! -z "$AGENT_ID5" ] && echo "  - $AGENT_ID5"
[ ! -z "$AGENT_ID6" ] && echo "  - $AGENT_ID6"
[ ! -z "$AGENT_ID7" ] && echo "  - $AGENT_ID7"

