import fs from "node:fs";
import https from "node:https";

export async function downloadFile(
  urlToDownload: string,
  downloadedPath: string,
) {
  try {
    // Check if file already exists
    if (fs.existsSync(downloadedPath)) return;

    const file = fs.createWriteStream(downloadedPath);
    https
      .get(urlToDownload, (response) => {
        response.pipe(file);
        file.on("finish", () => {
          file.close(() => {
            console.log("File downloaded successfully");
          });
        });
      })
      .on("error", (err) => {
        fs.unlink(downloadedPath, () => {
          console.error("Error downloading file:", err);
          throw err;
        });
      });
  } catch (error) {
    throw new Error(`Error downloading file: ${error}`);
  }
}

/**
 * Returns the full path to a stored file given its id and optional save directory.
 * If saveDir is not provided, defaults to "output/uploaded".
 *
 * @param {Object} params - The parameters object.
 * @param {string} params.id - The file identifier.
 * @param {string} [params.saveDir] - Optional directory to save the file.
 * @returns {string} The full file path.
 */
export function getStoredFilePath({
  id,
  saveDir,
}: {
  id: string;
  saveDir?: string;
}): string {
  const directory = saveDir ?? "output/uploaded";
  return `${directory}/${id}`;
}
