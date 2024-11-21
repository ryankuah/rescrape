import { NextResponse } from "next/server";
import { env } from "~/env";

export async function GET() {
  return NextResponse.json({ apiKey: env.MAPBOX_API_KEY });
}
