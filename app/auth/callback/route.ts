import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const destination = requestUrl.searchParams.get("next");
  const safeDestination = destination && destination.startsWith("/") && !destination.startsWith("//")
    ? destination
    : "/chat";
  return NextResponse.redirect(new URL(safeDestination, requestUrl.origin));
}
