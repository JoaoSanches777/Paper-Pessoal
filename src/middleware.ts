import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, COOKIE_NAME } from "@/lib/auth";

function withSecurityHeaders(res: NextResponse) {
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("Referrer-Policy", "same-origin");
  return res;
}

export async function middleware(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const userId = token ? await verifySessionToken(token) : null;
  const isLoginPage = req.nextUrl.pathname === "/login";

  if (!userId && !isLoginPage) {
    return withSecurityHeaders(NextResponse.redirect(new URL("/login", req.url)));
  }
  if (userId && isLoginPage) {
    return withSecurityHeaders(NextResponse.redirect(new URL("/", req.url)));
  }
  return withSecurityHeaders(NextResponse.next());
}

export const config = {
  matcher: ["/((?!api/auth/login|_next/static|_next/image|favicon.ico).*)"],
};
