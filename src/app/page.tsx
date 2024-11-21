import Link from "next/link";
import { db } from "@/db";
export default async function Page() {
  const properties = await db.query.properties.findMany({
    columns: {
      id: true,
      name: true,
    },
  });
  return (
    <div className="flex flex-col">
      {properties.map((property) => (
        <Link href={"/park/" + property.id} key={property.id}>
          {property.name}
        </Link>
      ))}
    </div>
  );
}
