import { JSONValue } from "ai";
import { v4 as uuidv4 } from "uuid";
import { Button } from "../button";
import { DocumentPreview } from "../document-preview";
import FileUploader from "../file-uploader";
import { Input } from "../input";
import UploadImagePreview from "../upload-image-preview";
import { ChatHandler } from "./chat.interface";
import { useFile } from "./hooks/use-file";

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
    | "setInput"
    | "append"
  >,
) {
  const {
    imageUrl,
    setImageUrl,
    files,
    upload,
    remove,
    reset,
    uploadPdf,
    getAnnotations,
    alreadyUploaded,
  } = useFile();

  // default submit function does not handle including annotations in the message
  // so we need to use append function to submit new message with annotations
  const handleSubmitWithAnnotations = (
    e: React.FormEvent<HTMLFormElement>,
    annotations: JSONValue[] | undefined,
  ) => {
    e.preventDefault();
    props.append!({
      content: props.input,
      role: "user",
      createdAt: new Date(),
      annotations,
    });
    props.setInput!("");
  };

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    const annotations = getAnnotations();
    if (annotations.length) {
      handleSubmitWithAnnotations(e, annotations);
      return reset();
    }
    props.handleSubmit(e);
  };

  const readContent = async (file: File): Promise<string> => {
    const content = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      if (file.type.startsWith("image/") || file.type === "application/pdf") {
        reader.readAsDataURL(file);
      } else {
        reader.readAsText(file);
      }
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
    return content;
  };

  const handleUploadImageFile = async (file: File) => {
    const base64 = await readContent(file);
    setImageUrl(base64);
  };

  const handleUploadCsvFile = async (file: File) => {
    const content = await readContent(file);
    const isSuccess = upload({
      id: uuidv4(),
      content,
      filename: file.name,
      filesize: file.size,
      filetype: "csv",
    });
    if (!isSuccess) {
      alert("File already exists in the list.");
    }
  };

  const handleUploadPdfFile = async (file: File) => {
    const base64 = await readContent(file);
    await uploadPdf({
      id: uuidv4(),
      filename: file.name,
      filesize: file.size,
      pdfBase64: base64,
    });
  };

  const handleUploadFile = async (file: File) => {
    if (alreadyUploaded) {
      alert("You can only upload one file at a time.");
      return;
    }
    try {
      if (file.type.startsWith("image/")) {
        return await handleUploadImageFile(file);
      }
      if (file.type === "text/csv") {
        return await handleUploadCsvFile(file);
      }
      if (file.type === "application/pdf") {
        return await handleUploadPdfFile(file);
      }
      props.onFileUpload?.(file);
    } catch (error: any) {
      props.onFileError?.(error.message);
    }
  };

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-xl bg-white p-4 shadow-xl space-y-4 shrink-0"
    >
      {imageUrl && (
        <UploadImagePreview url={imageUrl} onRemove={() => setImageUrl(null)} />
      )}
      {files.length > 0 && (
        <div className="flex gap-4 w-full overflow-auto py-2">
          {files.map((file) => (
            <DocumentPreview
              key={file.id}
              file={file}
              onRemove={() => remove(file)}
            />
          ))}
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
        <Button type="submit" disabled={props.isLoading || !props.input.trim()}>
          Send message
        </Button>
      </div>
    </form>
  );
}
