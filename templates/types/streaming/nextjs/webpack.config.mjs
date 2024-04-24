// webpack config must be a function in NextJS that is used to patch the default webpack config provided by NextJS, see https://nextjs.org/docs/pages/api-reference/next-config-js/webpack
export default function webpack(config) {
  config.resolve.fallback = {
    aws4: false,
  };

  // Uncomment the following lines when you met issues with onnxruntime-node
  // The issue can happen when you use onnxruntime-node with pnpm
  // See: https://github.com/vercel/next.js/issues/43433

  // config.externals.push({
  //   "onnxruntime-node": "commonjs onnxruntime-node",
  // });

  return config;
}
