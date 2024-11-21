import Link from "next/link";
import { db } from "@/db";
import { Separator } from "~/components/ui/separator";
export default async function Page() {
  const properties = await db.query.properties.findMany({
    columns: {
      //hi
      id: true,
      name: true,
      street: true,
      city: true,
      state: true,
      zip: true,
    },
  });
  return (
    <div className="m-8 flex flex-col">
      <h1 className="text-4xl font-bold">Properties</h1>
      <Separator className="mb-4" />
      <div className="grid grid-flow-row grid-cols-4 gap-4">
        {properties.map((property) => (
          <div
            className="rounded-lg border-2 border-black bg-gray-400 p-4"
            key={property.id}
          >
            <Link href={"/park/" + property.id} key={property.id}>
              {property.name}
              <br />
              {property.state},{" " + property.city}
              <br />
              {property.street},{" " + property.zip}
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
