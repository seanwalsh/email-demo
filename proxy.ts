import { auth } from "@/auth";

export const proxy = auth((req) => {
  if (!req.auth && req.nextUrl.pathname !== "/login") {
    return Response.redirect(new URL("/login", req.nextUrl.origin));
  }
});

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};
