import logging
import os
import uuid
from enum import Enum
from pathlib import Path
from typing import List

from app.config import (
    COMPLIANCE_REPORT_SYSTEM_PROMPT,
    COMPLIANCE_REPORT_USER_PROMPT,
    CONTRACT_EXTRACT_PROMPT,
    CONTRACT_MATCH_PROMPT,
)
from app.engine.index import get_index
from app.models import (
    ClauseComplianceCheck,
    ComplianceReport,
    ContractClause,
    ContractExtraction,
)
from llama_index.core import SimpleDirectoryReader
from llama_index.core.llms import LLM
from llama_index.core.prompts import ChatPromptTemplate
from llama_index.core.retrievers import BaseRetriever
from llama_index.core.settings import Settings
from llama_index.core.workflow import (
    Context,
    Event,
    StartEvent,
    StopEvent,
    Workflow,
    step,
)

logger = logging.getLogger(__name__)


def get_workflow():
    index = get_index()
    if index is None:
        raise RuntimeError(
            "Index not found! Please run `uv run generate` to populate an index first."
        )
    return ContractReviewWorkflow(
        guideline_retriever=index.as_retriever(),
        llm=Settings.llm,
        verbose=True,
        timeout=120,
    )


class Step(Enum):
    PARSE_CONTRACT = "parse_contract"
    ANALYZE_CLAUSES = "analyze_clauses"
    HANDLE_CLAUSE = "handle_clause"
    GENERATE_REPORT = "generate_report"


class ContractExtractionEvent(Event):
    contract_extraction: ContractExtraction


class MatchGuidelineEvent(Event):
    request_id: str
    clause: ContractClause
    vendor_name: str


class MatchGuidelineResultEvent(Event):
    result: ClauseComplianceCheck


class GenerateReportEvent(Event):
    match_results: List[ClauseComplianceCheck]


class LogEvent(Event):
    msg: str
    step: Step
    data: dict = {}
    is_step_completed: bool = False


class ContractReviewWorkflow(Workflow):
    """Contract review workflow."""

    def __init__(
        self,
        guideline_retriever: BaseRetriever,
        llm: LLM | None = None,
        similarity_top_k: int = 20,
        **kwargs,
    ) -> None:
        """Init params."""
        super().__init__(**kwargs)

        self.guideline_retriever = guideline_retriever

        self.llm = llm or Settings.llm
        self.similarity_top_k = similarity_top_k

        # if not exists, create
        out_path = Path("output") / "workflow_output"
        if not out_path.exists():
            out_path.mkdir(parents=True, exist_ok=True)
            os.chmod(str(out_path), 0o0777)
        self.output_dir = out_path

    @step
    async def parse_contract(
        self, ctx: Context, ev: StartEvent
    ) -> ContractExtractionEvent:
        """Parse the contract."""
        uploaded_contract_path = Path(ev.contract_path)
        contract_file_name = uploaded_contract_path.name
        # Set contract file name in context
        await ctx.set("contract_file_name", contract_file_name)

        # Parse and read the contract to documents
        docs = SimpleDirectoryReader(
            input_files=[str(uploaded_contract_path)]
        ).load_data()
        ctx.write_event_to_stream(
            LogEvent(
                msg=f"Loaded document: {contract_file_name}",
                step=Step.PARSE_CONTRACT,
                data={
                    "saved_path": str(uploaded_contract_path),
                    "parsed_data": None,
                },
            )
        )

        # Parse the contract into a structured model
        # See the ContractExtraction model for information we want to extract
        ctx.write_event_to_stream(
            LogEvent(
                msg="Extracting information from the document",
                step=Step.PARSE_CONTRACT,
                data={
                    "saved_path": str(uploaded_contract_path),
                    "parsed_data": None,
                },
            )
        )
        prompt = ChatPromptTemplate.from_messages([("user", CONTRACT_EXTRACT_PROMPT)])
        contract_extraction = await self.llm.astructured_predict(
            ContractExtraction,
            prompt,
            contract_data="\n".join(
                [d.get_content(metadata_mode="all") for d in docs]  # type: ignore
            ),
        )
        if not isinstance(contract_extraction, ContractExtraction):
            raise ValueError(f"Invalid extraction from contract: {contract_extraction}")

        # save output template to file
        contract_extraction_path = Path(f"{self.output_dir}/{contract_file_name}.json")
        with open(contract_extraction_path, "w") as fp:
            fp.write(contract_extraction.model_dump_json())

        ctx.write_event_to_stream(
            LogEvent(
                msg="Extracted successfully",
                step=Step.PARSE_CONTRACT,
                is_step_completed=True,
                data={
                    "saved_path": str(contract_extraction_path),
                    "parsed_data": contract_extraction.model_dump_json(),
                },
            )
        )

        return ContractExtractionEvent(contract_extraction=contract_extraction)

    @step
    async def dispatch_guideline_match(  # type: ignore
        self, ctx: Context, ev: ContractExtractionEvent
    ) -> MatchGuidelineEvent:
        """For each clause in the contract, find relevant guidelines.

        Use a map-reduce pattern, send each parsed clause as a MatchGuidelineEvent.
        """
        await ctx.set("num_clauses", len(ev.contract_extraction.clauses))
        await ctx.set("vendor_name", ev.contract_extraction.vendor_name)

        for clause in ev.contract_extraction.clauses:
            request_id = str(uuid.uuid4())
            ctx.send_event(
                MatchGuidelineEvent(
                    request_id=request_id,
                    clause=clause,
                    vendor_name=ev.contract_extraction.vendor_name or "Not identified",
                )
            )
        ctx.write_event_to_stream(
            LogEvent(
                msg=f"Created {len(ev.contract_extraction.clauses)} tasks for analyzing with the guidelines",
                step=Step.ANALYZE_CLAUSES,
            )
        )

    @step
    async def handle_guideline_match(
        self, ctx: Context, ev: MatchGuidelineEvent
    ) -> MatchGuidelineResultEvent:
        """Handle matching clause against guideline."""
        ctx.write_event_to_stream(
            LogEvent(
                msg=f"Handling clause for request {ev.request_id}",
                step=Step.HANDLE_CLAUSE,
                data={
                    "request_id": ev.request_id,
                    "clause_text": ev.clause.clause_text,
                    "is_compliant": None,
                },
            )
        )

        # retrieve matching guideline
        query = f"""\
Find the relevant guideline from {ev.vendor_name} that aligns with the following contract clause:

{ev.clause.clause_text}
"""
        guideline_docs = self.guideline_retriever.retrieve(query)
        guideline_text = "\n\n".join([g.get_content() for g in guideline_docs])

        # extract compliance from contract into a structured model
        # see ClauseComplianceCheck model for the schema
        prompt = ChatPromptTemplate.from_messages([("user", CONTRACT_MATCH_PROMPT)])
        compliance_output = await self.llm.astructured_predict(
            ClauseComplianceCheck,
            prompt,
            clause_text=ev.clause.model_dump_json(),
            guideline_text=guideline_text,
        )

        if not isinstance(compliance_output, ClauseComplianceCheck):
            raise ValueError(f"Invalid compliance check: {compliance_output}")

        ctx.write_event_to_stream(
            LogEvent(
                msg=f"Completed compliance check for request {ev.request_id}",
                step=Step.HANDLE_CLAUSE,
                is_step_completed=True,
                data={
                    "request_id": ev.request_id,
                    "clause_text": ev.clause.clause_text,
                    "is_compliant": compliance_output.compliant,
                    "result": compliance_output,
                },
            )
        )

        return MatchGuidelineResultEvent(result=compliance_output)

    @step
    async def gather_guideline_match(
        self, ctx: Context, ev: MatchGuidelineResultEvent
    ) -> GenerateReportEvent | None:
        """Handle matching clause against guideline."""
        num_clauses = await ctx.get("num_clauses")
        events = ctx.collect_events(ev, [MatchGuidelineResultEvent] * num_clauses)
        if events is None:
            return None

        match_results = [e.result for e in events]
        # save match results
        contract_file_name = await ctx.get("contract_file_name")
        match_results_path = Path(
            f"{self.output_dir}/match_results_{contract_file_name}.jsonl"
        )
        with open(match_results_path, "w") as fp:
            for mr in match_results:
                fp.write(mr.model_dump_json() + "\n")

        ctx.write_event_to_stream(
            LogEvent(
                msg=f"Processed {len(match_results)} clauses",
                step=Step.ANALYZE_CLAUSES,
                is_step_completed=True,
                data={"saved_path": str(match_results_path)},
            )
        )
        return GenerateReportEvent(match_results=[e.result for e in events])

    @step
    async def generate_output(self, ctx: Context, ev: GenerateReportEvent) -> StopEvent:
        ctx.write_event_to_stream(
            LogEvent(
                msg="Generating Compliance Report",
                step=Step.GENERATE_REPORT,
                data={"is_completed": False},
            )
        )

        # if all clauses are compliant, return a compliant result
        non_compliant_results = [r for r in ev.match_results if not r.compliant]

        # generate compliance results string
        result_tmpl = """
1. **Clause**: {clause}
2. **Guideline:** {guideline}
3. **Compliance Status:** {compliance_status}
4. **Notes:** {notes}
"""
        non_compliant_strings = []
        for nr in non_compliant_results:
            non_compliant_strings.append(
                result_tmpl.format(
                    clause=nr.clause_text,
                    guideline=nr.matched_guideline.guideline_text
                    if nr.matched_guideline is not None
                    else "No relevant guideline found",
                    compliance_status=nr.compliant,
                    notes=nr.notes,
                )
            )
        non_compliant_str = "\n\n".join(non_compliant_strings)

        prompt = ChatPromptTemplate.from_messages(
            [
                ("system", COMPLIANCE_REPORT_SYSTEM_PROMPT),
                ("user", COMPLIANCE_REPORT_USER_PROMPT),
            ]
        )
        compliance_report = await self.llm.astructured_predict(
            ComplianceReport,
            prompt,
            compliance_results=non_compliant_str,
            vendor_name=await ctx.get("vendor_name"),
        )

        # Save compliance report to file
        contract_file_name = await ctx.get("contract_file_name")
        compliance_report_path = Path(
            f"{self.output_dir}/report_{contract_file_name}.json"
        )
        with open(compliance_report_path, "w") as fp:
            fp.write(compliance_report.model_dump_json())

        ctx.write_event_to_stream(
            LogEvent(
                msg=f"Compliance report saved to {compliance_report_path}",
                step=Step.GENERATE_REPORT,
                is_step_completed=True,
                data={
                    "saved_path": str(compliance_report_path),
                    "result": compliance_report,
                },
            )
        )

        return StopEvent(
            result={
                "report": compliance_report,
                "non_compliant_results": non_compliant_results,
            }
        )
