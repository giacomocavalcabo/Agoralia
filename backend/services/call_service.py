"""
Call Service for Gamma Analytics
Handles call storage, aggregation, and analytics
"""

import hashlib
import json
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from sqlalchemy.orm import Session
from sqlalchemy import and_, func, desc

# from backend.models import (  # TODO: implement when models exist
#     CallRecord, CallTurn, CallQuality, CallDailyAggregate,
#     RetellWebhookEvent, AiObjectionCache
# )
from services.ai_service import AIService

logger = logging.getLogger(__name__)


class CallService:
    """Service for managing call data and analytics"""
    
    def __init__(self, db: Session, ai_service: Optional[AIService] = None):
        self.db = db
        self.ai_service = ai_service
    
    def process_retell_webhook(self, workspace_id: str, event_data: Dict[str, Any]) -> bool:
        """Process Retell webhook event with idempotency"""
        try:
            event_id = event_data.get("event_id")
            if not event_id:
                logger.error("Missing event_id in webhook data")
                return False
            
            # Check if already processed
            existing = self.db.query(RetellWebhookEvent).filter(
                RetellWebhookEvent.event_id == event_id
            ).first()
            
            if existing:
                logger.info(f"Event {event_id} already processed")
                return True
            
            # Store webhook event
            webhook_event = RetellWebhookEvent(
                workspace_id=workspace_id,
                event_id=event_id,
                event_type=event_data.get("event_type", "unknown"),
                payload_json=event_data
            )
            self.db.add(webhook_event)
            
            # Process based on event type
            if event_data.get("event_type") == "call_ended":
                self._process_call_ended(workspace_id, event_data)
            elif event_data.get("event_type") == "transcript_ready":
                self._process_transcript(workspace_id, event_data)
            
            self.db.commit()
            return True
            
        except Exception as e:
            logger.error(f"Error processing webhook: {e}")
            self.db.rollback()
            return False
    
    def _process_call_ended(self, workspace_id: str, event_data: Dict[str, Any]):
        """Process call ended event"""
        try:
            call_data = event_data.get("call", {})
            retell_call_id = call_data.get("call_id")
            
            if not retell_call_id:
                return
            
            # Create or update call record
            call_record = self.db.query(CallRecord).filter(
                CallRecord.retell_call_id == retell_call_id
            ).first()
            
            if not call_record:
                # Extract phone number and hash it
                phone = call_data.get("phone_number")
                phone_hash = self._hash_phone(phone) if phone else None
                
                call_record = CallRecord(
                    workspace_id=workspace_id,
                    retell_call_id=retell_call_id,
                    started_at=datetime.fromisoformat(call_data.get("started_at", "")),
                    ended_at=datetime.fromisoformat(call_data.get("ended_at", "")),
                    duration_sec=call_data.get("duration_seconds", 0),
                    direction="outbound",
                    country_iso=call_data.get("country_code"),
                    language=call_data.get("language", "en-US"),
                    outcome=self._map_outcome(call_data.get("outcome")),
                    outcome_reason=call_data.get("outcome_reason"),
                    cost_cents=int(call_data.get("cost", 0) * 100),  # Convert to cents
                    recording_url=call_data.get("recording_url"),
                    phone_hash=phone_hash,
                    meta_json=call_data
                )
                self.db.add(call_record)
            else:
                # Update existing record
                call_record.ended_at = datetime.fromisoformat(call_data.get("ended_at", ""))
                call_record.duration_sec = call_data.get("duration_seconds", 0)
                call_record.outcome = self._map_outcome(call_data.get("outcome"))
                call_record.outcome_reason = call_data.get("outcome_reason")
                call_record.cost_cents = int(call_data.get("cost", 0) * 100)
                call_record.updated_at = datetime.utcnow()
            
            # Update daily aggregates
            self._update_daily_aggregates(call_record)
            
        except Exception as e:
            logger.error(f"Error processing call ended: {e}")
    
    def _process_transcript(self, workspace_id: str, event_data: Dict[str, Any]):
        """Process transcript ready event"""
        try:
            call_data = event_data.get("call", {})
            retell_call_id = call_data.get("call_id")
            transcript = event_data.get("transcript", {})
            
            if not retell_call_id or not transcript:
                return
            
            call_record = self.db.query(CallRecord).filter(
                CallRecord.retell_call_id == retell_call_id
            ).first()
            
            if not call_record:
                return
            
            # Hash transcript for PII protection
            transcript_text = json.dumps(transcript, sort_keys=True)
            transcript_sha = hashlib.sha256(transcript_text.encode()).hexdigest()
            call_record.transcript_sha = transcript_sha
            
            # Process turns
            self._process_transcript_turns(call_record.id, transcript)
            
            # Analyze quality
            self._analyze_call_quality(call_record.id, transcript)
            
        except Exception as e:
            logger.error(f"Error processing transcript: {e}")
    
    def _process_transcript_turns(self, call_id: str, transcript: Dict[str, Any]):
        """Process individual speaker turns"""
        try:
            turns = transcript.get("turns", [])
            
            for turn in turns:
                turn_record = CallTurn(
                    call_id=call_id,
                    speaker=turn.get("speaker", "unknown"),
                    t_start_ms=turn.get("start_ms", 0),
                    t_end_ms=turn.get("end_ms", 0),
                    text=turn.get("text", ""),
                    confidence=turn.get("confidence", 1.0),
                    meta_json=turn
                )
                self.db.add(turn_record)
                
        except Exception as e:
            logger.error(f"Error processing turns: {e}")
    
    def _analyze_call_quality(self, call_id: str, transcript: Dict[str, Any]):
        """Analyze call quality metrics"""
        try:
            turns = transcript.get("turns", [])
            
            # Calculate timing metrics
            agent_turns = [t for t in turns if t.get("speaker") == "agent"]
            customer_turns = [t for t in turns if t.get("speaker") == "customer"]
            
            talk_time_agent = sum(t.get("end_ms", 0) - t.get("start_ms", 0) for t in agent_turns) // 1000
            talk_time_customer = sum(t.get("end_ms", 0) - t.get("start_ms", 0) for t in customer_turns) // 1000
            
            # Calculate dead air (gaps between turns)
            dead_air = self._calculate_dead_air(turns)
            
            # Analyze objections
            objections = self._classify_objections(turns)
            
            quality_record = CallQuality(
                call_id=call_id,
                talk_time_agent_sec=talk_time_agent,
                talk_time_customer_sec=talk_time_customer,
                dead_air_sec=dead_air,
                interruptions_agent=0,  # TODO: Implement interruption detection
                interruptions_customer=0,
                sentiment_avg=0.0,  # TODO: Implement sentiment analysis
                sentiment_agent=0.0,
                sentiment_customer=0.0,
                objections_json=objections
            )
            self.db.add(quality_record)
            
        except Exception as e:
            logger.error(f"Error analyzing call quality: {e}")
    
    def _calculate_dead_air(self, turns: List[Dict[str, Any]]) -> int:
        """Calculate total dead air time in seconds"""
        try:
            if len(turns) < 2:
                return 0
            
            # Sort turns by start time
            sorted_turns = sorted(turns, key=lambda x: x.get("start_ms", 0))
            
            total_dead_air = 0
            for i in range(len(sorted_turns) - 1):
                current_end = sorted_turns[i].get("end_ms", 0)
                next_start = sorted_turns[i + 1].get("start_ms", 0)
                
                if next_start > current_end:
                    gap = next_start - current_end
                    total_dead_air += gap
            
            return total_dead_air // 1000  # Convert to seconds
            
        except Exception as e:
            logger.error(f"Error calculating dead air: {e}")
            return 0
    
    def _classify_objections(self, turns: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Classify customer objections using AI cache"""
        try:
            objections = []
            customer_turns = [t for t in turns if t.get("speaker") == "customer"]
            
            for turn in customer_turns:
                text = turn.get("text", "")
                if len(text) < 20:  # Skip very short turns
                    continue
                
                # Check cache first
                snippet_sha = hashlib.sha256(text.encode()).hexdigest()
                cached = self.db.query(AiObjectionCache).filter(
                    AiObjectionCache.snippet_sha == snippet_sha
                ).first()
                
                if cached:
                    objections.append({
                        "label": cached.label,
                        "confidence": cached.confidence,
                        "snippet": text[:100],  # Truncate for privacy
                        "cached": True
                    })
                else:
                    # Use AI service if available, otherwise fallback to keywords
                    if self.ai_service:
                        ai_result = self.ai_service.classify_objection(workspace_id, text)
                        if ai_result and ai_result.get("label") != "other":
                            objections.append({
                                "label": ai_result["label"],
                                "confidence": ai_result.get("confidence", 0.7),
                                "snippet": text[:100],
                                "cached": ai_result.get("cached", False),
                                "model": ai_result.get("model", "unknown")
                            })
                    else:
                        # Fallback to keyword-based classification
                        label = self._keyword_classify_objection(text)
                        if label != "other":
                            objections.append({
                                "label": label,
                                "confidence": 0.7,
                                "snippet": text[:100],
                                "cached": False,
                                "model": "keyword_fallback"
                            })
            
            return objections
            
        except Exception as e:
            logger.error(f"Error classifying objections: {e}")
            return []
    
    def _keyword_classify_objection(self, text: str) -> str:
        """Simple keyword-based objection classification"""
        text_lower = text.lower()
        
        if any(word in text_lower for word in ["price", "cost", "expensive", "cheap", "budget"]):
            return "price"
        elif any(word in text_lower for word in ["time", "timing", "schedule", "busy", "later"]):
            return "timing"
        elif any(word in text_lower for word in ["need", "want", "interested", "relevant"]):
            return "need"
        elif any(word in text_lower for word in ["authority", "boss", "manager", "decision"]):
            return "authority"
        elif any(word in text_lower for word in ["competitor", "competition", "alternative"]):
            return "competitor"
        else:
            return "other"
    
    def _update_daily_aggregates(self, call_record: CallRecord):
        """Update daily aggregated metrics"""
        try:
            # Get date (start of day)
            call_date = call_record.started_at.replace(hour=0, minute=0, second=0, microsecond=0)
            
            # Find existing aggregate
            aggregate = self.db.query(CallDailyAggregate).filter(
                and_(
                    CallDailyAggregate.workspace_id == call_record.workspace_id,
                    CallDailyAggregate.date == call_date,
                    CallDailyAggregate.campaign_id == call_record.campaign_id,
                    CallDailyAggregate.agent_id == call_record.agent_id,
                    CallDailyAggregate.country_iso == call_record.country_iso,
                    CallDailyAggregate.language == call_record.language
                )
            ).first()
            
            if aggregate:
                # Update existing
                if call_record.outcome == "reached":
                    aggregate.reached += 1
                elif call_record.outcome == "connected":
                    aggregate.connected += 1
                elif call_record.outcome == "qualified":
                    aggregate.qualified += 1
                elif call_record.outcome == "booked":
                    aggregate.booked += 1
                
                aggregate.total_duration_sec += call_record.duration_sec or 0
                aggregate.total_cost_cents += call_record.cost_cents or 0
                aggregate.avg_duration_sec = aggregate.total_duration_sec / (aggregate.reached + aggregate.connected + aggregate.qualified + aggregate.booked)
                aggregate.avg_cost_cents = aggregate.total_cost_cents / (aggregate.reached + aggregate.connected + aggregate.qualified + aggregate.booked)
                aggregate.last_updated = datetime.utcnow()
            else:
                # Create new aggregate
                aggregate = CallDailyAggregate(
                    workspace_id=call_record.workspace_id,
                    date=call_date,
                    campaign_id=call_record.campaign_id,
                    agent_id=call_record.agent_id,
                    country_iso=call_record.country_iso,
                    language=call_record.language,
                    reached=1 if call_record.outcome == "reached" else 0,
                    connected=1 if call_record.outcome == "connected" else 0,
                    qualified=1 if call_record.outcome == "qualified" else 0,
                    booked=1 if call_record.outcome == "booked" else 0,
                    total_duration_sec=call_record.duration_sec or 0,
                    avg_duration_sec=call_record.duration_sec or 0,
                    total_cost_cents=call_record.cost_cents or 0,
                    avg_cost_cents=call_record.cost_cents or 0
                )
                self.db.add(aggregate)
            
        except Exception as e:
            logger.error(f"Error updating daily aggregates: {e}")
    
    def _hash_phone(self, phone: str) -> str:
        """Hash phone number with salt for PII protection"""
        salt = "coldai_phone_salt_2025"  # TODO: Move to environment
        return hashlib.sha256(f"{phone}{salt}".encode()).hexdigest()
    
    def _map_outcome(self, retell_outcome: str) -> str:
        """Map Retell outcome to internal outcome"""
        mapping = {
            "answered": "connected",
            "no_answer": "reached",
            "busy": "reached",
            "failed": "failed",
            "completed": "connected"
        }
        return mapping.get(retell_outcome, "reached")
    
    def get_timeseries_data(self, workspace_id: str, days: int = 30, 
                           campaign_id: Optional[str] = None, agent_id: Optional[str] = None,
                           lang: Optional[str] = None, country: Optional[str] = None) -> Dict[str, Any]:
        """Get timeseries data for analytics"""
        try:
            end_date = datetime.utcnow()
            start_date = end_date - timedelta(days=days)
            
            # Build query
            query = self.db.query(CallDailyAggregate).filter(
                and_(
                    CallDailyAggregate.workspace_id == workspace_id,
                    CallDailyAggregate.date >= start_date,
                    CallDailyAggregate.date <= end_date
                )
            )
            
            if campaign_id:
                query = query.filter(CallDailyAggregate.campaign_id == campaign_id)
            if agent_id:
                query = query.filter(CallDailyAggregate.agent_id == agent_id)
            if lang:
                query = query.filter(CallDailyAggregate.language == lang)
            if country:
                query = query.filter(CallDailyAggregate.country_iso == country)
            
            # Group by date and aggregate
            results = query.group_by(
                func.date(CallDailyAggregate.date)
            ).with_entities(
                func.date(CallDailyAggregate.date).label('date'),
                func.sum(CallDailyAggregate.reached).label('reached'),
                func.sum(CallDailyAggregate.connected).label('connected'),
                func.sum(CallDailyAggregate.qualified).label('qualified'),
                func.sum(CallDailyAggregate.booked).label('booked'),
                func.avg(CallDailyAggregate.avg_duration_sec).label('avg_duration_sec'),
                func.sum(CallDailyAggregate.total_cost_cents).label('total_cost_cents')
            ).order_by('date').all()
            
            # Format response
            series = []
            for result in results:
                series.append({
                    "date": result.date.strftime("%Y-%m-%d"),
                    "reached": result.reached or 0,
                    "connected": result.connected or 0,
                    "qualified": result.qualified or 0,
                    "booked": result.booked or 0,
                    "avg_duration_sec": int(result.avg_duration_sec or 0),
                    "total_cost_cents": result.total_cost_cents or 0
                })
            
            return {
                "granularity": "day",
                "series": series,
                "moving_avg": {"window": 7},
                "filters": {
                    "campaign_id": campaign_id,
                    "agent_id": agent_id,
                    "lang": lang,
                    "country": country
                }
            }
            
        except Exception as e:
            logger.error(f"Error getting timeseries data: {e}")
            return {"granularity": "day", "series": [], "moving_avg": {"window": 7}, "filters": {}}
    
    def get_outcomes_data(self, workspace_id: str, days: int = 30,
                         campaign_id: Optional[str] = None, agent_id: Optional[str] = None,
                         lang: Optional[str] = None, country: Optional[str] = None) -> Dict[str, Any]:
        """Get outcomes breakdown data"""
        try:
            end_date = datetime.utcnow()
            start_date = end_date - timedelta(days=days)
            
            # Build query
            query = self.db.query(CallRecord).filter(
                and_(
                    CallRecord.workspace_id == workspace_id,
                    CallRecord.started_at >= start_date,
                    CallRecord.started_at <= end_date
                )
            )
            
            if campaign_id:
                query = query.filter(CallRecord.campaign_id == campaign_id)
            if agent_id:
                query = query.filter(CallRecord.agent_id == agent_id)
            if lang:
                query = query.filter(CallRecord.language == lang)
            if country:
                query = query.filter(CallRecord.country_iso == country)
            
            # Get outcomes by reason
            outcomes_by_reason = query.group_by(
                CallRecord.outcome_reason
            ).with_entities(
                CallRecord.outcome_reason,
                func.count(CallRecord.id).label('count')
            ).all()
            
            # Get totals
            totals_query = query.with_entities(
                func.sum(func.case((CallRecord.outcome == "booked", 1), else_=0)).label('booked'),
                func.sum(func.case((CallRecord.outcome == "qualified", 1), else_=0)).label('qualified'),
                func.sum(func.case((CallRecord.outcome.in_(["reached", "connected"]), 1), else_=0)).label('failed')
            ).first()
            
            # Format response
            by_reason = []
            for outcome in outcomes_by_reason:
                if outcome.outcome_reason:
                    by_reason.append({
                        "reason": outcome.outcome_reason,
                        "count": outcome.count
                    })
            
            return {
                "totals": {
                    "booked": totals_query.booked or 0,
                    "qualified": totals_query.qualified or 0,
                    "failed": totals_query.failed or 0
                },
                "by_reason": by_reason,
                "by_channel": [
                    {"channel": "mobile", "count": 0},  # TODO: Implement channel detection
                    {"channel": "landline", "count": 0}
                ],
                "filters": {
                    "campaign_id": campaign_id,
                    "agent_id": agent_id,
                    "lang": lang,
                    "country": country
                }
            }
            
        except Exception as e:
            logger.error(f"Error getting outcomes data: {e}")
            return {"totals": {"booked": 0, "qualified": 0, "failed": 0}, "by_reason": [], "by_channel": [], "filters": {}}
