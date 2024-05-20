const STORAGE_FOLDER = "data";

export const getStaticFileDataUrl = (filename: string) => {
  const isUsingBackend = !!process.env.NEXT_PUBLIC_CHAT_API;
  const fileUrl = `/api/${STORAGE_FOLDER}/${filename}`;
  if (isUsingBackend) {
    const backendOrigin = new URL(process.env.NEXT_PUBLIC_CHAT_API!).origin;
    return `${backendOrigin}/${fileUrl}`;
  }
  return fileUrl;
};

// replace all attachment:// url with /api/data/
export const replaceAttachmentUrl = (content: string) => {
  const isUsingBackend = !!process.env.NEXT_PUBLIC_CHAT_API;
  if (isUsingBackend) {
    const backendOrigin = new URL(process.env.NEXT_PUBLIC_CHAT_API!).origin;
    return content.replace(
      /attachment:\/\//g,
      `${backendOrigin}/api/${STORAGE_FOLDER}/`,
    );
  }
  return content.replace(/attachment:\/\//g, `/api/${STORAGE_FOLDER}/`);
};
