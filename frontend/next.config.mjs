/** @type {import('next').NextConfig} */
const configuredBackendApiBase =
    process.env.BACKEND_API_BASE_URL
    || process.env.NEXT_PUBLIC_API_BASE_URL
    || "http://localhost:8000/api";

const backendApiBase = configuredBackendApiBase.replace(/\/+$/, "");

const nextConfig = {
    output: "standalone",
    experimental: {
        optimizePackageImports: ["lucide-react", "framer-motion", "@react-three/fiber", "@react-three/drei", "three"],
    },
    async rewrites() {
        return [
            {
                source: "/api/:path*",
                destination: `${backendApiBase}/:path*`,
            },
        ];
    },
};

export default nextConfig;