import os
import json
import asyncio
import hashlib
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime
import tiktoken
from .schemas import KbKind, KbType, CompanyKbTemplate, OfferPackTemplate

try:
    from openai import OpenAI
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False
    print("Warning: OpenAI package not available, using mock client")


class AIClient:
    """AI client for Knowledge Base operations with caching and cost tracking"""
    
    def __init__(self):
        self.provider = os.getenv("AI_PROVIDER", "openai").lower()
        self.api_key = os.getenv("OPENAI_API_KEY")
        self.model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
        self.embedding_model = os.getenv("OPENAI_EMBEDDING_MODEL", "text-embedding-3-small")
        
        if self.provider == "openai" and self.api_key and OPENAI_AVAILABLE:
            self.client = OpenAI(api_key=self.api_key)
            print(f"✅ OpenAI client initialized with model: {self.model}")
        elif self.provider == "mock":
            print("Using Mock AI Client for development")
            self.client = None
        else:
            print(f"Warning: AI provider '{self.provider}' not configured, using mock")
            self.provider = "mock"
            self.client = None
    
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
        # GPT-4o-mini: $0.00015/1K input, $0.0006/1K output
        input_cost = (tokens_in / 1000) * 0.00015 * 1000000  # microcents
        output_cost = (tokens_out / 1000) * 0.0006 * 1000000  # microcents
        return int(input_cost + output_cost)
    
    def _get_cache_key(self, content: str, operation: str) -> str:
        """Generate cache key for content"""
        return hashlib.sha256(f"{content}:{operation}".encode()).hexdigest()
    
    def extract_kb_fields(self, text: str, template: str, lang: str = "en-US") -> Tuple[Dict[str, Any], int, int]:
        """Extract structured fields from text using AI"""
        if self.provider == "mock" or not self.client:
            return self._mock_extract_fields(text, template, lang)
        
        try:
            # Prepare prompt based on template
            if template == "company":
                prompt = self._build_company_prompt(text, lang)
            elif template == "offer_pack":
                prompt = self._build_offer_pack_prompt(text, lang)
            else:
                prompt = self._build_generic_prompt(text, template, lang)
            
            # Call OpenAI with new client syntax
            response = self.client.chat.completions.create(
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
        if self.provider == "mock" or not self.client:
            return self._mock_generate_embeddings(texts)
        
        try:
            embeddings = []
            for i in range(0, len(texts), batch_size):
                batch = texts[i:i + batch_size]
                response = self.client.embeddings.create(
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
        """Build prompt for company information extraction"""
        lang_instruction = "Rispondi in italiano" if lang.startswith("it") else "Respond in English"
        
        return f"""
        {lang_instruction}
        
        Extract company information from this text and return as JSON:
        
        {text}
        
        Return JSON with these fields:
        {{
            "name": "Company name",
            "industry": "Industry/sector",
            "size": "Company size (small/medium/large)",
            "location": "Location/country",
            "description": "Brief description",
            "website": "Website if mentioned",
            "phone": "Phone number if mentioned",
            "email": "Email if mentioned"
        }}
        """
    
    def _build_offer_pack_prompt(self, text: str, lang: str) -> str:
        """Build prompt for offer pack information extraction"""
        lang_instruction = "Rispondi in italiano" if lang.startswith("it") else "Respond in English"
        
        return f"""
        {lang_instruction}
        
        Extract offer pack information from this text and return as JSON:
        
        {text}
        
        Return JSON with these fields:
        {{
            "title": "Offer title",
            "description": "Offer description",
            "price": "Price if mentioned",
            "validity": "Validity period if mentioned",
            "features": ["Feature 1", "Feature 2"],
            "target_audience": "Target audience",
            "conditions": "Special conditions if any"
        }}
        """
    
    def _build_generic_prompt(self, text: str, template: str, lang: str) -> str:
        """Build generic prompt for other templates"""
        lang_instruction = "Rispondi in italiano" if lang.startswith("it") else "Respond in English"
        
        return f"""
        {lang_instruction}
        
        Extract structured information from this text using template '{template}' and return as JSON:
        
        {text}
        
        Analyze the text and return relevant information in JSON format.
        """
    
    def _mock_extract_fields(self, text: str, template: str, lang: str) -> Tuple[Dict[str, Any], int, int]:
        """Mock implementation for development/testing"""
        print(f"Mock AI: Extracting {template} fields from text ({len(text)} chars)")
        
        if template == "company":
            mock_data = {
                "name": "Mock Company Ltd",
                "industry": "Technology",
                "size": "medium",
                "location": "Italy",
                "description": "Mock company description",
                "website": "https://mock.com",
                "phone": "+39 123 456 789",
                "email": "info@mock.com"
            }
        elif template == "offer_pack":
            mock_data = {
                "title": "Mock Offer Pack",
                "description": "Mock offer description",
                "price": "€99/month",
                "validity": "30 days",
                "features": ["Feature 1", "Feature 2", "Feature 3"],
                "target_audience": "Small businesses",
                "conditions": "Standard terms apply"
            }
        else:
            mock_data = {
                "extracted": True,
                "template": template,
                "content_length": len(text)
            }
        
        # Mock token counts
        tokens_in = len(text) // 4
        tokens_out = len(json.dumps(mock_data)) // 4
        
        return mock_data, tokens_in, tokens_out
    
    def _mock_generate_embeddings(self, texts: List[str]) -> List[List[float]]:
        """Mock embeddings for development/testing"""
        print(f"Mock AI: Generating embeddings for {len(texts)} texts")
        
        # Generate mock embeddings (1536-dimensional like text-embedding-3-small)
        mock_embeddings = []
        for text in texts:
            # Simple hash-based mock embedding
            import random
            random.seed(hash(text) % 2**32)
            embedding = [random.uniform(-1, 1) for _ in range(1536)]
            # Normalize
            norm = sum(x*x for x in embedding) ** 0.5
            embedding = [x/norm for x in embedding]
            mock_embeddings.append(embedding)
        
        return mock_embeddings


# Global AI client instance
ai_client = AIClient()


def get_kb_template(template_type: str, lang: str = "en-US") -> Dict[str, Any]:
    """Get Knowledge Base template for given type and language"""
    if template_type == "company":
        return CompanyKbTemplate(lang=lang).dict()
    elif template_type == "offer_pack":
        return OfferPackTemplate(lang=lang).dict()
    else:
        return {"type": template_type, "lang": lang, "fields": []}


def create_default_sections(kb_id: str, template_type: str, lang: str = "en-US") -> List[Dict[str, Any]]:
    """Create default sections for new Knowledge Base"""
    if template_type == "company":
        sections = [
            {
                "id": f"section_{kb_id}_company_info",
                "kb_id": kb_id,
                "title": "Company Information" if lang.startswith("en") else "Informazioni Aziendali",
                "order": 1,
                "content": "Basic company details and overview"
            },
            {
                "id": f"section_{kb_id}_products",
                "kb_id": kb_id,
                "title": "Products & Services" if lang.startswith("en") else "Prodotti e Servizi",
                "order": 2,
                "content": "Description of products and services offered"
            },
            {
                "id": f"section_{kb_id}_contact",
                "kb_id": kb_id,
                "title": "Contact Information" if lang.startswith("en") else "Informazioni di Contatto",
                "order": 3,
                "content": "How to get in touch with the company"
            }
        ]
    elif template_type == "offer_pack":
        sections = [
            {
                "id": f"section_{kb_id}_offer_details",
                "kb_id": kb_id,
                "title": "Offer Details" if lang.startswith("en") else "Dettagli Offerta",
                "order": 1,
                "content": "Detailed description of the offer"
            },
            {
                "id": f"section_{kb_id}_pricing",
                "kb_id": kb_id,
                "title": "Pricing" if lang.startswith("en") else "Prezzi",
                "order": 2,
                "content": "Pricing information and options"
            },
            {
                "id": f"section_{kb_id}_terms",
                "kb_id": kb_id,
                "title": "Terms & Conditions" if lang.startswith("en") else "Termini e Condizioni",
                "order": 3,
                "content": "Terms and conditions of the offer"
            }
        ]
    else:
        sections = [
            {
                "id": f"section_{kb_id}_general",
                "kb_id": kb_id,
                "title": "General Information" if lang.startswith("en") else "Informazioni Generali",
                "order": 1,
                "content": "General information and overview"
            }
        ]
    
    return sections
