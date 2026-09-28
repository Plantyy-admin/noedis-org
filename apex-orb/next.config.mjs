/** @type {import('next').NextConfig} */
const nextConfig = {
  // Served by Caddy under the cockpit's own host, so the orb lives at
  // https://noedis.org/voice/ and inherits the same sign-in gate.
  basePath: "/voice",
  reactStrictMode: true,
};

export default nextConfig;
