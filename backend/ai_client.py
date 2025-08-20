# ai_client.py
import hashlib
import os
import time
from dataclasses import dataclass
from typing import Literal, Optional, Dict, Any, List
from openai import OpenAI, APIError, RateLimitError, APITimeoutError

Mode = Literal["fast", "smart", "auto"]

@dataclass
class ModelCfg:
    name: str
    in_cost_per_1k: float  # centesimi o euro: scegli scala coerente
    out_cost_per_1k: float
    ctx: int

DEFAULTS = {
    # Sostituisci se usi nomi diversi / versioni più recenti
    "FAST": ModelCfg(name=os.getenv("LLM_FAST", "gpt-3.5-turbo-0125"),
                     in_cost_per_1k=float(os.getenv("LLM_FAST_IN", "0.0005")),
                     out_cost_per_1k=float(os.getenv("LLM_FAST_OUT","0.0015")),
                     ctx=16384),
    "SMART": ModelCfg(name=os.getenv("LLM_SMART", "gpt-4o-mini"),
                      in_cost_per_1k=float(os.getenv("LLM_SMART_IN","0.0015")),
                      out_cost_per_1k=float(os.getenv("LLM_SMART_OUT","0.006")),
                      ctx=128000),
}

def est_tokens(txt: str) -> int:
    # stima veloce: ~4 char/token
    return max(1, round(len(txt) / 4))

def sha(s: str) -> str:
    return hashlib.sha256(s.encode("utf-8")).hexdigest()

class AIClient:
    """
    Uso:
      ai = AIClient()
      out = ai.run(
          task="call_summary",
          user="Riassumi la chiamata…",
          system="You are a concise call analyst…",
          mode="auto",
          schema=None,  # o dict JSON Schema per output strutturato
          budget=0.01,  # budget (stessa unità dei costi in cfg)
      )
    """
    def __init__(self):
        self.client = OpenAI()
        self.fast = DEFAULTS["FAST"]
        self.smart = DEFAULTS["SMART"]

    # Policy di routing: puoi personalizzare facilmente
    def _pick_model(self, task: str, user: str, schema: Optional[dict], mode: Mode) -> ModelCfg:
        if mode == "fast":
            return self.fast
        if mode == "smart":
            return self.smart

        tokens = est_tokens(user)
        # euristiche:
        if schema is not None and tokens < 2000:
            return self.fast
        long_context = tokens > 4000
        if any(k in task for k in ["summary", "coaching", "kb_extract", "compose", "email"]):
            return self.smart
        if long_context:
            return self.smart
        return self.fast

    def _cost_estimate(self, model: ModelCfg, in_tokens: int, out_tokens: int) -> float:
        return (in_tokens/1000)*model.in_cost_per_1k + (out_tokens/1000)*model.out_cost_per_1k

    def run(
        self,
        task: str,
        user: str,
        system: Optional[str] = None,
        schema: Optional[dict] = None,
        mode: Mode = "auto",
        temperature: float = 0.0,
        max_output_tokens: int = 800,
        budget: Optional[float] = None,
        idempotency_key: Optional[str] = None,
        extra_messages: Optional[List[Dict[str, Any]]] = None,
        retry: int = 2,
        stream: bool = False,
        on_progress: Optional[callable] = None,  # Callback per progress streaming
    ):
        model = self._pick_model(task, user, schema, mode)
        in_tokens = est_tokens((system or "") + user)
        out_tokens = max_output_tokens
        if budget is not None:
            est = self._cost_estimate(model, in_tokens, out_tokens)
            # prova a scendere di modello se sfora
            if est > budget and model.name != self.fast.name:
                alt = self.fast
                est_alt = self._cost_estimate(alt, in_tokens, out_tokens)
                if est_alt <= budget:
                    model = alt
            # riduci output se ancora sopra
            if self._cost_estimate(model, in_tokens, out_tokens) > budget:
                # min 128 token di output
                max_output_tokens = max(128, int(max_output_tokens * 0.5))

        headers = {}
        if idempotency_key:
            headers["Idempotency-Key"] = idempotency_key

        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        if extra_messages:
            messages.extend(extra_messages)
        messages.append({"role": "user", "content": user})

        # Per output JSON affidabile, usarlo come "response_format" ove supportato
        kwargs = {
            "model": model.name,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_output_tokens,
        }
        if schema:
            kwargs["response_format"] = {"type": "json_object"}  # usa JSON schema se disponibile
            # facoltativo: includi lo schema nel system prompt o tool spec

        # Retry/backoff + fallback (fast<->smart) su rate limit e timeouts
        backoff = 0.8
        last_err = None
        for attempt in range(retry + 1):
            try:
                if stream:
                    return self._handle_streaming_response(kwargs, headers, on_progress)
                resp = self.client.chat.completions.create(**kwargs, extra_headers=headers)
                content = resp.choices[0].message.content or ""
                return {
                    "model": model.name,
                    "usage": getattr(resp, "usage", None),
                    "content": content.strip(),
                }
            except (RateLimitError, APITimeoutError) as e:
                last_err = e
                time.sleep(backoff)
                backoff *= 2
                # tenta un fallback di classe se siamo in SMART
                if isinstance(e, RateLimitError) and model.name == self.smart.name:
                    model = self.fast
                    kwargs["model"] = model.name
            except APIError as e:
                last_err = e
                # su 5xx prova fallback di modello una sola volta
                if getattr(e, "status_code", 500) >= 500 and model.name == self.smart.name:
                    model = self.fast
                    kwargs["model"] = model.name
                else:
                    break
        raise last_err or RuntimeError("LLM call failed")

    def _handle_streaming_response(self, kwargs: dict, headers: dict, on_progress: Optional[callable]):
        """Handle streaming response with progress callback"""
        try:
            stream = self.client.chat.completions.create(stream=True, **kwargs, extra_headers=headers)
            
            full_content = ""
            for chunk in stream:
                if chunk.choices[0].delta.content:
                    content = chunk.choices[0].delta.content
                    full_content += content
                    
                    # Call progress callback if provided
                    if on_progress:
                        on_progress(content, full_content)
            
            return {
                "model": kwargs["model"],
                "content": full_content.strip(),
                "streamed": True
            }
            
        except Exception as e:
            print(f"Streaming failed: {e}")
            raise e

    def generate_embeddings(self, texts: List[str], batch_size: int = 32) -> List[List[float]]:
        """Generate embeddings for texts using OpenAI"""
        try:
            embeddings = []
            for i in range(0, len(texts), batch_size):
                batch = texts[i:i + batch_size]
                response = self.client.embeddings.create(
                    input=batch,
                    model=os.getenv("OPENAI_EMBEDDING_MODEL", "text-embedding-3-small")
                )
                batch_embeddings = [data.embedding for data in response.data]
                embeddings.extend(batch_embeddings)
            return embeddings
        except Exception as e:
            print(f"Embedding generation failed: {e}")
            return self._mock_generate_embeddings(texts)

    def _mock_generate_embeddings(self, texts: List[str]) -> List[List[float]]:
        """Mock embedding generation for development"""
        import random
        # Generate deterministic mock embedding based on text hash
        random.seed(42)
        embeddings = []
        for text in texts:
            # Generate deterministic mock embedding based on text hash
            random.seed(hash(text) % 1000000)
            embedding = [random.uniform(-1, 1) for _ in range(384)]
            embeddings.append(embedding)
        return embeddings

# Helper comodi (routing dichiarativo per task tipici della tua app)
AI_TASKS: Dict[str, Dict[str, Any]] = {
    # FAST TASKS (economici, deterministici)
    "intent_classify":   {"mode": "fast",  "temperature": 0.0, "max_output_tokens": 200},
    "csv_field_mapping": {"mode": "fast",  "temperature": 0.0, "max_output_tokens": 300},
    "bant_light":        {"mode": "fast",  "temperature": 0.0, "max_output_tokens": 300},
    "kb_extract_simple": {"mode": "fast",  "temperature": 0.1, "max_output_tokens": 400},
    "field_normalize":   {"mode": "fast",  "temperature": 0.0, "max_output_tokens": 200},
    "dedup_check":       {"mode": "fast",  "temperature": 0.0, "max_output_tokens": 150},
    
    # SMART TASKS (complessi, creativi, sintesi)
    "call_summary":      {"mode": "smart", "temperature": 0.2, "max_output_tokens": 800},
    "bant_full":         {"mode": "smart", "temperature": 0.1, "max_output_tokens": 700},
    "qa_coaching":       {"mode": "smart", "temperature": 0.3, "max_output_tokens": 600},
    "kb_extract":        {"mode": "smart", "temperature": 0.1, "max_output_tokens": 900},
    "prompt_generation": {"mode": "smart", "temperature": 0.4, "max_output_tokens": 1000},
    "email_compose":     {"mode": "smart", "temperature": 0.3, "max_output_tokens": 800},
}

def run_task(ai: AIClient, name: str, user: str, system: Optional[str]=None,
             schema: Optional[dict]=None, budget: Optional[float]=None, **kw):
    cfg = AI_TASKS[name]
    return ai.run(
        task=name,
        user=user,
        system=system,
        schema=schemas[name],
        mode=cfg["mode"],
        temperature=cfg["temperature"],
        max_output_tokens=cfg["max_output_tokens"],
        budget=budget,
        **kw
    )

# Prompt templates e schemi JSON per task comuni
PROMPTS = {
    "csv_field_mapping": {
        "system": {
            "en-US": "You are a CSV field mapping expert. Analyze the CSV headers and suggest the best mapping to company knowledge base fields. Return only valid JSON according to the schema.",
            "it-IT": "Sei un esperto di mapping campi CSV. Analizza le intestazioni CSV e suggerisci il miglior mapping ai campi della knowledge base aziendale. Restituisci solo JSON valido secondo lo schema."
        },
        "user_template": {
            "en-US": "Map these CSV headers to company KB fields: {headers}. Consider common variations and synonyms.",
            "it-IT": "Mappa queste intestazioni CSV ai campi KB aziendali: {headers}. Considera variazioni comuni e sinonimi."
        }
    },
    "kb_extract": {
        "system": {
            "en-US": "You are a knowledge extraction expert. Extract structured information from text according to the provided schema. Be accurate and concise.",
            "it-IT": "Sei un esperto di estrazione conoscenze. Estrai informazioni strutturate dal testo secondo lo schema fornito. Sii preciso e conciso."
        },
        "user_template": {
            "en-US": "Extract company information from this text: {text}",
            "it-IT": "Estrai informazioni aziendali da questo testo: {text}"
        }
    },
    "kb_extract_simple": {
        "system": {
            "en-US": "You are a knowledge extraction expert. Extract basic company information from short text. Return only the most important fields.",
            "it-IT": "Sei un esperto di estrazione conoscenze. Estrai informazioni aziendali base da testo breve. Restituisci solo i campi più importanti."
        },
        "user_template": {
            "en-US": "Extract basic company info from this text: {text}",
            "it-IT": "Estrai informazioni aziendali base da questo testo: {text}"
        }
    },
    "call_summary": {
        "system": {
            "en-US": "You are a call analyst. Create a concise summary of the call with key points and next steps.",
            "it-IT": "Sei un analista di chiamate. Crea un riassunto conciso della chiamata con punti chiave e prossimi passi."
        },
        "user_template": {
            "en-US": "Summarize this call: {call_transcript}",
            "it-IT": "Riassumi questa chiamata: {call_transcript}"
        }
    }
}

def get_localized_prompt(task: str, lang: str = "en-US", **kwargs) -> tuple[str, str]:
    """Get localized system and user prompts for a task"""
    if task not in PROMPTS:
        raise ValueError(f"Unknown task: {task}")
    
    # Fallback to English if language not supported
    if lang not in PROMPTS[task]["system"]:
        lang = "en-US"
    
    system_prompt = PROMPTS[task]["system"][lang]
    user_prompt = PROMPTS[task]["user_template"][lang].format(**kwargs)
    
    return system_prompt, user_prompt

# Advanced prompt templates with examples and few-shot learning
ADVANCED_PROMPTS = {
    "kb_extract_company": {
        "en-US": {
            "system": """You are an expert at extracting company information from business documents. Use these examples as reference:

Example 1:
Text: "Acme Corp is a technology company founded in 2018, based in Milan, Italy. We serve clients in finance and healthcare across Europe."
Output: {
  "purpose": "Technology solutions for finance and healthcare",
  "industry": "Technology",
  "operating_areas": ["Europe"],
  "contacts": {"location": "Milan, Italy"}
}

Example 2:
Text: "Digital Solutions Ltd provides AI consulting services to enterprise clients. Founded in 2020, headquartered in London."
Output: {
  "purpose": "AI consulting services for enterprise",
  "industry": "Consulting",
  "operating_areas": ["London"],
  "description": "AI consulting company"
}

Extract information following this pattern. Be precise and only include information explicitly stated.""",
            "user_template": "Extract company information from this text: {text}"
        },
        "it-IT": {
            "system": """Sei un esperto nell'estrazione di informazioni aziendali da documenti di business. Usa questi esempi come riferimento:

Esempio 1:
Testo: "Acme Corp è un'azienda tecnologica fondata nel 2018, con sede a Milano, Italia. Serviamo clienti in finanza e sanità in tutta Europa."
Output: {
  "purpose": "Soluzioni tecnologiche per finanza e sanità",
  "industry": "Tecnologia",
  "operating_areas": ["Europa"],
  "contacts": {"location": "Milano, Italia"}
}

Esempio 2:
Testo: "Digital Solutions Ltd fornisce servizi di consulenza AI a clienti enterprise. Fondata nel 2020, sede a Londra."
Output: {
  "purpose": "Servizi di consulenza AI per enterprise",
  "industry": "Consulenza",
  "operating_areas": ["Londra"],
  "description": "Azienda di consulenza AI"
}

Estrai informazioni seguendo questo pattern. Sii preciso e includi solo informazioni esplicitamente dichiarate.""",
            "user_template": "Estrai informazioni aziendali da questo testo: {text}"
        }
    },
    "csv_field_mapping_advanced": {
        "en-US": {
            "system": """You are a CSV field mapping expert. Map CSV headers to company knowledge base fields using these examples:

Example 1:
Headers: ["company_name", "address", "phone", "email", "website"]
Output: {
  "mapping": {
    "company_name": "company_name",
    "address": "address", 
    "phone": "phone",
    "email": "email",
    "website": "website"
  },
  "confidence": 0.95,
  "reasoning": "Direct match for all fields"
}

Example 2:
Headers: ["business_name", "location", "contact_number", "email_address", "web_site"]
Output: {
  "mapping": {
    "company_name": "business_name",
    "address": "location",
    "phone": "contact_number", 
    "email": "email_address",
    "website": "web_site"
  },
  "confidence": 0.90,
  "reasoning": "Synonyms mapped correctly"
}

Map the provided headers following this pattern.""",
            "user_template": "Map these CSV headers to company KB fields: {headers}"
        },
        "it-IT": {
            "system": """Sei un esperto di mapping campi CSV. Mappa le intestazioni CSV ai campi della knowledge base aziendale usando questi esempi:

Esempio 1:
Intestazioni: ["company_name", "address", "phone", "email", "website"]
Output: {
  "mapping": {
    "company_name": "company_name",
    "address": "address",
    "phone": "phone", 
    "email": "email",
    "website": "website"
  },
  "confidence": 0.95,
  "reasoning": "Corrispondenza diretta per tutti i campi"
}

Esempio 2:
Intestazioni: ["business_name", "location", "contact_number", "email_address", "web_site"]
Output: {
  "mapping": {
    "company_name": "business_name",
    "address": "location",
    "phone": "contact_number",
    "email": "email_address", 
    "website": "web_site"
  },
  "confidence": 0.90,
  "reasoning": "Sinonimi mappati correttamente"
}

Mappa le intestazioni fornite seguendo questo pattern.""",
            "user_template": "Mappa queste intestazioni CSV ai campi KB aziendali: {headers}"
        }
    }
}

def get_advanced_prompt(task: str, lang: str = "en-US", **kwargs) -> tuple[str, str]:
    """Get advanced prompt with examples for complex tasks"""
    if task not in ADVANCED_PROMPTS:
        raise ValueError(f"Unknown advanced task: {task}")
    
    # Fallback to English if language not supported
    if lang not in ADVANCED_PROMPTS[task]:
        lang = "en-US"
    
    system_prompt = ADVANCED_PROMPTS[task][lang]["system"]
    user_prompt = ADVANCED_PROMPTS[task][lang]["user_template"].format(**kwargs)
    
    return system_prompt, user_prompt

# JSON schemas per output strutturato
schemas = {
    "csv_field_mapping": {
        "type": "object",
        "properties": {
            "mapping": {
                "type": "object",
                "properties": {
                    "company_name": {"type": "string", "description": "CSV header for company name"},
                    "address": {"type": "string", "description": "CSV header for address"},
                    "phone": {"type": "string", "description": "CSV header for phone"},
                    "email": {"type": "string", "description": "CSV header for email"},
                    "website": {"type": "string", "description": "CSV header for website"},
                    "industry": {"type": "string", "description": "CSV header for industry"},
                    "description": {"type": "string", "description": "CSV header for description"},
                    "notes": {"type": "string", "description": "CSV header for notes"}
                },
                "required": ["company_name", "address"]
            },
            "confidence": {"type": "number", "description": "Confidence score 0-1"},
            "reasoning": {"type": "string", "description": "Brief explanation of mapping choices"}
        },
        "required": ["mapping", "confidence"]
    },
    "kb_extract": {
        "type": "object",
        "properties": {
            "purpose": {"type": "string", "description": "Company purpose/mission"},
            "vision": {"type": "string", "description": "Company vision"},
            "icp": {"type": "string", "description": "Ideal Customer Profile"},
            "operating_areas": {"type": "array", "items": {"type": "string"}, "description": "Geographic areas"},
            "contacts": {
                "type": "object",
                "properties": {
                    "phone": {"type": "string"},
                    "email": {"type": "string"},
                    "website": {"type": "string"}
                }
            },
            "industry": {"type": "string", "description": "Business sector"},
            "description": {"type": "string", "description": "Company description"}
        }
    },
    "call_summary": {
        "type": "object",
        "properties": {
            "key_points": {"type": "array", "items": {"type": "string"}, "description": "Main discussion points"},
            "outcome": {"type": "string", "description": "Call result/outcome"},
            "next_steps": {"type": "array", "items": {"type": "string"}, "description": "Action items"},
            "sentiment": {"type": "string", "enum": ["positive", "neutral", "negative"]},
            "lead_score": {"type": "number", "minimum": 1, "maximum": 10, "description": "Lead quality score"}
        },
        "required": ["key_points", "outcome", "next_steps"]
    }
}

# Singleton instance
_ai_client = None

def get_ai_client() -> AIClient:
    """Get singleton AI client instance"""
    global _ai_client
    if _ai_client is None:
        _ai_client = AIClient()
    return _ai_client

    def process_batch(
        self,
        task: str,
        items: List[Dict[str, Any]],
        system: Optional[str] = None,
        mode: Mode = "auto",
        batch_size: int = 5,
        max_concurrent: int = 3,
        budget: Optional[float] = None,
        **kwargs
    ) -> List[Dict[str, Any]]:
        """Process multiple items in batches with concurrency control"""
        results = []
        total_items = len(items)
        
        # Estimate total cost
        if budget:
            estimated_cost = self._estimate_batch_cost(task, items, mode)
            if estimated_cost > budget:
                # Reduce batch size to fit budget
                batch_size = max(1, int(batch_size * (budget / estimated_cost)))
                print(f"Reduced batch size to {batch_size} to fit budget ${budget}")
        
        # Process in batches
        for i in range(0, total_items, batch_size):
            batch = items[i:i + batch_size]
            batch_results = self._process_batch_sync(task, batch, system, mode, **kwargs)
            results.extend(batch_results)
            
            # Progress update
            progress = min(100, ((i + batch_size) / total_items) * 100)
            print(f"Batch processing: {progress:.1f}% complete")
        
        return results
    
    def _estimate_batch_cost(self, task: str, items: List[Dict[str, Any]], mode: Mode) -> float:
        """Estimate total cost for batch processing"""
        model = self._pick_model(task, "", None, mode)
        total_cost = 0
        
        for item in items:
            # Estimate input tokens
            text = str(item.get("text", ""))
            in_tokens = est_tokens(text)
            
            # Estimate output tokens based on task
            out_tokens = self._estimate_output_tokens(task, text)
            
            # Calculate cost
            cost = self._cost_estimate(model, in_tokens, out_tokens)
            total_cost += cost
        
        return total_cost
    
    def _estimate_output_tokens(self, task: str, text: str) -> int:
        """Estimate output tokens based on task and input length"""
        base_tokens = {
            "csv_field_mapping": 300,
            "kb_extract": 900,
            "kb_extract_simple": 400,
            "call_summary": 800,
            "bant_light": 300,
            "bant_full": 700
        }
        
        # Adjust based on input length
        input_tokens = est_tokens(text)
        base = base_tokens.get(task, 500)
        
        if input_tokens < 500:
            return int(base * 0.7)  # Shorter input = shorter output
        elif input_tokens > 2000:
            return int(base * 1.3)  # Longer input = longer output
        else:
            return base
    
    def _process_batch_sync(self, task: str, batch: List[Dict[str, Any]], system: str, mode: Mode, **kwargs) -> List[Dict[str, Any]]:
        """Process a single batch synchronously"""
        results = []
        
        for item in batch:
            try:
                # Prepare user prompt
                if task == "kb_extract" or task == "kb_extract_simple":
                    user_prompt = f"Extract company information from this text: {item.get('text', '')}"
                elif task == "csv_field_mapping":
                    user_prompt = f"Map these CSV headers to company KB fields: {item.get('headers', [])}"
                else:
                    user_prompt = str(item.get("text", ""))
                
                # Process item
                result = self.run(
                    task=task,
                    user=user_prompt,
                    system=system,
                    mode=mode,
                    **kwargs
                )
                
                results.append({
                    "item_id": item.get("id"),
                    "success": True,
                    "result": result,
                    "model_used": result.get("model", "unknown")
                })
                
            except Exception as e:
                results.append({
                    "item_id": item.get("id"),
                    "success": False,
                    "error": str(e),
                    "model_used": "none"
                })
        
        return results
