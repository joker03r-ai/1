/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Компактный самодостаточный бандл для сервера/Docker (.next/standalone).
  output: "standalone",
  // GramJS (telegram) — тяжёлая Node-библиотека для MTProto; не бандлим её,
  // грузим на сервере во время запроса (динамический import в маршрутах).
  experimental: {
    serverComponentsExternalPackages: ["telegram"],
  },
};

module.exports = nextConfig;
