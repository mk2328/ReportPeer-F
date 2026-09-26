/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Pre-existing lint debt in legacy routes/models; do not block production builds.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
