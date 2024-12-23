import os
from typing import List

import reflex as rx

from app.engine.generate import generate_datasource


class UploadedFile(rx.Base):
    file_name: str
    size: int


class UploadedFilesState(rx.State):
    _uploaded_dir = "data"
    uploaded_files: List[UploadedFile] = []

    async def handle_upload(self, files: list[rx.UploadFile]):
        for file in files:
            upload_data = await file.read()
            outfile = os.path.join(self._uploaded_dir, file.filename)
            with open(outfile, "wb") as f:
                f.write(upload_data)

            new_file = UploadedFile(file_name=file.filename, size=len(upload_data))

            self.uploaded_files.append(new_file)

            # Run indexing
            try:
                generate_datasource()
            except Exception as e:
                print("Error generating datasource", e)
                os.remove(outfile)
                self.uploaded_files.remove(new_file)
                return rx.toast.error(
                    f"Error generating index for the uploaded files. {str(e)}",
                    position="top-center",
                )

        return rx.toast.success("Files uploaded successfully", position="top-center")

    def has_files(self) -> bool:
        return len(self.uploaded_files) > 0

    def load_files(self):
        self.uploaded_files = []
        for file in os.listdir(self._uploaded_dir):
            file_path = os.path.join(self._uploaded_dir, file)
            if os.path.isfile(file_path):
                self.uploaded_files.append(
                    UploadedFile(file_name=file, size=os.path.getsize(file_path))
                )

    def remove_file(self, file_name: str):
        for file in self.uploaded_files:
            if file.file_name == file_name:
                self.uploaded_files.remove(file)
                os.remove(os.path.join(self._uploaded_dir, file_name))
                # Run indexing
                generate_datasource()
                break


def upload_component() -> rx.Component:
    return rx.vstack(
        rx.heading("Upload", size="5"),
        rx.upload(
            rx.vstack(
                rx.text("Drag and drop files here or click to select files"),
            ),
            on_drop=UploadedFilesState.handle_upload(
                rx.upload_files(upload_id="upload1")
            ),
            id="upload1",
            border="1px dotted rgb(107,99,246)",
        ),
        rx.foreach(
            UploadedFilesState.uploaded_files,
            lambda file: rx.card(
                rx.stack(
                    rx.text(file.file_name, size="2"),
                    rx.button(
                        "x",
                        size="2",
                        on_click=UploadedFilesState.remove_file(file.file_name),
                    ),
                    justify="between",
                    width="100%",
                ),
                width="100%",
            ),
        ),
        width="100%",
    )
