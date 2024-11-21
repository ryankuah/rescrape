import { db } from "@/db";
import { states, counties, countyStats } from "@/db/schema";

type CensusApiResponse = [string[], ...string[][]];

export async function getData() {
  const res: CensusApiResponse = (await fetch(
    "https://api.census.gov/data/2023/acs/acsse?get=NAME,K200101_001E&for=county:*",
  ).then((response) => response.json())) as CensusApiResponse;
  const [, ...data] = res;
  console.log(data);
  for (const row of data) {
    const [name, pop, state, county] = row;
    const nameSplit = name!.split(",");
    const stateName = nameSplit[1]?.trim();
    const countyName = nameSplit[0]?.trim();
    await db
      .insert(states)
      .values({ id: Number(state), name: stateName })
      .onConflictDoNothing();
    const [countyNumber] = await db
      .insert(counties)
      .values({
        countyid: Number(county),
        name: countyName,
        stateId: Number(state),
      })
      .onConflictDoNothing()
      .returning({ insertedId: counties.id });
    console.log(countyNumber?.insertedId);
    if (countyNumber?.insertedId) {
      await db
        .insert(countyStats)
        .values({
          countyId: countyNumber.insertedId,
          key: "2023_Population",
          value: pop,
        })
        .onConflictDoNothing();
    }
  }
}
