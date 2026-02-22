import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
	dest: "public",
	cacheOnFrontEndNav: true,
	aggressiveFrontEndNavCaching: true,
	reloadOnOnline: true,
	swMinify: true,
	register: true,
	skipWaiting: true,
	disable: process.env.NODE_ENV === "development" && process.env.ENABLE_PWA_DEV !== "true",
});

/** @type {import('next').NextConfig} */
const nextConfig = {};
export default withPWA(nextConfig);
