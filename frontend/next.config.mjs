/** @type {import('next').NextConfig} */
const configuredBackendApiBase =
    process.env.BACKEND_API_BASE_URL
    || process.env.NEXT_PUBLIC_API_BASE_URL
    || "http://localhost:8000/api";

const skipTypeCheckInBuild = process.env.NEXT_DISABLE_TYPECHECK === "1";

const backendApiBase = configuredBackendApiBase.replace(/\/+$/, "");

const nextConfig = {
    output: "standalone",
    typescript: {
        // Allow CD to bypass strict type-checking when NEXT_DISABLE_TYPECHECK=1.
        ignoreBuildErrors: skipTypeCheckInBuild,
    },
    images: {
        remotePatterns: [
            {
                protocol: "https",
                hostname: "lh3.googleusercontent.com",
                port: "",
                pathname: "/a/**",
            },
            {
                protocol: "https",
                hostname: "api.dicebear.com",
                port: "",
                pathname: "/**",
            },
        ],
    },
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