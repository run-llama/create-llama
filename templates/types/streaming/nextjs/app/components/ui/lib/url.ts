const staticFileAPI = "/api/files";

export const getStaticFileDataUrl = (filePath: string) => {
  const isUsingBackend = !!process.env.NEXT_PUBLIC_CHAT_API;
  const fileUrl = `${staticFileAPI}/${filePath}`;
  if (isUsingBackend) {
    const backendOrigin = new URL(process.env.NEXT_PUBLIC_CHAT_API!).origin;
    return `${backendOrigin}${fileUrl}`;
  }
  return fileUrl;
};
