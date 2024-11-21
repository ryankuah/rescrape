import { db } from "@/db";
import { properties } from "@/db/schema";
import { eq } from "drizzle-orm";
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
  return (
    <div className="flex h-full w-full flex-col">
      <h1>{property.name}</h1>
      <div className="flex w-full flex-row">
        <div className="flex w-1/2 flex-col">
          <div className="flex flex-row">
            <p> {property.street}, </p>
            <p> &nbsp;{property.city}, </p>
            <p> &nbsp;{property.state}, </p>
            <p> &nbsp;{property.zip}</p>
          </div>
          <Map
            latitude={42.09833}
            longitude={-79.22119}
            zoom={14}
            apiKey={env.MAPBOX_API_KEY}
          />
        </div>
        <div className="flex w-1/2 flex-col">
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
