import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

/**
 * Public routes include OAuth/SSO callbacks under /sign-in/* and /sign-up/*
 * (e.g. /sign-up/sso-callback) so Google auth can complete before redirect.
 */
const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/test-db(.*)",
]);

/**
 * Clerk's auth().protect() returns an opaque 404 for some non-document
 * requests (CLI tools, certain fetches) when unauthenticated. For App Router
 * pages we redirect to sign-in instead so missing auth is never confused
 * with a missing route. APIs still use protect().
 */
export default clerkMiddleware((auth, request) => {
  if (isPublicRoute(request)) {
    return;
  }

  const { userId } = auth();
  if (userId) {
    return;
  }

  const pathname = request.nextUrl.pathname;
  if (pathname.startsWith("/api/")) {
    auth().protect();
    return;
  }

  const signInUrl = new URL("/sign-in", request.url);
  signInUrl.searchParams.set("redirect_url", request.url);
  return NextResponse.redirect(signInUrl);
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
