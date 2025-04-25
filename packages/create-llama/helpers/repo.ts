import { createWriteStream, promises } from "fs";
import got from "got";
import { tmpdir } from "os";
import { join } from "path";
import { Stream } from "stream";
import tar from "tar";
import { promisify } from "util";
import { makeDir } from "./make-dir";
import { CommunityProjectConfig } from "./types";

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

const getRepoInfo = async (owner: string, repo: string) => {
  const repoInfoRes = await got(
    `https://api.github.com/repos/${owner}/${repo}`,
    {
      responseType: "json",
    },
  );
  const data = repoInfoRes.body as any;
  return data;
};

export async function getProjectOptions(
  owner: string,
  repo: string,
): Promise<
  {
    value: CommunityProjectConfig;
    title: string;
  }[]
> {
  // TODO: consider using octokit (https://github.com/octokit) if more changes are needed in the future
  const getCommunityProjectConfig = async (
    item: any,
  ): Promise<CommunityProjectConfig | null> => {
    // if item is a folder, return the path with default owner, repo, and main branch
    if (item.type === "dir")
      return {
        owner,
        repo,
        branch: "main",
        filePath: item.path,
      };

    // check if it's a submodule (has size = 0 and different owner & repo)
    if (item.type === "file") {
      if (item.size !== 0) return null; // submodules have size = 0

      // get owner and repo from git_url
      const { git_url } = item;
      const startIndex = git_url.indexOf("repos/") + 6;
      const endIndex = git_url.indexOf("/git");
      const ownerRepoStr = git_url.substring(startIndex, endIndex);
      const [owner, repo] = ownerRepoStr.split("/");

      // quick fetch repo info to get the default branch
      const { default_branch } = await getRepoInfo(owner, repo);

      // return the path with default owner, repo, and main branch (path is empty for submodules)
      return {
        owner,
        repo,
        branch: default_branch,
      };
    }

    return null;
  };

  const url = `https://api.github.com/repos/${owner}/${repo}/contents`;
  const response = await got(url, {
    responseType: "json",
  });
  const data = response.body as any[];

  const projectConfigs: CommunityProjectConfig[] = [];
  for (const item of data) {
    const communityProjectConfig = await getCommunityProjectConfig(item);
    if (communityProjectConfig) projectConfigs.push(communityProjectConfig);
  }
  return projectConfigs.map((config) => {
    return {
      value: config,
      title: config.filePath || config.repo, // for submodules, use repo name as title
    };
  });
}

export async function getRepoRawContent(repoFilePath: string) {
  const url = `https://raw.githubusercontent.com/${repoFilePath}`;
  const response = await got(url, {
    responseType: "text",
  });
  return response.body;
}
