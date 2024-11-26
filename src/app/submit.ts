"use server";
import { db } from "@/db";
import { properties as propertiesdb } from "@/db/schema";
import { eq } from "drizzle-orm";

export const submitStatus = async (propertyId: number, status: string) => {
  await db
    .update(propertiesdb)
    .set({ status })
    .where(eq(propertiesdb.id, propertyId));
};
