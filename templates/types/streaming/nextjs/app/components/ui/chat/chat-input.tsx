import { Loader2 } from "lucide-react";
import { useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { Button } from "../button";
import FileUploader from "../file-uploader";
import { Input } from "../input";
import UploadCsvPreview from "../upload-csv-preview";
import UploadImagePreview from "../upload-image-preview";
import { ChatHandler } from "./chat.interface";
import { useCsv } from "./use-csv";

export default function ChatInput(
  props: Pick<
    ChatHandler,
    | "isLoading"
    | "input"
    | "onFileUpload"
    | "onFileError"
    | "handleSubmit"
    | "handleInputChange"
    | "messages"
  >,
) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const { files, uploadNew, removeFile, resetUploadedFiles } = useCsv(
    props.messages,
  );

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    if (imageUrl) {
      props.handleSubmit(e, {
        data: { imageUrl: imageUrl },
      });
      setImageUrl(null);
      return;
    }

    if (files.length > 0) {
      props.handleSubmit(e, {
        data: { csvFiles: files },
      });
      resetUploadedFiles();
      return;
    }

    props.handleSubmit(e);
  };

  const onRemovePreviewImage = () => setImageUrl(null);

  const handleUploadImageFile = async (file: File) => {
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
    setImageUrl(base64);
  };

  const handleUploadCsvFile = async (file: File) => {
    const content = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsText(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
    const isSuccess = uploadNew({
      id: uuidv4(),
      content,
      filename: file.name,
      filesize: file.size,
    });
    if (!isSuccess) {
      alert("File already exists in the list.");
    }
  };

  const handleUploadFile = async (file: File) => {
    try {
      if (file.type.startsWith("image/")) {
        return await handleUploadImageFile(file);
      }
      if (file.type === "text/csv") {
        return await handleUploadCsvFile(file);
      }
      props.onFileUpload?.(file);
    } catch (error: any) {
      props.onFileError?.(error.message);
    }
  };

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-xl bg-white p-4 shadow-xl space-y-4"
    >
      {imageUrl && (
        <UploadImagePreview url={imageUrl} onRemove={onRemovePreviewImage} />
      )}
      {files.length > 0 && (
        <div className="flex gap-4 w-full overflow-auto py-2">
          {props.isLoading ? (
            <div className="flex gap-2 items-center">
              <Loader2 className="h-4 w-4 animate-spin" />{" "}
              <span>Handling csv files...</span>
            </div>
          ) : (
            <>
              {files.map((csv) => {
                return (
                  <UploadCsvPreview
                    key={csv.id}
                    filename={csv.filename}
                    filesize={csv.filesize}
                    onRemove={() => removeFile(csv)}
                    isNew={csv.type === "new_upload"}
                  />
                );
              })}
            </>
          )}
        </div>
      )}
      <div className="flex w-full items-start justify-between gap-4 ">
        <Input
          autoFocus
          name="message"
          placeholder="Type a message"
          className="flex-1"
          value={props.input}
          onChange={props.handleInputChange}
        />
        <FileUploader
          onFileUpload={handleUploadFile}
          onFileError={props.onFileError}
        />
        <Button type="submit" disabled={props.isLoading}>
          Send message
        </Button>
      </div>
    </form>
  );
}
