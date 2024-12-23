from typing import List, Optional

from pydantic import BaseModel, Field


class ContractClause(BaseModel):
    clause_text: str = Field(..., description="The exact text of the clause.")
    mentions_data_processing: bool = Field(
        False,
        description="True if the clause involves personal data collection or usage.",
    )
    mentions_data_transfer: bool = Field(
        False,
        description="True if the clause involves transferring personal data, especially to third parties or across borders.",
    )
    requires_consent: bool = Field(
        False,
        description="True if the clause explicitly states that user consent is needed for data activities.",
    )
    specifies_purpose: bool = Field(
        False,
        description="True if the clause specifies a clear purpose for data handling or transfer.",
    )
    mentions_safeguards: bool = Field(
        False,
        description="True if the clause mentions security measures or other safeguards for data.",
    )


class ContractExtraction(BaseModel):
    vendor_name: Optional[str] = Field(
        None, description="The vendor's name if identifiable."
    )
    effective_date: Optional[str] = Field(
        None, description="The effective date of the agreement, if available."
    )
    governing_law: Optional[str] = Field(
        None, description="The governing law of the contract, if stated."
    )
    clauses: List[ContractClause] = Field(
        ..., description="List of extracted clauses and their relevant indicators."
    )


class GuidelineMatch(BaseModel):
    guideline_text: str = Field(
        ...,
        description="The single most relevant guideline excerpt related to this clause.",
    )
    similarity_score: float = Field(
        ...,
        description="Similarity score indicating how closely the guideline matches the clause, e.g., between 0 and 1.",
    )
    relevance_explanation: Optional[str] = Field(
        None, description="Brief explanation of why this guideline is relevant."
    )


class ClauseComplianceCheck(BaseModel):
    clause_text: str = Field(
        ..., description="The exact text of the clause from the contract."
    )
    matched_guideline: Optional[GuidelineMatch] = Field(
        None, description="The most relevant guideline extracted via vector retrieval."
    )
    compliant: bool = Field(
        ...,
        description="Indicates whether the clause is considered compliant with the referenced guideline.",
    )
    notes: Optional[str] = Field(
        None, description="Additional commentary or recommendations."
    )


class ComplianceReport(BaseModel):
    vendor_name: Optional[str] = Field(
        None, description="The vendor's name if identified from the contract."
    )
    overall_compliant: bool = Field(
        ..., description="Indicates if the contract is considered overall compliant."
    )
    summary_notes: Optional[str] = Field(
        None,
        description="General summary or recommendations for achieving full compliance.",
    )
