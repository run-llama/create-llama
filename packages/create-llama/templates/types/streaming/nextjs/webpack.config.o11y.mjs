export default function webpack(config, isServer) {
  config.resolve.fallback = {
    aws4: false,
  };
  config.module.rules.push({
    test: /\.node$/,
    loader: "node-loader",
  });
  if (isServer) {
    config.ignoreWarnings = [{ module: /opentelemetry/ }];
  }
  return config;
}
