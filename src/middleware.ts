import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PROTECTED_PATHS = ["/chat", "/pipeline", "/collaborate", "/feedback", "/observe", "/codex"];

export function middleware(request: NextRequest) {
  const sessionToken =
    request.cookies.get("authjs.session-token")?.value ||
    request.cookies.get("__Secure-authjs.session-token")?.value;

  const isProtected = PROTECTED_PATHS.some((p) =>
    request.nextUrl.pathname.startsWith(p)
  );

  if (isProtected && !sessionToken) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/chat/:path*",
    "/pipeline/:path*",
    "/collaborate/:path*",
    "/feedback/:path*",
    "/observe/:path*",
    "/codex/:path*",
  ],
};
