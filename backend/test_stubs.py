"""
Test stubs and mock providers for Agoralia development/testing
"""
import json
from datetime import datetime, timezone
from typing import Dict, Any, List

class MockRetellProvider:
    """Mock Retell provider for testing phone number operations and calls"""
    
    def __init__(self):
        self.phone_numbers = {}
        self.calls = {}
        self.agents = {
            'agent_en_core': {'name': 'English Core Agent', 'language': 'en-US'},
            'agent_it_sales': {'name': 'Italian Sales Agent', 'language': 'it-IT'},
            'agent_fr_support': {'name': 'French Support Agent', 'language': 'fr-FR'}
        }
    
    def buy_phone_number(self, country_iso: str, capabilities: List[str]) -> Dict[str, Any]:
        """Mock phone number purchase"""
        import uuid
        number_id = str(uuid.uuid4())
        e164 = self._generate_mock_number(country_iso)
        
        number_data = {
            'id': number_id,
            'e164': e164,
            'country_iso': country_iso,
            'capabilities': capabilities,
            'provider': 'retell',
            'provider_ref': f'retell_{number_id}',
            'verified': True,
            'can_inbound': 'inbound' in capabilities,
            'created_at': datetime.now(timezone.utc).isoformat()
        }
        
        self.phone_numbers[number_id] = number_data
        return number_data
    
    def create_call(self, from_number: str, to_number: str, agent_id: str, **kwargs) -> Dict[str, Any]:
        """Mock call creation"""
        import uuid
        call_id = str(uuid.uuid4())
        
        call_data = {
            'id': call_id,
            'from_number': from_number,
            'to_number': to_number,
            'agent_id': agent_id,
            'status': 'created',
            'created_at': datetime.now(timezone.utc).isoformat(),
            'metadata': kwargs.get('metadata', {}),
            'webhook_url': kwargs.get('webhook_url')
        }
        
        self.calls[call_id] = call_data
        return call_data
    
    def get_call_transcript(self, call_id: str) -> str:
        """Mock transcript retrieval"""
        return f"Mock transcript for call {call_id}. This is a simulated conversation between agent and customer about product inquiry."
    
    def route_inbound_call(self, phone_id: str, agent_id: str) -> bool:
        """Mock inbound routing configuration"""
        # In production, this would configure Retell's inbound routing
        return True
    
    def _generate_mock_number(self, country_iso: str) -> str:
        """Generate mock E.164 numbers for testing"""
        country_prefixes = {
            'US': '+1',
            'IT': '+39',
            'UK': '+44',
            'DE': '+49',
            'FR': '+33'
        }
        prefix = country_prefixes.get(country_iso, '+1')
        import random
        number = ''.join([str(random.randint(0, 9)) for _ in range(10)])
        return f"{prefix}{number}"

class MockComplianceEngine:
    """Mock compliance engine for testing preflight checks"""
    
    def __init__(self):
        self.rules = {
            'US': {
                'kyc_required': True,
                'quiet_hours': {'Mon-Fri': [['08:00', '21:00']], 'Sat': [['09:00', '17:00']], 'Sun': []},
                'dnc_required': True,
                'caller_id_rules': 'Valid returnable CLI required',
                'restrictions': ['No mobile numbers for marketing', 'TCPA compliance required']
            },
            'IT': {
                'kyc_required': False,
                'quiet_hours': {'Mon-Fri': [['09:00', '20:00']], 'Sat': [['09:00', '18:00']], 'Sun': []},
                'dnc_required': True,
                'caller_id_rules': 'No anonymous CLI allowed',
                'restrictions': ['GDPR consent required', 'Italian language preferred']
            }
        }
    
    def check_preflight(self, from_number: str, to_number: str, country_iso: str, 
                       campaign_type: str = 'outbound') -> Dict[str, Any]:
        """Mock preflight compliance check"""
        rules = self.rules.get(country_iso, {})
        
        # Mock DNC check
        dnc_hit = False
        if rules.get('dnc_required'):
            # Simulate 5% DNC hit rate
            import random
            dnc_hit = random.random() < 0.05
        
        # Mock quiet hours check
        quiet_hours_violation = False
        if rules.get('quiet_hours'):
            current_hour = datetime.now().hour
            quiet_hours_violation = current_hour < 8 or current_hour > 21
        
        decision = 'allow'
        reasons = []
        
        if dnc_hit:
            decision = 'block'
            reasons.append('DNC_HIT')
        elif quiet_hours_violation:
            decision = 'delay'
            reasons.append('QUIET_HOURS')
        
        return {
            'decision': decision,
            'reasons': reasons,
            'rules_applied': list(rules.keys()),
            'timestamp': datetime.now(timezone.utc).isoformat()
        }

class MockLLMProvider:
    """Mock LLM provider for testing outcome extraction"""
    
    def extract_outcome(self, transcript: str, template_schema: Dict[str, Any]) -> Dict[str, Any]:
        """Mock LLM outcome extraction"""
        fields = {}
        
        # Generate mock fields based on template schema
        for field in template_schema.get('fields', []):
            field_key = field.get('key', '')
            field_type = field.get('type', 'text')
            
            if field_type == 'boolean':
                fields[field_key] = True
            elif field_type == 'select':
                options = field.get('options', [])
                fields[field_key] = options[0] if options else 'Unknown'
            elif field_type == 'number':
                fields[field_key] = 5000
            else:
                fields[field_key] = f"Mock {field_key}"
        
        return {
            'fields_json': fields,
            'ai_summary_short': f"Qualified lead: {fields.get('need', 'Unknown need')}",
            'ai_summary_long': f"Spoke with contact about {fields.get('need', 'Unknown')}. Budget: {fields.get('budget', 'Unknown')}. Timeline: {fields.get('timeline', 'Unknown')}.",
            'action_items_json': [
                "Send quote by Friday",
                "Schedule follow-up call",
                "Prepare datasheet"
            ],
            'sentiment': 0.6,
            'score_lead': 78,
            'next_step': fields.get('next_step', 'Follow-up call')
        }

def run_basic_tests():
    """Run basic functionality tests"""
    print("🧪 Running basic tests...")
    
    # Test Retell provider
    retell = MockRetellProvider()
    number = retell.buy_phone_number('US', ['outbound', 'inbound'])
    print(f"✅ Bought number: {number['e164']}")
    
    call = retell.create_call(
        from_number=number['e164'],
        to_number='+1234567890',
        agent_id='agent_en_core',
        metadata={'campaign_id': 'test_campaign'}
    )
    print(f"✅ Created call: {call['id']}")
    
    # Test compliance engine
    compliance = MockComplianceEngine()
    check = compliance.check_preflight('+1234567890', '+0987654321', 'US')
    print(f"✅ Compliance check: {check['decision']} - {check['reasons']}")
    
    # Test LLM provider
    llm = MockLLMProvider()
    template = {
        'fields': [
            {'key': 'need', 'type': 'text'},
            {'key': 'budget', 'type': 'number'},
            {'key': 'timeline', 'type': 'select', 'options': ['<1m', '1-3m', '3-6m']}
        ]
    }
    outcome = llm.extract_outcome("Mock transcript", template)
    print(f"✅ LLM extraction: {outcome['next_step']}")
    
    print("🎉 All basic tests passed!")

if __name__ == "__main__":
    run_basic_tests()
