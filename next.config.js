/** @type {import('next').NextConfig} */
const withBundleAnalyzer = require("@next/bundle-analyzer")({
  enabled: process.env.ANALYZE === "true",
});
// const JavaScriptObfuscator = require('webpack-obfuscator');

module.exports = withBundleAnalyzer({
  // Build хийхэд dev серверийн .next кэш эвдрэхээс сэргийлнэ. `npm run dev` ба
  // `next build` хоёулаа НЭГ .next хавтас руу бичдэг тул зэрэг ажиллуулахад dev
  // сервер MODULE_NOT_FOUND (webpack-runtime.js алга) өгдөг. Шалгах build‑ыг
  //   NEXT_DIST_DIR=.next-build npx next build
  // гэж тусад нь гаргана (npm run build:check).
  distDir: process.env.NEXT_DIST_DIR || ".next",
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

    // Cesium (3D харагдац) — статик файлууд public/cesium/ дороос үйлчилнэ
    // (CESIUM_BASE_URL). Сан нь Node‑ийн модулиудыг заримдаа шалгадаг тул
    // browser build дээр тэдгээрийг хоосон болгоно.
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        url: false,
      };
    }

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
