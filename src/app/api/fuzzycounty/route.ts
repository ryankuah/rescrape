import { sql } from "drizzle-orm";
import { db } from "@/db";
import { NextResponse } from "next/server";

export async function GET() {
  const countyName = await findClosestCounty("Los Angles");
  return NextResponse.json({ closest: countyName }, { status: 200 });
}

async function findClosestCounty(searchCounty: string) {
  const result = await db.execute(
    sql`SELECT name, similarity(name, ${searchCounty}) AS similarity 
        FROM rescrape_county
        WHERE similarity(name, ${searchCounty}) > 0.3 
        ORDER BY similarity DESC 
        LIMIT 1;`,
  );

  return result[0]?.name;
}
