"""
Shadow Analytics Service for Gamma
Compares real vs mock data without exposing it to users
"""

import logging
import random
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import and_, func, desc

from models import CallDailyAggregate, CallRecord
from config.settings import settings

logger = logging.getLogger(__name__)


class ShadowAnalyticsService:
    """Service for shadow mode analytics comparison"""
    
    def __init__(self, db: Session):
        self.db = db
        self.enabled = settings.ANALYTICS_GAMMA
        
    async def compare_mock_vs_real_async(self, workspace_id: str, days: int = 30,
                                       campaign_id: Optional[str] = None, 
                                       agent_id: Optional[str] = None,
                                       lang: Optional[str] = None,
                                       country: Optional[str] = None) -> Dict[str, Any]:
        """Compare mock data with real data (shadow mode) - async with timeout"""
        if not self.enabled:
            return {
                "ok": False,
                "mode": "off",
                "message": "Gamma analytics not enabled"
            }
            
        try:
            import asyncio
            
            # Calculate window
            end_date = datetime.utcnow()
            start_date = end_date - timedelta(days=days)
            
            # Run real data fetch with timeout (1500ms)
            try:
                real_task = asyncio.create_task(
                    asyncio.to_thread(self._get_real_analytics, workspace_id, days, campaign_id, agent_id, lang, country)
                )
                real_data = await asyncio.wait_for(real_task, timeout=1.5)
            except asyncio.TimeoutError:
                logger.warning(f"Real data fetch timeout for workspace {workspace_id}")
                real_data = None
            
            # Mock data is always available (no timeout needed)
            mock_data = self._get_mock_analytics(days, campaign_id, agent_id, lang, country)
            
            # Calculate deltas and stability
            if real_data:
                deltas = self._calculate_deltas_standardized(real_data, mock_data)
                stability_score = deltas.get("stability_score", 0.0)
                is_stable = stability_score >= 0.80
            else:
                deltas = self._calculate_deltas_standardized(None, mock_data)
                stability_score = 0.0
                is_stable = False
            
            # Build standardized response
            response = {
                "ok": True,
                "mode": "shadow",
                "window": {
                    "from": start_date.isoformat(),
                    "to": end_date.isoformat()
                },
                "stability_score": stability_score,
                "deltas": deltas,
                "samples": {
                    "real": {
                        "n": real_data.get("total_samples", 0) if real_data else 0,
                        "period_days": days
                    },
                    "mock": {
                        "n": mock_data.get("total_samples", 0),
                        "seed": self._get_deterministic_seed(days, campaign_id, agent_id, lang, country)
                    }
                },
                "notes": self._generate_notes(deltas, stability_score),
                "timestamp": datetime.utcnow().isoformat()
            }
            
            return response
            
        except Exception as e:
            logger.error(f"Error in shadow analytics comparison: {e}")
            return {
                "ok": False,
                "mode": "error",
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat()
            }
    
    def _get_real_analytics(self, workspace_id: str, days: int,
                           campaign_id: Optional[str] = None,
                           agent_id: Optional[str] = None) -> Dict[str, Any]:
        """Get real analytics data from database"""
        try:
            # Calculate date range
            end_date = datetime.utcnow()
            start_date = end_date - timedelta(days=days)
            
            # Base query for daily aggregates
            query = self.db.query(CallDailyAggregate).filter(
                and_(
                    CallDailyAggregate.workspace_id == workspace_id,
                    CallDailyAggregate.date >= start_date.date(),
                    CallDailyAggregate.date <= end_date.date()
                )
            )
            
            # Apply filters
            if campaign_id:
                query = query.filter(CallDailyAggregate.campaign_id == campaign_id)
            if agent_id:
                query = query.filter(CallDailyAggregate.agent_id == agent_id)
            
            # Get aggregates
            aggregates = query.all()
            
            if not aggregates:
                return self._empty_real_data()
            
            # Calculate totals
            total_reached = sum(agg.reached for agg in aggregates)
            total_connected = sum(agg.connected for agg in aggregates)
            total_qualified = sum(agg.qualified for agg in aggregates)
            total_booked = sum(agg.booked for agg in aggregates)
            total_duration = sum(agg.total_duration_sec for agg in aggregates)
            total_cost = sum(agg.total_cost_cents for agg in aggregates)
            
            # Calculate rates
            qualified_rate = total_qualified / total_reached if total_reached > 0 else 0
            connected_rate = total_connected / total_reached if total_reached > 0 else 0
            booked_rate = total_booked / total_qualified if total_qualified > 0 else 0
            
            # Get daily series
            daily_series = []
            for agg in aggregates:
                daily_series.append({
                    "date": agg.date.isoformat(),
                    "reached": agg.reached,
                    "connected": agg.connected,
                    "qualified": agg.qualified,
                    "booked": agg.booked,
                    "duration_sec": agg.total_duration_sec,
                    "cost_cents": agg.total_cost_cents
                })
            
            # Sort by date
            daily_series.sort(key=lambda x: x["date"])
            
            return {
                "funnel": {
                    "reached": total_reached,
                    "connected": total_connected,
                    "qualified": total_qualified,
                    "booked": total_booked
                },
                "rates": {
                    "qualified_rate": qualified_rate,
                    "connected_rate": connected_rate,
                    "booked_rate": booked_rate
                },
                "metrics": {
                    "total_duration_sec": total_duration,
                    "total_cost_cents": total_cost,
                    "avg_duration_sec": total_duration / total_reached if total_reached > 0 else 0,
                    "avg_cost_cents": total_cost / total_reached if total_reached > 0 else 0
                },
                "daily_series": daily_series,
                "data_source": "real"
            }
            
        except Exception as e:
            logger.error(f"Error getting real analytics: {e}")
            return self._empty_real_data()
    
    def _get_mock_analytics(self, days: int, campaign_id: Optional[str] = None,
                           agent_id: Optional[str] = None, lang: Optional[str] = None,
                           country: Optional[str] = None) -> Dict[str, Any]:
        """Get mock analytics data (same logic as main.py)"""
        try:
            # Use deterministic seed based on parameters
            seed_base = f"shadow:{days}:{campaign_id or 'all'}:{agent_id or 'all'}:{lang or 'all'}:{country or 'all'}"
            random.seed(hash(seed_base) % 2**32)
            
            # Generate mock data similar to main.py
            base_reached = 100 + (days * 3)
            base_connected = int(base_reached * 0.7)
            base_qualified = int(base_connected * 0.5)
            base_booked = int(base_qualified * 0.4)
            
            # Add some variance
            reached = base_reached + random.randint(-20, 20)
            connected = int(reached * (0.65 + random.uniform(-0.1, 0.1)))
            qualified = int(connected * (0.45 + random.uniform(-0.15, 0.15)))
            booked = int(qualified * (0.35 + random.uniform(-0.2, 0.2)))
            
            # Generate daily series
            daily_series = []
            for i in range(days):
                date = (datetime.utcnow() - timedelta(days=days-1-i)).date()
                
                # Add weekend effect
                weekend_factor = 0.3 if date.weekday() >= 5 else 1.0
                
                day_reached = max(1, int((reached / days) * weekend_factor * random.uniform(0.8, 1.2)))
                day_connected = int(day_reached * (connected / reached) * random.uniform(0.9, 1.1))
                day_qualified = int(day_connected * (qualified / connected) * random.uniform(0.8, 1.2))
                day_booked = int(day_qualified * (booked / qualified) * random.uniform(0.7, 1.3))
                
                daily_series.append({
                    "date": date.isoformat(),
                    "reached": day_reached,
                    "connected": day_connected,
                    "qualified": day_qualified,
                    "booked": day_booked,
                    "duration_sec": day_connected * random.randint(90, 180),
                    "cost_cents": day_reached * random.randint(15, 25)
                })
            
            return {
                "funnel": {
                    "reached": reached,
                    "connected": connected,
                    "qualified": qualified,
                    "booked": booked
                },
                "rates": {
                    "qualified_rate": qualified / reached if reached > 0 else 0,
                    "connected_rate": connected / reached if reached > 0 else 0,
                    "booked_rate": booked / qualified if qualified > 0 else 0
                },
                "metrics": {
                    "total_duration_sec": sum(d["duration_sec"] for d in daily_series),
                    "total_cost_cents": sum(d["cost_cents"] for d in daily_series),
                    "avg_duration_sec": sum(d["duration_sec"] for d in daily_series) / reached if reached > 0 else 0,
                    "avg_cost_cents": sum(d["cost_cents"] for d in daily_series) / reached if reached > 0 else 0
                },
                "daily_series": daily_series,
                "data_source": "mock",
                "total_samples": reached
            }
            
        except Exception as e:
            logger.error(f"Error generating mock analytics: {e}")
            return self._empty_mock_data()
    
    def _calculate_deltas(self, real_data: Dict[str, Any], 
                         mock_data: Dict[str, Any]) -> Dict[str, Any]:
        """Calculate percentage deltas between real and mock data"""
        try:
            deltas = {}
            
            # Funnel deltas
            for key in ["reached", "connected", "qualified", "booked"]:
                real_val = real_data.get("funnel", {}).get(key, 0)
                mock_val = mock_data.get("funnel", {}).get(key, 0)
                
                if mock_val > 0:
                    delta_pct = abs(real_val - mock_val) / mock_val * 100
                    deltas[f"funnel_{key}"] = {
                        "real": real_val,
                        "mock": mock_val,
                        "delta_pct": round(delta_pct, 2),
                        "within_threshold": delta_pct < 5.0
                    }
                else:
                    deltas[f"funnel_{key}"] = {
                        "real": real_val,
                        "mock": mock_val,
                        "delta_pct": 0.0,
                        "within_threshold": True
                    }
            
            # Rate deltas
            for key in ["qualified_rate", "connected_rate", "booked_rate"]:
                real_val = real_data.get("rates", {}).get(key, 0)
                mock_val = mock_data.get("rates", {}).get(key, 0)
                
                if mock_val > 0:
                    delta_pct = abs(real_val - mock_val) / mock_val * 100
                    deltas[f"rate_{key}"] = {
                        "real": real_val,
                        "mock": mock_val,
                        "delta_pct": round(delta_pct, 2),
                        "within_threshold": delta_pct < 5.0
                    }
                else:
                    deltas[f"rate_{key}"] = {
                        "real": real_val,
                        "mock": mock_val,
                        "delta_pct": 0.0,
                        "within_threshold": True
                    }
            
            # Overall stability score
            total_deltas = len(deltas)
            stable_deltas = sum(1 for d in deltas.values() if d.get("within_threshold", False))
            stability_score = (stable_deltas / total_deltas * 100) if total_deltas > 0 else 100
            
            deltas["overall"] = {
                "stability_score": round(stability_score, 2),
                "is_stable": stability_score >= 80.0,
                "total_metrics": total_deltas,
                "stable_metrics": stable_deltas
            }
            
            return deltas
            
        except Exception as e:
            logger.error(f"Error calculating deltas: {e}")
            return {"error": str(e)}
    
    def _check_stability(self, deltas: Dict[str, Any]) -> bool:
        """Check if data is stable enough for rollout"""
        try:
            overall = deltas.get("overall", {})
            return overall.get("is_stable", False)
        except Exception as e:
            logger.error(f"Error checking stability: {e}")
            return False
    
    def _empty_real_data(self) -> Dict[str, Any]:
        """Return empty real data structure"""
        return {
            "funnel": {"reached": 0, "connected": 0, "qualified": 0, "booked": 0},
            "rates": {"qualified_rate": 0, "connected_rate": 0, "booked_rate": 0},
            "metrics": {"total_duration_sec": 0, "total_cost_cents": 0, "avg_duration_sec": 0, "avg_cost_cents": 0},
            "daily_series": [],
            "data_source": "real"
        }
    
    def _empty_mock_data(self) -> Dict[str, Any]:
        """Return empty mock data structure"""
        return {
            "funnel": {"reached": 0, "connected": 0, "qualified": 0, "booked": 0},
            "rates": {"qualified_rate": 0, "connected_rate": 0, "booked_rate": 0},
            "metrics": {"total_duration_sec": 0, "total_cost_cents": 0, "avg_duration_sec": 0, "avg_cost_cents": 0},
            "daily_series": [],
            "data_source": "mock"
        }
    
    def get_stability_history(self, workspace_id: str, days: int = 7) -> List[Dict[str, Any]]:
        """Get stability history for the last N days"""
        if not self.enabled:
            return []
            
        try:
            # This would typically query a stability_logs table
            # For now, return empty list
            return []
            
        except Exception as e:
            logger.error(f"Error getting stability history: {e}")
            return []
    
    def log_stability_check(self, workspace_id: str, comparison_result: Dict[str, Any]) -> bool:
        """Log stability check result for tracking"""
        if not self.enabled:
            return False
            
        try:
            # This would typically log to a stability_logs table
            # For now, just log to console
            logger.info(f"Stability check for workspace {workspace_id}: {comparison_result.get('stability_score', 0)}")
            return True
            
        except Exception as e:
            logger.error(f"Error logging stability check: {e}")
            return False
    
    def _calculate_deltas_standardized(self, real_data: Dict[str, Any], 
                                     mock_data: Dict[str, Any]) -> Dict[str, Any]:
        """Calculate standardized deltas (decimal format)"""
        try:
            if not real_data:
                # Return mock-only data when real data unavailable
                return {
                    "funnel": {"reached": 0.0, "connected": 0.0, "qualified": 0.0, "booked": 0.0},
                    "geo_top5": [],
                    "cost_series_ma7": 0.0,
                    "stability_score": 0.0
                }
            
            deltas = {}
            
            # Funnel deltas (as decimals)
            for key in ["reached", "connected", "qualified", "booked"]:
                real_val = real_data.get("funnel", {}).get(key, 0)
                mock_val = mock_data.get("funnel", {}).get(key, 0)
                
                if mock_val > 0:
                    delta_decimal = abs(real_val - mock_val) / mock_val
                    deltas[key] = round(delta_decimal, 3)  # 0.031 = 3.1%
                else:
                    deltas[key] = 0.0
            
            # Geo top 5 (simplified for now)
            deltas["geo_top5"] = [
                {"iso2": "IT", "delta": round(random.uniform(0.01, 0.05), 3)},
                {"iso2": "US", "delta": round(random.uniform(-0.01, 0.03), 3)}
            ]
            
            # Cost series moving average
            real_cost = real_data.get("metrics", {}).get("total_cost_cents", 0)
            mock_cost = mock_data.get("metrics", {}).get("total_cost_cents", 0)
            if mock_cost > 0:
                deltas["cost_series_ma7"] = round(abs(real_cost - mock_cost) / mock_cost, 3)
            else:
                deltas["cost_series_ma7"] = 0.0
            
            # Overall stability score (decimal)
            funnel_deltas = [deltas.get(key, 0.0) for key in ["reached", "connected", "qualified", "booked"]]
            avg_delta = sum(funnel_deltas) / len(funnel_deltas) if funnel_deltas else 0.0
            
            # Convert to stability score (0.0 = perfect, 1.0 = terrible)
            stability_score = max(0.0, 1.0 - (avg_delta * 10))  # Scale factor
            deltas["stability_score"] = round(stability_score, 3)
            
            return deltas
            
        except Exception as e:
            logger.error(f"Error calculating standardized deltas: {e}")
            return {
                "funnel": {"reached": 0.0, "connected": 0.0, "qualified": 0.0, "booked": 0.0},
                "geo_top5": [],
                "cost_series_ma7": 0.0,
                "stability_score": 0.0
            }
    
    def _get_deterministic_seed(self, days: int, campaign_id: Optional[str] = None,
                               agent_id: Optional[str] = None, lang: Optional[str] = None,
                               country: Optional[str] = None) -> int:
        """Generate deterministic seed for consistent mock data"""
        seed_base = f"{days}:{campaign_id or 'all'}:{agent_id or 'all'}:{lang or 'all'}:{country or 'all'}"
        return hash(seed_base) % 1000000  # 6-digit seed
    
    def _generate_notes(self, deltas: Dict[str, Any], stability_score: float) -> List[str]:
        """Generate human-readable notes about stability"""
        notes = []
        
        if stability_score >= 0.85:
            notes.append("Excellent stability - ready for production rollout")
        elif stability_score >= 0.80:
            notes.append("Good stability - monitor for consistency")
        elif stability_score >= 0.70:
            notes.append("Moderate variance - investigate data sources")
        else:
            notes.append("High variance - real data may be unreliable")
        
        # Add specific notes about deltas
        funnel_deltas = [deltas.get(key, 0.0) for key in ["reached", "connected", "qualified", "booked"]]
        max_delta = max(funnel_deltas) if funnel_deltas else 0.0
        
        if max_delta < 0.05:
            notes.append("All funnel deltas < 5%")
        elif max_delta < 0.10:
            notes.append("Most funnel deltas < 10%")
        else:
            notes.append(f"Some funnel deltas > 10% (max: {max_delta:.1%})")
        
        return notes
