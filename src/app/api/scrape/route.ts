import { scrapeCrexi } from "@/scraper/scraperCrexi";

export async function POST() {
  await scrapeCrexi();
}
