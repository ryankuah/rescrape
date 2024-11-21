// import type { Browser } from "puppeteer-core";
// const puppeteer = (await (process.env.NODE_ENV === "production"
//   ? import("puppeteer-core")
//   : // eslint-disable-next-line @typescript-eslint/consistent-type-imports
//     import("puppeteer"))) as typeof import("puppeteer-core");
import puppeteer from "puppeteer";
import type { Browser } from "puppeteer";
import { env } from "~/env";

import { db } from "@/db";
import { properties, propertyInfo } from "@/db/schema";
interface Property {
  name: string;
  street: string;
  city: string;
  state: string;
  zip: number;
  source: string;
  longitude: string;
  latitude: string;
}

interface PropertyInfo {
  key: string;
  value: string;
  propertyId: number;
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function scrapeCrexi() {
  console.log("Scraping Daily");
  // let browser: Browser;

  // if (process.env.NODE_ENV === "production") {
  // const browser = await puppeteer.connect({
  //   browserWSEndpoint: `wss://connect.browserbase.com?apiKey=${env.BROWSERBASE_API_KEY}`,
  // });
  // } else {
  const browser = await puppeteer.launch({ headless: false });
  // }
  const page = await browser.newPage();
  await page.goto("https://www.crexi.com/properties?sort=New%20Listings", {
    timeout: 120000,
    waitUntil: "networkidle2",
  });

  await page.waitForSelector(
    "body > crx-app > div > ng-component > crx-normal-page > div > crx-drawer > mat-drawer-container > mat-drawer-content > div > div > article > div > div > crx-search-map-view > div > div > div > div > crx-search-grid > div > div > div.clearfix.ng-star-inserted > crx-search-results > div > div",
  );

  const allLinks: string[] | null = await page.evaluate((): string[] | null => {
    const links = [];
    let next: HTMLAnchorElement | null = document.querySelector(
      "#pagination-container > div > ul > li.next.ng-star-inserted > a",
    );
    while (next) {
      next = document.querySelector(
        "#pagination-container > div > ul > li.next.ng-star-inserted > a",
      );
      const properties = document.querySelectorAll(
        "body > crx-app > div > ng-component > crx-normal-page > div > crx-drawer > mat-drawer-container > mat-drawer-content > div > div > article > div > div > crx-search-map-view > div > div > div > div > crx-search-grid > div > div > div.clearfix.ng-star-inserted > crx-search-results > div > div > crx-property-tile-aggregate",
      );
      for (const property of properties) {
        const href = property.querySelector("a")?.href;
        if (href) {
          links.push(href); // Push the href attribute to links array
        }
      }
      if (next) next.click();
    }
    return links;
  });
  await page.close();
  console.log(allLinks);
  const scrapedLinks = await db.query.properties.findMany({
    columns: {
      source: true,
    },
  });
  if (!allLinks) return;
  const unscrapedLinks = allLinks.filter(
    (link) => !scrapedLinks.some((scrapedLink) => scrapedLink.source === link),
  );
  if (!unscrapedLinks) return;
  for (const link of unscrapedLinks) {
    await scrape(link, browser);
  }
  await browser.close();
}

async function scrape(URL: string, browser: Browser) {
  const page = await browser.newPage();
  await page.goto(URL, { timeout: 120000, waitUntil: "networkidle0" });
  const property: Property = {
    name: "",
    street: "",
    city: "",
    state: "",
    zip: 0,
    source: URL,
    longitude: "0",
    latitude: "0",
  };

  property.name = await page.evaluate(() => {
    const nameElement = document.querySelector(
      "body > crx-app > div > ng-component > crx-normal-page > div > crx-drawer > mat-drawer-container > mat-drawer-content > div > div > div > crx-pdp-content > div > cui-grid-container > div > div.left-column > div > section > div > div.property-detail-media-container > div > crx-sales-pdp-media-header > div > h1",
    );
    if (!nameElement) return "unnamed";
    const name = (nameElement as HTMLElement).innerText;
    return name ?? null;
  });

  const address = await page.evaluate((): string | null => {
    const addressElement = document.querySelector(
      "body > crx-app > div > ng-component > crx-normal-page > div > crx-drawer > mat-drawer-container > mat-drawer-content > div > div > div > crx-pdp-content > div > cui-grid-container > div > div.right-column > crx-sales-pdp-right-section > div > crx-sales-pdp-tabs > div > div.details-tabs-content > crx-sales-pdp-info-tab > div > crx-pdp-main-info > div.property-info-container.addresses.ng-star-inserted > div.property-info-data.ng-star-inserted > crx-pdp-addresses > div > div > div > h2",
    );
    if (!addressElement) return null;
    const address = (addressElement as HTMLElement).innerText;
    return address ?? null;
  });
  if (address) {
    const addressArr = address.split(",");
    if (addressArr.length == 3 && addressArr[2]!.split(" ").length == 3) {
      property.street = addressArr[0]!.trim();
      property.city = addressArr[1]!.trim();
      property.state = addressArr[2]!.split(" ")[1]!.trim();
      const zipcode = addressArr[2]!.split(" ")[2]!.trim() as unknown as number;
      if (zipcode) {
        property.zip = zipcode;
      }
    }
  }

  //geocode
  type GeoData = {
    type: string;
    features: Feature[];
    attribution: string;
  };
  type Feature = {
    id: string;
    type: string;
    geometry: {
      type: string;
      coordinates: number[];
    };
    properties: object;
  };

  const geoData: GeoData = (await fetch(
    `https://api.mapbox.com/search/geocode/v6/forward?country=us&address_line1=${encodeURIComponent(property.street)}&postcode=${encodeURIComponent(property.zip)}&region=${encodeURIComponent(property.state)}&access_token=${env.MAPBOX_API_KEY}`,
  ).then((res) => res.json())) as unknown as GeoData;
  if (!geoData.features || geoData.features.length === 0) {
    console.log("No features found");
  }
  const [longitude, latitude] = geoData.features[0]!.geometry.coordinates;
  if (longitude && latitude) {
    property.longitude = longitude.toString();
    property.latitude = latitude.toString();
  }

  const propertyId = await db
    .insert(properties)
    .values(property)
    .returning({ id: properties.id })
    .then((res) => res[0]!.id);
  console.log(propertyId);
  const propertyArr: PropertyInfo[] = [];

  const propertyDesc = await page.evaluate(() => {
    const propertyDescElement = document.querySelector(
      "body > crx-app > div > ng-component > crx-normal-page > div > crx-drawer > mat-drawer-container > mat-drawer-content > div > div > div > crx-pdp-content > div > cui-grid-container > div > div.left-column > div > section > div > div.property-detail-media-container > div > crx-sales-pdp-media-header > div > div",
    );
    if (!propertyDescElement) return null;
    const propertyDesc = (propertyDescElement as HTMLElement).innerText;
    return propertyDesc ?? null;
  });
  if (propertyDesc) {
    propertyArr.push({ key: "Desc", value: propertyDesc, propertyId });
  }

  const price = await page.evaluate(() => {
    const priceElement = document.querySelector(
      "body > crx-app > div > ng-component > crx-normal-page > div > crx-drawer > mat-drawer-container > mat-drawer-content > div > div > div > crx-pdp-content > div > cui-grid-container > div > div.left-column > div > section > div > div.right-border > div > crx-pdp-brokers-container > div > cui-grid-container > div > div.offer-container > div > div > crx-pdp-terms > div:nth-child(2) > div.term-line.ng-star-inserted > span.text.term-value.asking-price > span",
    );
    if (!priceElement) return "0";
    return (priceElement as HTMLElement).innerText;
  });
  propertyArr.push({ key: "Price", value: price, propertyId });

  const addressData: PropertyInfo[] = await page.evaluate(() => {
    const outArray: PropertyInfo[] = [];
    const addressDataElement = document.querySelector(
      "body > crx-app > div > ng-component > crx-normal-page > div > crx-drawer > mat-drawer-container > mat-drawer-content > div > div > div > crx-pdp-content > div > cui-grid-container > div > div.right-column > crx-sales-pdp-right-section > div > crx-sales-pdp-tabs > div > div.details-tabs-content > crx-sales-pdp-info-tab > div > crx-pdp-main-info > div.update-info.ng-star-inserted",
    );
    if (!addressDataElement) return outArray;
    const addressDatas = addressDataElement.querySelectorAll("div");
    for (const addressData of addressDatas) {
      const key = addressData.querySelectorAll("div")[0]?.innerText;
      const value = addressData.querySelectorAll("div")[1]?.innerText;
      if (key && value) {
        outArray.push({ key, value, propertyId: 0 });
      }
    }
    return outArray;
  });
  addressData.forEach((data) => {
    propertyArr.push({ key: data.key, value: data.value, propertyId });
  });

  const detailData: PropertyInfo[] = await page.evaluate(() => {
    const outArray: PropertyInfo[] = [];
    const detailDataElement = document.querySelector(
      "body > crx-app > div > ng-component > crx-normal-page > div > crx-drawer > mat-drawer-container > mat-drawer-content > div > div > div > crx-pdp-content > div > cui-grid-container > div > div.right-column > crx-sales-pdp-right-section > div > crx-sales-pdp-tabs > div > div.details-tabs-content > crx-sales-pdp-info-tab > div > div:nth-child(2) > div > crx-sales-attributes > div > cui-grid-container > div",
    );
    if (!detailDataElement) return outArray;
    const detailDatas = detailDataElement.querySelectorAll(
      "div.property-details-item.ng-star-inserted",
    );
    for (const detailData of detailDatas) {
      const key = detailData.querySelectorAll("span")[0]?.innerText;
      const value = detailData.querySelectorAll("span")[2]?.innerText;
      if (key && value) {
        outArray.push({ key, value, propertyId: 0 });
      }
    }
    return outArray;
  });

  detailData.forEach((data) => {
    propertyArr.push({ key: data.key, value: data.value, propertyId });
  });

  await page.goto(URL, {
    waitUntil: "networkidle2",
    timeout: 120000,
  });

  await page.waitForSelector(
    "body > crx-app > div > ng-component > crx-normal-page > div > crx-drawer > mat-drawer-container > mat-drawer-content > div > div > div > crx-pdp-content > div > cui-grid-container > div > div.left-column > div > section > div > div.property-detail-media-container > div > crx-sales-pdp-gallery > div > div.gallery-buttons",
  );
  const pathNumber = await page.evaluate(() => {
    const two = document.querySelector(
      "body > crx-app > div > ng-component > crx-normal-page > div > crx-drawer > mat-drawer-container > mat-drawer-content > div > div > div > crx-pdp-content > div > cui-grid-container > div > div.left-column > div > section > div > div.property-detail-media-container > div > crx-sales-pdp-gallery > div > div.gallery-buttons > a:nth-child(2)",
    );
    if ((two as HTMLElement).title === "Street View") {
      return 3;
    }
    return 2;
  });

  const imageNumber = await page.evaluate(() => {
    let pathNumber = 2;
    const two = document.querySelector(
      "body > crx-app > div > ng-component > crx-normal-page > div > crx-drawer > mat-drawer-container > mat-drawer-content > div > div > div > crx-pdp-content > div > cui-grid-container > div > div.left-column > div > section > div > div.property-detail-media-container > div > crx-sales-pdp-gallery > div > div.gallery-buttons > a:nth-child(2)",
    );
    if ((two as HTMLElement).title === "Street View") {
      pathNumber = 3;
    }
    const out = document.querySelector(
      `body > crx-app > div > ng-component > crx-normal-page > div > crx-drawer > mat-drawer-container > mat-drawer-content > div > div > div > crx-pdp-content > div > cui-grid-container > div > div.left-column > div > section > div > div.property-detail-media-container > div > crx-sales-pdp-gallery > div > div.gallery-buttons > a:nth-child(${pathNumber})`,
    );
    if (!out) return null;
    const number = out.getAttribute("title")?.split(" ")[1];
    if (number) return parseInt(number);
    return null;
  });

  await page.click(
    `body > crx-app > div > ng-component > crx-normal-page > div > crx-drawer > mat-drawer-container > mat-drawer-content > div > div > div > crx-pdp-content > div > cui-grid-container > div > div.left-column > div > section > div > div.property-detail-media-container > div > crx-sales-pdp-gallery > div > div.gallery-buttons > a:nth-child(${pathNumber})`,
  );

  await wait(2000);

  for (let i = 0; i < (imageNumber ?? 4); i++) {
    try {
      await page.click(
        "#mat-mdc-dialog-0 > div > div > crx-gallery-modal > div > div > crx-ui-carousel > div > div.modal-ui-carousel-next > div",
      );
    } catch (e) {
      console.log(e);
    }
    await wait(500);
  }
  await wait(2000);

  const images = await page.evaluate(() => {
    const imageArr = document.querySelectorAll(".ready");

    if (!imageArr) return [];
    const outArr = [];

    for (const image of imageArr) {
      outArr.push(image.getAttribute("src"));
    }
    return outArr;
  });
  await page.close();
  const outArr = images
    .filter((img) => img !== null)
    .map((img) => ({ key: "image", value: img, propertyId: propertyId }));

  propertyArr.push(...outArr);

  for (const info of propertyArr) {
    await db.insert(propertyInfo).values(info);
  }
}
