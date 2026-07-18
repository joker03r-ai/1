/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Компактный самодостаточный бандл для сервера/Docker (.next/standalone).
  output: "standalone",
};

module.exports = nextConfig;
