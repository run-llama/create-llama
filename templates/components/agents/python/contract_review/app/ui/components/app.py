import os
from typing import List, Optional

import reflex as rx

from app.config import UPLOADED_DIR
from app.services.contract_reviewer import LogEvent, Step, get_workflow
from app.ui.components.shared import card_component
from app.ui.states.workflow import (
    ContractLoaderState,
    GuidelineHandlerState,
    GuidelineState,
    ReportState,
)


class UploadedFile(rx.Base):
    file_name: str
    size: int


class AppState(rx.State):
    """
    Whole main state for the app.
    Handle for file upload, trigger workflow and produce workflow events.
    """

    uploaded_file: Optional[UploadedFile] = None

    @rx.event
    async def handle_upload(self, files: List[rx.UploadFile]):
        if len(files) > 1:
            yield rx.toast.error(
                "You can only upload one file at a time", position="top-center"
            )
        else:
            try:
                file = files[0]
                upload_data = await file.read()
                outfile = os.path.join(UPLOADED_DIR, file.filename)
                with open(outfile, "wb") as f:
                    f.write(upload_data)
                self.uploaded_file = UploadedFile(
                    file_name=file.filename, size=len(upload_data)
                )
                yield rx.toast.success(
                    "File uploaded successfully", position="top-center"
                )
                yield AppState.reset_workflow
                yield AppState.trigger_workflow
            except Exception as e:
                yield rx.toast.error(str(e), position="top-center")

    @rx.event
    def reset_workflow(self):
        yield ContractLoaderState.reset_state
        yield GuidelineState.reset_state
        yield GuidelineHandlerState.reset_state
        yield ReportState.reset_state

    @rx.event(background=True)
    async def trigger_workflow(self):
        """
        Trigger backend to start reviewing the contract in a loop.
        Get the event from the loop and update the state.
        """
        if self.uploaded_file is None:
            yield rx.toast.error("No file uploaded", position="top-center")
        else:
            uploaded_file_path = os.path.join(
                UPLOADED_DIR, self.uploaded_file.file_name
            )

            try:
                workflow = get_workflow()
                handler = workflow.run(
                    contract_path=uploaded_file_path,
                )
                async for event in handler.stream_events():
                    if isinstance(event, LogEvent):
                        match event.step:
                            case Step.PARSE_CONTRACT:
                                yield ContractLoaderState.add_log(event)
                            case Step.DISPATCH_GUIDELINE_MATCH:
                                yield ContractLoaderState.stop
                                yield GuidelineState.add_log(event)
                            case Step.HANDLE_GUIDELINE_MATCH:
                                yield GuidelineState.stop
                                yield GuidelineHandlerState.add_log(event)
                            case Step.GENERATE_REPORT:
                                yield GuidelineHandlerState.stop
                                yield ReportState.add_log(event)
            except Exception as e:
                yield rx.toast.error(str(e), position="top-center")


def upload_component() -> rx.Component:
    return card_component(
        title="Upload",
        children=rx.container(
            rx.vstack(
                rx.upload(
                    rx.vstack(
                        rx.text("Drag and drop files here or click to select files"),
                    ),
                    on_drop=AppState.handle_upload(
                        rx.upload_files(upload_id="upload1")
                    ),
                    id="upload1",
                    border="1px dotted rgb(107,99,246)",
                    padding="1rem",
                ),
                rx.cond(
                    AppState.uploaded_file != None,  # type: ignore
                    rx.text(AppState.uploaded_file.file_name),  # type: ignore
                    rx.text("No file uploaded"),
                ),
            ),
        ),
    )
