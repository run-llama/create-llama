/** @type {import('next').NextConfig} */
import fs from "fs";
import webpack from "./webpack.config.mjs";

const nextConfig = JSON.parse(fs.readFileSync("./next.config.json", "utf-8"));
nextConfig.webpack = webpack;

// redirect from /data/path-to-file to /api/data/path-to-file
nextConfig.rewrites = async () => {
  return [
    {
      source: "/data/:path*",
      destination: "/api/data/:path*",
    },
  ];
};

export default nextConfig;
