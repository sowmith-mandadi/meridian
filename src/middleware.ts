export { auth as middleware } from "@/lib/auth";

export const config = {
  matcher: [
    "/chat/:path*",
    "/pipeline/:path*",
    "/collaborate/:path*",
    "/feedback/:path*",
    "/observe/:path*",
  ],
};
