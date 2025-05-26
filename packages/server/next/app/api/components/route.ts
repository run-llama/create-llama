import { NextRequest } from "next/server";
import { handleComponentRoute } from "../shared/component-handler";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const directory = params.get("componentsDir") || "components";
  return handleComponentRoute(directory);
}
