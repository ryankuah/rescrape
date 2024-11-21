import { db } from "@/db";
import { properties } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { countyStats } from "@/db/schema";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "~/components/ui/carousel";
import Image from "next/image";
import Map from "./map";
import { env } from "~/env";
import { Separator } from "~/components/ui/separator";

type CountyData = typeof countyStats.$inferSelect;

async function findClosestCounty(searchCounty: string) {
  const result = await db.execute(
    sql`SELECT name, id, similarity(name, ${searchCounty}) AS similarity 
        FROM rescrape_county
        WHERE similarity(name, ${searchCounty}) > 0.3 
        ORDER BY similarity DESC 
        LIMIT 1;`,
  );
  if (!result[0]) return;

  return Number(result[0]?.id);
}

export default async function Page({
  params,
}: {
  params: Promise<{ propertyid: number }>;
}) {
  const propertyid = (await params).propertyid;
  console.log(propertyid);
  let property;
  try {
    property = await db.query.properties.findFirst({
      where: eq(properties.id, propertyid),
      with: {
        propertyInfo: true,
      },
    });

    if (!property) {
      throw new Error(`Property with id ${propertyid} not found`);
    }
    console.log(property);
  } catch (error) {
    console.error("Error finding user:", error);
    throw error;
  }

  let countyId: number | undefined;
  let countyData: CountyData[] | undefined;
  if (property.city) {
    countyId = await findClosestCounty(property.city);
    if (countyId) {
      countyData = (await db.query.countyStats.findMany({
        where: eq(countyStats.countyId, countyId),
      })) as unknown as CountyData[];
    }
  }

  return (
    <div className="m-4 flex h-full w-full flex-col">
      <h1 className="ml-4 mr-4 mt-4">{property.name}</h1>
      <div className="flex w-full flex-row">
        <div className="m-4 flex w-1/2 flex-col">
          <div className="flex flex-row">
            <p> {property.street}, </p>
            <p> &nbsp;{property.city}, </p>
            <p> &nbsp;{property.state}, </p>
            <p> &nbsp;{property.zip}</p>
          </div>
          <Map
            latitude={Number(property.latitude) ?? 42.09833}
            longitude={Number(property.longitude) ?? -79.22119}
            zoom={14}
            apiKey={env.MAPBOX_API_KEY}
          />
          {countyData ? (
            <div>
              <h2 className="mt-4 text-2xl font-semibold">
                {property.city + " "} Statistics
              </h2>
              <Separator className="mb-4" />
              {countyData.map((county) => (
                <div key={county.key}>
                  {county.key}: {county.value}
                </div>
              ))}
            </div>
          ) : null}
        </div>
        <div className="m-4 flex w-1/2 flex-col">
          <Carousel className="mx-auto w-2/3">
            <CarouselContent>
              {property.propertyInfo
                .filter((info) => info.key === "image")
                .map((info) => (
                  <CarouselItem key={info.value}>
                    <Image
                      src={info.value ?? ""}
                      alt={"image"}
                      width={300}
                      height={500}
                      className="mx-auto"
                    />
                  </CarouselItem>
                ))}
            </CarouselContent>
            <CarouselPrevious />
            <CarouselNext />
          </Carousel>
          {property.propertyInfo
            .filter((info) => info.key !== "image")
            .map((info) => (
              <div key={info.key}>
                {info.key}: {info.value}
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
