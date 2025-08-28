from pydantic import BaseModel, Field
from typing import List, Dict, Optional

class ComplianceRequirements(BaseModel):
    country: str
    number_type: str
    entity_type: str
    documents: List[str] = []
    notes: Optional[str] = None

class ComplianceCreate(BaseModel):
    provider: str
    country: str
    number_type: str
    entity_type: str
    provided_fields: Dict = Field(default_factory=dict)

class ComplianceUploadAck(BaseModel):
    file_name: str
    kind: str
    size: int
    mime: str

class ComplianceSubmission(BaseModel):
    id: str
    status: str
    provider: str
    country: str
    number_type: str
    entity_type: str
    required_fields: Dict
    provided_fields: Dict
    files: List[Dict]
    notes: Optional[str] = None
    created_at: str
    updated_at: str
