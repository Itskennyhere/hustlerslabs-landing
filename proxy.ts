import { NextResponse, type NextRequest } from "next/server";

// Fast first gate only: bounce visitors with no session cookie straight to /login.
// The real check (cookie validated against the database) runs in every protected
// layout and every server action, so this file is never the only line of defence.
export function proxy(request: NextRequest) {
  const name = process.env.NODE_ENV === "production" ? "__Host-hl_session" : "hl_session";
  if (!request.cookies.get(name)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/members", "/members/:path*", "/admin", "/admin/:path*"],
};
