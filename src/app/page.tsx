import { db } from "@/db";
import { Separator } from "~/components/ui/separator";
import Map from "./map";
import { env } from "~/env";

type Property = {
  id: number;
  name: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  longitude: number;
  latitude: number;
  status: string;
};
export default async function Page() {
  const properties = (await db.query.properties.findMany({
    columns: {
      id: true,
      name: true,
      street: true,
      city: true,
      state: true,
      zip: true,
      longitude: true,
      latitude: true,
      status: true,
    },
  })) as unknown as Property[];

  return (
    <div className="m-8 flex h-screen w-screen flex-col overflow-clip">
      <h1 className="text-4xl font-bold">Properties</h1>
      <Separator className="mb-4" />

      <Map propertyArr={properties} apiKey={env.MAPBOX_API_KEY} />
    </div>
  );
}
