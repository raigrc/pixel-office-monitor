import { openCodeReadService } from "@/lib/opencode-discovery.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  return openCodeReadService.handle(request);
}

export async function POST(request: Request): Promise<Response> {
  return openCodeReadService.handle(request);
}

export function HEAD(): Response {
  return new Response(null, { status: 405, headers: { Allow: "GET, POST", "Cache-Control": "private, no-store" } });
}
