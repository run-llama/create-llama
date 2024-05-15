const STORAGE_FOLDER = "data";

export const getFileDataUrl = (filePath: string) => {
  if (filePath.startsWith("http")) return filePath;
  const filename = filePath.split("\\").pop();
  const isUsingBackend = !!process.env.NEXT_PUBLIC_CHAT_API;
  const fileUrl = `/api/${STORAGE_FOLDER}/${filename}`;
  if (isUsingBackend) {
    const backendOrigin = new URL(process.env.NEXT_PUBLIC_CHAT_API!).origin;
    return `${backendOrigin}/${fileUrl}`;
  }
  return fileUrl;
};
