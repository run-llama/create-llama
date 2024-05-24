import { useState } from "react";
import { Button } from "../button";
import FileUploader from "../file-uploader";
import { Input } from "../input";
import UploadCsvPreview from "../upload-csv-preview";
import UploadImagePreview from "../upload-image-preview";
import { ChatHandler } from "./chat.interface";

type UploadedCsv = {
  content: string;
  filename: string;
  filesize: number;
};

export default function ChatInput(
  props: Pick<
    ChatHandler,
    | "isLoading"
    | "input"
    | "onFileUpload"
    | "onFileError"
    | "handleSubmit"
    | "handleInputChange"
  > & {
    multiModal?: boolean;
  },
) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploadedCsv, setUploadedCsv] = useState<UploadedCsv>();

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    if (imageUrl) {
      props.handleSubmit(e, {
        data: { imageUrl: imageUrl },
      });
      setImageUrl(null);
      return;
    }
    if (uploadedCsv) {
      props.handleSubmit(e, {
        data: { csvContent: uploadedCsv.content },
      });
      setUploadedCsv(undefined);
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
    setUploadedCsv({
      content,
      filename: file.name,
      filesize: file.size,
    });
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
      {uploadedCsv && (
        <UploadCsvPreview
          filename={uploadedCsv.filename}
          filesize={uploadedCsv.filesize}
          onRemove={() => setUploadedCsv(undefined)}
        />
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
