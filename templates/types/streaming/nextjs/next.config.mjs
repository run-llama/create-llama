/** @type {import('next').NextConfig} */
import fs from "fs";
import webpack from "./webpack.config.mjs";

const nextConfig = JSON.parse(fs.readFileSync("./next.config.json", "utf-8"));
nextConfig.webpack = webpack;

// redirect /api/tool-output/ to api/data/ with same slug
nextConfig.rewrites = async () => {
  return [
    {
      source: "/api/tool-output/:slug",
      destination: "/api/data/:slug",
    },
  ];
};

export default nextConfig;
