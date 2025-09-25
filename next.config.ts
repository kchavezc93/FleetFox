import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
    ],
  },
  webpack: (config, { dev }) => {
    if (dev) {
      // Silence Watchpack errors on Windows for system files using a single RegExp (schema requires RegExp or string array)
      config.watchOptions = {
        ...(config.watchOptions || {}),
        ignored: /(?:^|[\\/])(hiberfil\.sys|pagefile\.sys|swapfile\.sys)$/i,
      } as any;
    }
    return config;
  },
};

export default nextConfig;
