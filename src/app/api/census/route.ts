import { getData } from "@/scraper/census";

export async function POST() {
  await getData();
  return new Response("OK");
}
