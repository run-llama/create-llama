DATA_DIR = "data"
UPLOADED_DIR = "output/uploaded"

# Workflow prompts
CONTRACT_EXTRACT_PROMPT = """\
You are given contract data below. \
Please extract out relevant information from the contract into the defined schema - the schema is defined as a function call.\

{contract_data}
"""

CONTRACT_MATCH_PROMPT = """\
Given the following contract clause and the corresponding relevant guideline text, evaluate the compliance \
and provide a JSON object that matches the ClauseComplianceCheck schema.

**Contract Clause:**
{clause_text}

**Matched Guideline Text(s):**
{guideline_text}
"""


COMPLIANCE_REPORT_SYSTEM_PROMPT = """\
You are a compliance reporting assistant. Your task is to generate a final compliance report \
based on the results of clause compliance checks against \
a given set of guidelines. 

Analyze the provided compliance results and produce a structured report according to the specified schema. 
Ensure that if there are no noncompliant clauses, the report clearly indicates full compliance.
"""

COMPLIANCE_REPORT_USER_PROMPT = """\
A set of clauses within a contract were checked against GDPR compliance guidelines for the following vendor: {vendor_name}. 
The set of noncompliant clauses are given below.

Each section includes:
- **Clause:** The exact text of the contract clause.
- **Guideline:** The relevant GDPR guideline text.
- **Compliance Status:** Should be `False` for noncompliant clauses.
- **Notes:** Additional information or explanations.

{compliance_results}

Based on the above compliance results, generate a final compliance report following the `ComplianceReport` schema below. 
If there are no noncompliant clauses, the report should indicate that the contract is fully compliant.
"""
