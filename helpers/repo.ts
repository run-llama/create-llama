import { createWriteStream, promises } from "fs";
import got from "got";
import { tmpdir } from "os";
import { join } from "path";
import { Stream } from "stream";
import tar from "tar";
import { promisify } from "util";
import { makeDir } from "./make-dir";

export type RepoInfo = {
  username: string;
  name: string;
  branch: string;
  filePath: string;
};

const pipeline = promisify(Stream.pipeline);

async function downloadTar(url: string) {
  const tempFile = join(tmpdir(), `next.js-cna-example.temp-${Date.now()}`);
  await pipeline(got.stream(url), createWriteStream(tempFile));
  return tempFile;
}

export async function downloadAndExtractRepo(
  root: string,
  { username, name, branch, filePath }: RepoInfo,
) {
  await makeDir(root);

  const tempFile = await downloadTar(
    `https://codeload.github.com/${username}/${name}/tar.gz/${branch}`,
  );

  await tar.x({
    file: tempFile,
    cwd: root,
    strip: filePath ? filePath.split("/").length + 1 : 1,
    filter: (p) =>
      p.startsWith(
        `${name}-${branch.replace(/\//g, "-")}${
          filePath ? `/${filePath}/` : "/"
        }`,
      ),
  });

  await promises.unlink(tempFile);
}

const getRepoInfo = async (ownerRepoPath: string) => {
  const repoInfoRes = await got(`https://api.github.com/repos/${ownerRepoPath}`, {
    responseType: "json",
  });
  const data = repoInfoRes.body as any;
  return data;
}

export async function getProjectOptions(
	owner: string,
	repo: string
): Promise<
	{
		value: string;
		title: string;
	}[]
> {
	// return community path for projects and submodules
	const getCommunityProjectPath = async (item: any) => {
		// if item is a folder, return the path with default owner, repo, and main branch
		if (item.type === "dir") return `${owner}/${repo}/main/${item.path}`;

		// check if it's a submodule (has size = 0 and different owner & repo)
		if (item.type === "file") {
			if (item.size !== 0) return null; // submodules have size = 0

			// get owner and repo from git_url
			const { git_url } = item;
			const startIndex = git_url.indexOf("repos/") + 6;
			const endIndex = git_url.indexOf("/git");
			const ownerRepo = git_url.substring(startIndex, endIndex);

			// quick fetch repo info to get the default branch
			const repoInfo = await getRepoInfo(ownerRepo);

			// return the path with default owner, repo, and main branch (path is empty for submodules)
			return `${ownerRepo}/${repoInfo.default_branch}`;
		}

		return null;
	};

	const url = `https://api.github.com/repos/${owner}/${repo}/contents`;
	const response = await got(url, {
		responseType: "json",
	});
	const data = response.body as any[];

	const paths: string[] = [];
	for (const item of data) {
		const communityProjectPath = await getCommunityProjectPath(item);
		if (communityProjectPath) paths.push(communityProjectPath);
	}
	return paths.map((path) => {
    const pathArr = path.split("/");
    const title = pathArr[3] || pathArr[1]; // use repo name if no folder path
    return {
      value: path,
      title
    }
  });
}

export async function getRepoRawContent(repoFilePath: string) {
  const url = `https://raw.githubusercontent.com/${repoFilePath}`;
  const response = await got(url, {
    responseType: "text",
  });
  return response.body;
}
