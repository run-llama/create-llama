import { NextRequest } from "next/server";
import { handleComponentRoute } from "../shared/component-handler";

const LAYOUT_TYPES = ["header", "footer"] as const;

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const directory = params.get("layoutDir") || "layout";
  return handleComponentRoute(directory, LAYOUT_TYPES);
}
