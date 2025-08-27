"""
AI Service for Gamma Analytics
Low-cost objection classification and sentiment analysis
"""

import hashlib
import json
import logging
from typing import Dict, List, Optional, Any
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from datetime import datetime, timedelta

# from backend.models import AiObjectionCache  # TODO: implement when model exists
from ai_client import OpenAIClient

logger = logging.getLogger(__name__)


class AIService:
    """Service for AI-powered call analysis"""
    
    def __init__(self, db: Session, openai_client: OpenAIClient):
        self.db = db
        self.openai_client = openai_client
        
        # Few-shot examples for objection classification
        self.objection_examples = [
            {
                "input": "I'm not sure about the price, it seems a bit high for what you're offering.",
                "output": {"label": "price", "confidence": 0.95}
            },
            {
                "input": "I'm really busy right now, can we talk about this later?",
                "output": {"label": "timing", "confidence": 0.92}
            },
            {
                "input": "I need to think about whether this is really what I need.",
                "output": {"label": "need", "confidence": 0.88}
            },
            {
                "input": "I have to check with my manager before making any decisions.",
                "output": {"label": "authority", "confidence": 0.94}
            },
            {
                "input": "I'm already working with another company for this.",
                "output": {"label": "competitor", "confidence": 0.89}
            }
        ]
    
    def classify_objection(self, workspace_id: str, text: str, 
                          force_ai: bool = False) -> Dict[str, Any]:
        """Classify customer objection with caching"""
        try:
            # Hash the text for cache lookup
            snippet_sha = hashlib.sha256(text.encode()).hexdigest()
            
            # Check cache first (unless forcing AI)
            if not force_ai:
                cached = self.db.query(AiObjectionCache).filter(
                    AiObjectionCache.snippet_sha == snippet_sha
                ).first()
                
                if cached:
                    # Update access stats
                    cached.last_accessed = cached.last_accessed
                    cached.access_count += 1
                    self.db.commit()
                    
                    logger.info(f"Cache hit for objection classification: {cached.label}")
                    return {
                        "label": cached.label,
                        "confidence": cached.confidence,
                        "cached": True,
                        "model": cached.model_used
                    }
            
            # Use AI classification
            result = self._ai_classify_objection(text)
            
            if result and result.get("label"):
                # Cache the result
                cache_entry = AiObjectionCache(
                    workspace_id=workspace_id,
                    snippet_sha=snippet_sha,
                    label=result["label"],
                    confidence=result.get("confidence", 0.0),
                    model_used="gpt-4o-mini",
                    tokens_used=result.get("tokens_used", 0),
                    cost_micros=result.get("cost_micros", 0)
                )
                self.db.add(cache_entry)
                self.db.commit()
                
                logger.info(f"AI classification cached: {result['label']} (confidence: {result.get('confidence', 0.0)})")
                
                return {
                    **result,
                    "cached": False,
                    "model": "gpt-4o-mini"
                }
            
            # Fallback to keyword classification
            fallback_label = self._keyword_classify_objection(text)
            logger.info(f"Fallback classification: {fallback_label}")
            
            return {
                "label": fallback_label,
                "confidence": 0.6,
                "cached": False,
                "model": "keyword_fallback"
            }
            
        except Exception as e:
            logger.error(f"Error in objection classification: {e}")
            # Emergency fallback
            return {
                "label": "other",
                "confidence": 0.5,
                "cached": False,
                "model": "error_fallback"
            }
    
    def _ai_classify_objection(self, text: str) -> Optional[Dict[str, Any]]:
        """Use OpenAI to classify objection"""
        try:
            # Prepare few-shot prompt
            examples_text = "\n".join([
                f"Input: {ex['input']}\nOutput: {json.dumps(ex['output'])}"
                for ex in self.objection_examples
            ])
            
            system_prompt = f"""You are an expert at classifying customer objections in sales calls.

Classify the customer's objection into one of these categories:
- price: concerns about cost, budget, value
- timing: scheduling, busy, later
- need: relevance, interest, requirements
- authority: decision maker, manager approval
- competitor: working with others, alternatives
- other: doesn't fit above categories

Use the examples below as a guide:

{examples_text}

Return only valid JSON with "label" and "confidence" (0.0-1.0)."""

            user_prompt = f"Input: {text}\nOutput:"
            
            # Call OpenAI
            response = self.openai_client.chat_completion(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                max_tokens=50,
                temperature=0.1
            )
            
            if response and response.get("choices"):
                content = response["choices"][0]["message"]["content"]
                
                # Parse JSON response
                try:
                    result = json.loads(content.strip())
                    if "label" in result and result["label"] in ["price", "timing", "need", "authority", "competitor", "other"]:
                        return {
                            "label": result["label"],
                            "confidence": min(1.0, max(0.0, result.get("confidence", 0.8))),
                            "tokens_used": response.get("usage", {}).get("total_tokens", 0),
                            "cost_micros": self._calculate_cost_micros(response.get("usage", {}))
                        }
                except json.JSONDecodeError:
                    logger.warning(f"Invalid JSON response from AI: {content}")
            
            return None
            
        except Exception as e:
            logger.error(f"Error in AI classification: {e}")
            return None
    
    def _keyword_classify_objection(self, text: str) -> str:
        """Keyword-based fallback classification"""
        text_lower = text.lower()
        
        # Price-related keywords
        price_keywords = ["price", "cost", "expensive", "cheap", "budget", "money", "afford", "value"]
        if any(word in text_lower for word in price_keywords):
            return "price"
        
        # Timing-related keywords
        timing_keywords = ["time", "timing", "schedule", "busy", "later", "now", "soon", "when"]
        if any(word in text_lower for word in timing_keywords):
            return "timing"
        
        # Need-related keywords
        need_keywords = ["need", "want", "interested", "relevant", "useful", "help", "problem"]
        if any(word in text_lower for word in need_keywords):
            return "need"
        
        # Authority-related keywords
        authority_keywords = ["authority", "boss", "manager", "decision", "approve", "check", "ask"]
        if any(word in text_lower for word in authority_keywords):
            return "authority"
        
        # Competitor-related keywords
        competitor_keywords = ["competitor", "competition", "alternative", "other", "already", "working"]
        if any(word in text_lower for word in competitor_keywords):
            return "competitor"
        
        return "other"
    
    def _calculate_cost_micros(self, usage: Dict[str, Any]) -> int:
        """Calculate cost in microcents based on token usage"""
        try:
            # GPT-4o-mini pricing (approximate)
            input_cost_per_1k = 0.15  # cents per 1k input tokens
            output_cost_per_1k = 0.60  # cents per 1k output tokens
            
            input_tokens = usage.get("prompt_tokens", 0)
            output_tokens = usage.get("completion_tokens", 0)
            
            input_cost = (input_tokens / 1000) * input_cost_per_1k
            output_cost = (output_tokens / 1000) * output_cost_per_1k
            
            total_cost_cents = input_cost + output_cost
            return int(total_cost_cents * 10000)  # Convert to microcents
            
        except Exception as e:
            logger.error(f"Error calculating cost: {e}")
            return 0
    
    def batch_classify_objections(self, workspace_id: str, 
                                 texts: List[str]) -> List[Dict[str, Any]]:
        """Batch classify multiple objections for efficiency"""
        results = []
        
        for text in texts:
            result = self.classify_objection(workspace_id, text)
            results.append(result)
        
        return results
    
    def get_cache_stats(self, workspace_id: str) -> Dict[str, Any]:
        """Get cache performance statistics"""
        try:
            total_entries = self.db.query(AiObjectionCache).filter(
                AiObjectionCache.workspace_id == workspace_id
            ).count()
            
            cache_hits = self.db.query(AiObjectionCache).filter(
                and_(
                    AiObjectionCache.workspace_id == workspace_id,
                    AiObjectionCache.access_count > 1
                )
            ).count()
            
            total_cost_micros = self.db.query(
                func.sum(AiObjectionCache.cost_micros)
            ).filter(
                AiObjectionCache.workspace_id == workspace_id
            ).scalar() or 0
            
            hit_rate = (cache_hits / total_entries * 100) if total_entries > 0 else 0
            
            return {
                "total_entries": total_entries,
                "cache_hits": cache_hits,
                "hit_rate_percent": round(hit_rate, 2),
                "total_cost_cents": total_cost_micros / 10000,
                "avg_cost_per_classification_cents": (total_cost_micros / total_entries / 10000) if total_entries > 0 else 0
            }
            
        except Exception as e:
            logger.error(f"Error getting cache stats: {e}")
            return {}
    
    def cleanup_old_cache(self, workspace_id: str, days_old: int = 30) -> int:
        """Clean up old cache entries to save space"""
        try:
            cutoff_date = datetime.utcnow() - timedelta(days=days_old)
            
            deleted_count = self.db.query(AiObjectionCache).filter(
                and_(
                    AiObjectionCache.workspace_id == workspace_id,
                    AiObjectionCache.last_accessed < cutoff_date
                )
            ).delete()
            
            self.db.commit()
            
            logger.info(f"Cleaned up {deleted_count} old cache entries for workspace {workspace_id}")
            return deleted_count
            
        except Exception as e:
            logger.error(f"Error cleaning up cache: {e}")
            self.db.rollback()
            return 0
