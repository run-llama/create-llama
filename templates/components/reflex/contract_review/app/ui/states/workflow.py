from typing import Any, Dict, List, Optional

import reflex as rx
from pydantic import BaseModel

from app.services.contract_reviewer import LogEvent
from rxconfig import config as rx_config


class ContractLoaderState(rx.State):
    is_running: bool = False
    is_started: bool = False
    log: List[Dict[str, Any]] = []

    @rx.event
    async def add_log(self, log: LogEvent):
        if not self.is_started:
            yield ContractLoaderState.start
        self.log.append(log.model_dump())
        if "data saved" in log.msg:
            self.is_running = False

    def has_log(self):
        return len(self.log) > 0

    @rx.event
    def start(self):
        self.is_running = True
        self.is_started = True

    @rx.event
    def stop(self):
        self.is_running = False

    @rx.event
    def reset_state(self):
        self.is_running = False
        self.is_started = False
        self.log = []


class GuidelineState(rx.State):
    is_running: bool = False
    is_started: bool = False
    log: List[Dict[str, Any]] = []

    @rx.event
    def add_log(self, log: LogEvent):
        if not self.is_started:
            yield GuidelineState.start
        self.log.append(log.model_dump())
        if "Dispatched" in log.msg:
            yield GuidelineState.stop

    def has_log(self):
        return len(self.log) > 0

    @rx.event
    def reset_state(self):
        self.is_running = False
        self.is_started = False
        self.log = []

    @rx.event
    def start(self):
        self.is_running = True
        self.is_started = True

    @rx.event
    def stop(self):
        self.is_running = False


class GuidelineData(BaseModel):
    is_completed: bool
    is_compliant: Optional[bool]
    clause_text: Optional[str]
    output: Optional[Dict[str, Any]]


class GuidelineHandlerState(rx.State):
    is_completed: bool = False
    # Map of request_id to compliance check results
    data: Dict[str, GuidelineData] = {}

    def has_data(self):
        return len(self.data) > 0

    @rx.event
    def add_log(self, log: LogEvent):
        _id = log.data.get("request_id")
        if _id is None:
            return
        is_compliant = log.data.get("is_compliant", None)
        self.data[_id] = GuidelineData(
            is_completed=log.data.get("is_completed", False),
            is_compliant=is_compliant,
            clause_text=log.data.get("clause_text", None),
            output=log.data.get("output", {}),
        )

    @rx.event
    def reset_state(self):
        self.is_completed = False
        self.data = {}

    @rx.event
    def stop(self):
        self.is_completed = True


class ReportState(rx.State):
    is_started: bool = False
    is_completed: bool = False
    saved_path: str = ""

    @rx.var()
    def download_url(self) -> str:
        return f"{rx_config.api_url}/api/download/{self.saved_path}"

    @rx.event
    def add_log(self, log: LogEvent):
        if not self.is_started:
            self.is_started = True
        if log.data.get("is_completed"):
            self.is_completed = True
            self.saved_path = log.data.get("saved_path") or ""

    @rx.event
    def reset_state(self):
        self.is_started = False
        self.is_completed = False
        self.saved_path = ""
