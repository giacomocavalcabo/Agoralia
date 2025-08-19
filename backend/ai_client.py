import os
import json
import hashlib
import tiktoken
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime
import openai
from .schemas import KbKind, KbType, CompanyKbTemplate, OfferPackTemplate


class AIClient:
    """AI client for Knowledge Base operations with caching and cost tracking"""
    
    def __init__(self):
        self.provider = os.getenv("AI_PROVIDER", "openai").lower()
        self.api_key = os.getenv("OPENAI_API_KEY")
        self.model = os.getenv("OPENAI_MODEL", "gpt-3.5-turbo")
        self.embedding_model = os.getenv("OPENAI_EMBEDDING_MODEL", "text-embedding-3-small")
        
        if self.provider == "openai" and self.api_key:
            openai.api_key = self.api_key
        elif self.provider == "mock":
            print("Using Mock AI Client for development")
        else:
            print(f"Warning: AI provider '{self.provider}' not configured, using mock")
            self.provider = "mock"
    
    def _count_tokens(self, text: str) -> int:
        """Count tokens in text using tiktoken"""
        try:
            encoding = tiktoken.encoding_for_model(self.model)
            return len(encoding.encode(text))
        except Exception:
            # Fallback: rough estimation (1 token ≈ 4 characters)
            return len(text) // 4
    
    def _estimate_cost(self, tokens_in: int, tokens_out: int = 0) -> int:
        """Estimate cost in microcents based on OpenAI pricing"""
        # GPT-3.5-turbo: $0.0015/1K input, $0.002/1K output
        input_cost = (tokens_in / 1000) * 0.0015 * 1000000  # microcents
        output_cost = (tokens_out / 1000) * 0.002 * 1000000  # microcents
        return int(input_cost + output_cost)
    
    def _get_cache_key(self, content: str, operation: str) -> str:
        """Generate cache key for content"""
        return hashlib.sha256(f"{content}:{operation}".encode()).hexdigest()
    
    def extract_kb_fields(self, text: str, template: str, lang: str = "en-US") -> Tuple[Dict[str, Any], int, int]:
        """Extract structured fields from text using AI"""
        if self.provider == "mock":
            return self._mock_extract_fields(text, template, lang)
        
        try:
            # Prepare prompt based on template
            if template == "company":
                prompt = self._build_company_prompt(text, lang)
            elif template == "offer_pack":
                prompt = self._build_offer_pack_prompt(text, lang)
            else:
                prompt = self._build_generic_prompt(text, template, lang)
            
            # Call OpenAI
            response = openai.ChatCompletion.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are an expert at extracting structured information from business documents. Return only valid JSON."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.1,
                max_tokens=2000
            )
            
            # Parse response
            content = response.choices[0].message.content
            extracted_data = json.loads(content)
            
            # Count tokens
            tokens_in = self._count_tokens(prompt)
            tokens_out = self._count_tokens(content)
            
            return extracted_data, tokens_in, tokens_out
            
        except Exception as e:
            print(f"AI extraction failed: {e}")
            # Fallback to mock
            return self._mock_extract_fields(text, template, lang)
    
    def generate_embeddings(self, texts: List[str], batch_size: int = 32) -> List[List[float]]:
        """Generate embeddings for texts"""
        if self.provider == "mock":
            return self._mock_generate_embeddings(texts)
        
        try:
            embeddings = []
            for i in range(0, len(texts), batch_size):
                batch = texts[i:i + batch_size]
                response = openai.Embedding.create(
                    input=batch,
                    model=self.embedding_model
                )
                batch_embeddings = [data.embedding for data in response.data]
                embeddings.extend(batch_embeddings)
            
            return embeddings
            
        except Exception as e:
            print(f"Embedding generation failed: {e}")
            return self._mock_generate_embeddings(texts)
    
    def _build_company_prompt(self, text: str, lang: str) -> str:
        """Build prompt for company KB extraction"""
        return f"""
Extract company information from the following text and return a JSON object with these fields:
- purpose: Company purpose in 1 sentence
- vision: Company vision statement
- brand_voice: {{"dos": [list of brand voice do's], "donts": [list of brand voice don'ts]}}
- operating_areas: [{{"country_iso": "IT", "langs": ["it-IT"]}}]
- icp: {{"industries": [target industries], "roles": [target roles]}}
- contacts: {{"sales": "email", "support": "phone"}}
- policies: {{"returns": "policy", "shipping": "policy", "warranty": "policy"}}
- legal_defaults: {{"disclosure": "default", "recording": true/false}}

Text: {text}
Language: {lang}

Return only valid JSON:
"""
    
    def _build_offer_pack_prompt(self, text: str, lang: str) -> str:
        """Build prompt for offer pack extraction"""
        return f"""
Extract product/service information from the following text and return a JSON object with these fields:
- name: Product/service name
- type: Business type (saas, consulting, physical, marketplace, logistics, manufacturing, other)
- languages: [supported languages]
- value_props: [value propositions]
- differentiators: [competitive differentiators]
- pricing_bands: [{{"label": "tier", "from": 0, "to": 999, "currency": "EUR"}}]
- qualification: {{"budget": "requirement", "authority": "requirement", "need": "requirement", "timing": "requirement"}}
- objections: [{{"q": "objection", "a": "response"}}]
- scripts: {{"opening": "opening script", "closing": "closing script"}}
- cta: [call to action options]
- faq: [{{"q": "question", "a": "answer"}}]

Text: {text}
Language: {lang}

Return only valid JSON:
"""
    
    def _build_generic_prompt(self, text: str, template: str, lang: str) -> str:
        """Build generic prompt for unknown templates"""
        return f"""
Extract structured information from the following text based on the template '{template}'.
Return a JSON object with relevant fields.

Text: {text}
Language: {lang}

Return only valid JSON:
"""
    
    def _mock_extract_fields(self, text: str, template: str, lang: str) -> Tuple[Dict[str, Any], int, int]:
        """Mock field extraction for development"""
        tokens_in = self._count_tokens(text)
        tokens_out = 100  # Mock output tokens
        
        if template == "company":
            extracted_data = {
                "purpose": f"Mock company purpose extracted from {len(text)} characters",
                "vision": f"Mock vision statement for {lang}",
                "brand_voice": {
                    "dos": ["Professional", "Helpful", "Transparent"],
                    "donts": ["Pushy", "Vague", "Unprofessional"]
                },
                "operating_areas": [{"country_iso": "IT", "langs": [lang]}],
                "icp": {"industries": ["Technology", "Manufacturing"], "roles": ["Manager", "Director"]},
                "contacts": {"sales": "sales@example.com", "support": "+39000000000"},
                "policies": {"returns": "30 days", "shipping": "Free over €50", "warranty": "2 years"},
                "legal_defaults": {"disclosure": "standard", "recording": True}
            }
        elif template == "offer_pack":
            extracted_data = {
                "name": f"Mock {template} product",
                "type": "saas",
                "languages": [lang],
                "value_props": ["Efficiency", "Cost savings", "Easy to use"],
                "differentiators": ["AI-powered", "24/7 support", "Customizable"],
                "pricing_bands": [{"label": "Starter", "from": 0, "to": 99, "currency": "EUR"}],
                "qualification": {"budget": "€100-1000", "authority": "Decision maker", "need": "Immediate", "timing": "1-3 months"},
                "objections": [{"q": "Too expensive", "a": "ROI in 3 months"}],
                "scripts": {"opening": "Hello, I'm calling about...", "closing": "Thank you for your time"},
                "cta": ["book_demo", "send_quote"],
                "faq": [{"q": "How does it work?", "a": "Simple setup process"}]
            }
        else:
            extracted_data = {
                "extracted_text": text[:100] + "...",
                "template": template,
                "language": lang
            }
        
        return extracted_data, tokens_in, tokens_out
    
    def _mock_generate_embeddings(self, texts: List[str]) -> List[List[float]]:
        """Mock embedding generation for development"""
        # Generate mock 384-dimensional embeddings
        import random
        random.seed(42)  # Consistent for development
        
        embeddings = []
        for text in texts:
            # Generate deterministic mock embedding based on text hash
            text_hash = hash(text) % 1000000
            random.seed(text_hash)
            embedding = [random.uniform(-1, 1) for _ in range(384)]
            embeddings.append(embedding)
        
        return embeddings


# Global AI client instance
ai_client = AIClient()


# Template definitions
KB_TEMPLATES = {
    "company": {
        "name": "Company Knowledge Base",
        "sections": [
            {"key": "purpose", "title": "Purpose", "order_index": 1},
            {"key": "vision", "title": "Vision", "order_index": 2},
            {"key": "brand_voice", "title": "Brand Voice", "order_index": 3},
            {"key": "operating_areas", "title": "Operating Areas", "order_index": 4},
            {"key": "icp", "title": "Ideal Customer Profile", "order_index": 5},
            {"key": "contacts", "title": "Contacts", "order_index": 6},
            {"key": "policies", "title": "Policies", "order_index": 7},
            {"key": "legal_defaults", "title": "Legal Defaults", "order_index": 8}
        ]
    },
    "offer_pack": {
        "name": "Offer Pack",
        "sections": [
            {"key": "overview", "title": "Overview", "order_index": 1},
            {"key": "value_props", "title": "Value Propositions", "order_index": 2},
            {"key": "differentiators", "title": "Differentiators", "order_index": 3},
            {"key": "pricing", "title": "Pricing", "order_index": 4},
            {"key": "qualification", "title": "Qualification (BANT)", "order_index": 5},
            {"key": "objections", "title": "Objections & Responses", "order_index": 6},
            {"key": "scripts", "title": "Scripts", "order_index": 7},
            {"key": "cta", "title": "Call to Action", "order_index": 8},
            {"key": "faq", "title": "FAQ", "order_index": 9}
        ]
    }
}


def get_kb_template(template_name: str) -> Dict[str, Any]:
    """Get KB template by name"""
    return KB_TEMPLATES.get(template_name, {})


def create_default_sections(kb_id: str, template_name: str) -> List[Dict[str, Any]]:
    """Create default sections for a new KB"""
    template = get_kb_template(template_name)
    sections = []
    
    for section_data in template.get("sections", []):
        section = {
            "id": f"section_{len(sections) + 1}",
            "kb_id": kb_id,
            **section_data,
            "content_md": None,
            "content_json": None,
            "completeness_pct": 0,
            "updated_at": datetime.utcnow()
        }
        sections.append(section)
    
    return sections
