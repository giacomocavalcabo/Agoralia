#!/bin/bash
# Script per aggiungere sezioni KB via API

BASE_URL="${AGORALIA_URL:-https://api.agoralia.app}"
KB_ID="${1:-4}"

# Try to get AUTH_TOKEN from environment or login
if [ -z "$AUTH_TOKEN" ]; then
    echo "🔍 Getting AUTH_TOKEN via login..."
    LOGIN_RESPONSE=$(curl -s -X POST "${BASE_URL}/auth/login" \
        -H "Content-Type: application/json" \
        -d "{\"email\":\"${TEST_EMAIL:-test@example.com}\",\"password\":\"${TEST_PASSWORD:-test123456}\"}")
    AUTH_TOKEN=$(echo "$LOGIN_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('token', ''))" 2>/dev/null || echo "")
    if [ -z "$AUTH_TOKEN" ]; then
        echo "❌ Login failed. Response: $LOGIN_RESPONSE"
        exit 1
    fi
    echo "✅ Login successful"
fi

echo "📝 Aggiungendo sezioni di test a KB ${KB_ID}..."
echo ""

# Sezioni di test
sections=(
    "knowledge|La nostra azienda si chiama Agoralia e offre soluzioni di AI vocale per business. Siamo specializzati in chiamate automatiche intelligenti che utilizzano tecnologia avanzata per qualificare lead e gestire conversazioni professionali."
    "knowledge|Il nostro prodotto principale permette di automatizzare le chiamate di vendita, qualificazione lead e supporto clienti. Utilizziamo intelligenza artificiale per rendere le conversazioni naturali e efficaci."
    "rules|Durante la conversazione, ricordati sempre di: 1) Essere cortese e professionale, 2) Ascoltare attentamente le risposte del cliente, 3) Qualificare il lead secondo i criteri BANT (Budget, Authority, Need, Timeline), 4) Non essere insistente o aggressivo, 5) Rispettare le pause e i silenzi dell'interlocutore."
    "style|Lo stile di comunicazione deve essere: professionale ma amichevole, chiaro e diretto, empatico e attento alle esigenze del cliente. Usa un tono di voce naturale e conversazionale, evitando suoni robotici o troppo meccanici."
)

for section in "${sections[@]}"; do
    IFS='|' read -r kind content <<< "$section"
    echo "  ➕ Aggiungendo sezione: $kind..."
    
    # URL encode content
    content_encoded=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$content'))" 2>/dev/null || echo "$content")
    
    RESPONSE=$(curl -s -X POST "${BASE_URL}/kbs/${KB_ID}/sections?kind=${kind}&content_text=${content_encoded}" \
        -H "Authorization: Bearer ${AUTH_TOKEN}")
    
    SUCCESS=$(echo "$RESPONSE" | python3 -c "import sys, json; print('true' if json.load(sys.stdin).get('ok') else 'false')" 2>/dev/null || echo "false")
    
    if [ "$SUCCESS" = "true" ]; then
        SECTION_ID=$(echo "$RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('section_id', ''))" 2>/dev/null || echo "")
        echo "    ✅ Sezione aggiunta (ID: $SECTION_ID)"
    else
        echo "    ⚠️  Errore: $RESPONSE"
    fi
done

echo ""
echo "✅ Completato! Sezioni aggiunte a KB ${KB_ID}"
echo ""
echo "🧪 Ora testa la sync:"
echo "   curl -X POST \"${BASE_URL}/kbs/${KB_ID}/sync\" -H \"Authorization: Bearer ${AUTH_TOKEN}\""

