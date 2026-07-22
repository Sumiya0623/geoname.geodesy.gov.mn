/** @type {import('next').NextConfig} */
const withBundleAnalyzer = require("@next/bundle-analyzer")({
  enabled: process.env.ANALYZE === "true",
});
// const JavaScriptObfuscator = require('webpack-obfuscator');

module.exports = withBundleAnalyzer({
  productionBrowserSourceMaps: false,
  trailingSlash: true,
  allowedDevOrigins: [
    "geoname.nextgis.mn",
    "dev.geoname.nextgis.mn",
    "local.nextgis.mn",
  ],

  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },

  modularizeImports: {
    "@mui/icons-material": { transform: "@mui/icons-material/{{member}}" },
    "@mui/material": { transform: "@mui/material/{{member}}" },
    "@mui/lab": { transform: "@mui/lab/{{member}}" },
  },

  webpack(config, { isServer }) {
    config.module.rules.push({
      test: /\.svg$/,
      use: ["@svgr/webpack"],
    });

    return config;
  },
  // webpack(config, { isServer }) {
  //   config.module.rules.push({
  //     test: /\.svg$/,
  //     use: ["@svgr/webpack"],
  //   });

  //   if (!isServer) {
  //     config.plugins.push(
  //       new JavaScriptObfuscator(
  //         {
  //           compact: true,
  //           controlFlowFlattening: false,
  //           deadCodeInjection: false,
  //           stringArray: true,
  //           stringArrayEncoding: ["base64"],
  //           stringArrayThreshold: 1,
  //           rotateStringArray: true,
  //         },
  //         []
  //       )
  //     );
  //   }

  //   return config;
  // },
});
