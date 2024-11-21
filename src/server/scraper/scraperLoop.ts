import puppeteer from "puppeteer";
import { type Browser } from "puppeteer";
import { db } from "../server/db/index";
import { parks, parkData, parkImage } from "../server/db/schema";

type MobileHomePark = typeof parks.$inferInsert;

type ParkData = {
  key: string;
  data: string;
};

type dbParkData = typeof parkData.$inferInsert;

type CombinedData = MobileHomePark & { parkData: ParkData[] } & {
  images: string[];
};

export async function scrapeLoop() {
  console.log("Scraping Daily");

  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Safari/537.36",
  );
  await page.goto(
    "https://www.loopnet.com/search/mobile-home-parks/usa/for-sale",
  );

  await page.waitForSelector(
    "#placardSec > div:nth-child(3) > div > ol > li.afterellipsisli > a",
  );

  const pages: number | null = await page.evaluate((): number | null => {
    const element = document.querySelector(
      "#placardSec > div:nth-child(3) > div > ol > li.afterellipsisli > a",
    );
    return element
      ? ((element as HTMLElement).innerText.trim() as unknown as number)
      : null;
  });
  await page.close();
  console.log(pages);

  let listings = await getLinks();
  if (!listings) listings = [];

  console.log(listings);

  if (!pages) {
    throw new Error("Page number not found");
  }

  for (let i = 1; i <= pages; i++) {
    console.log("Scraping page " + i);
    const pagelinks: string[] = await scrape(
      `https://www.loopnet.com/search/mobile-home-parks/usa/for-sale/${i}`,
      browser,
    );
    pagelinks.forEach((link, index) => {
      pagelinks[index] = link.replace(/(\?.*)/g, "");
    });
    console.log(pagelinks);
    const listingsToScrape = pagelinks.filter(
      (link) => !listings!.some((listing) => listing === link),
    );
    listings = listings.filter(
      (link) => !pagelinks.some((listing) => listing === link),
    );
    console.log(listingsToScrape);

    if (listingsToScrape.length != 0) {
      const parkRes = [];
      for (const pageLink of listingsToScrape) {
        try {
          parkRes.push(await scrapeListing(pageLink, browser));
        } catch (e) {
          console.log(e);
          console.log("Failed to scrape " + pageLink);
        }
      }

      const parkResNulless = parkRes.filter((res) => res !== null);

      await updateDB(parkResNulless);
    }
  }
  await browser.close();
}

async function scrape(URL: string, browser: Browser): Promise<string[]> {
  const page = await browser.newPage();
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Safari/537.36",
  );
  await page.goto(URL);

  await page.waitForSelector("#placardSec > div.placards");

  const links = await page.evaluate(() => {
    const element = document.querySelector("#placardSec > div.placards");
    const elements = Array.from(
      (element as HTMLElement).querySelectorAll("article"),
    );
    return elements.map(
      (element): string =>
        (element as HTMLAnchorElement).querySelector("a")!.href,
    );
  });
  await page.close();
  return links;
}
async function scrapeListing(
  URL: string,
  browser: Browser,
): Promise<CombinedData> {
  const page = await browser.newPage();
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Safari/537.36",
  );
  const park: CombinedData = {
    link: URL,
    status: "",
    name: "",
    state: "",
    county: "",
    street: "",
    zipcode: 0,
    price: 0,
    liked: false,
    parkData: [],
    images: [],
  };

  await page.goto(URL, { timeout: 120000, waitUntil: "load" });

  const name = await page.evaluate(() => {
    const nameElement = document.querySelector(
      "#dataSection > div.module.profile-wrapper > div.profile-hero-wrapper > section > div.profile-hero-heading-wrap.profile-hero-heading-wrap--kpi > div > h1 > span:nth-child(1)",
    );
    if (!nameElement) return "unnamed";
    const name = (nameElement as HTMLElement).innerText;
    return name ?? null;
  });

  if (name) {
    park.name = name;
  }

  const address = await page.evaluate((): string | null => {
    const addressElement = document.querySelector("#breadcrumb-section > h1");
    if (!addressElement) return null;
    const address = (addressElement as HTMLElement).innerText;
    return address ?? null;
  });
  if (address) {
    const addressArr = address.split(",");
    if (addressArr.length == 3 && addressArr[2]!.split(" ").length == 3) {
      park.street = addressArr[0]!.trim(); //TODO: this is so ugly
      park.county = addressArr[1]!.trim();
      park.state = addressArr[2]!.split(" ")[1]!.trim();
      const zipcode = addressArr[2]!.split(" ")[2]!.trim() as unknown as number;
      if (zipcode) {
        park.zipcode = zipcode;
      }
    }
  }

  const price = await page.evaluate(() => {
    const priceElement = document.querySelector(
      "#dataSection > div.module.profile-wrapper > div.profile-hero-wrapper > section > div.profile-hero-heading-wrap.profile-hero-heading-wrap--kpi > div > h2 > span:nth-child(2)",
    );
    if (!priceElement) return "0";
    return (priceElement as HTMLElement).innerText.split(" ")[0] ?? "0";
  });
  park.price = Number(price?.replace(/[$,]/g, ""));
  if (!park.price) park.price = 0;

  const brokerData = await page.evaluate(() => {
    const broker = document.querySelector(
      "#contact-form-contacts > li.contact",
    );
    return {
      key: "Broker",
      data: (broker as HTMLElement).title,
    };
  });
  park.parkData.push(brokerData);

  const detailData: ParkData[] = await page.evaluate(() => {
    const outArray: ParkData[] = [];
    const detailDataElement = document.querySelectorAll(
      "#dataSection > div.module.profile-wrapper > div.row.profile-content-margin.profile-content-wrapper.sticky-profile-content > div > div > div.column-08.column-ex-large-09.column-large-09.column-medium-09.profile-main-info > div.re-order > section.listing-features > div.row > div > table > tbody > tr > td",
    );
    if (!detailDataElement) throw new Error("Detail data not found at: " + URL);
    const label = [];
    const info: string[] = [];
    for (let i = 0; i < detailDataElement.length; i += 2) {
      if (!(detailDataElement[i] as HTMLElement).innerText.includes("Price")) {
        label.push((detailDataElement[i] as HTMLElement).innerText);
        info.push((detailDataElement[i + 1] as HTMLElement).innerText);
      }
    }
    label.forEach((label, index) => {
      if (label && info[index]) {
        outArray.push({
          key: label,
          data: info[index],
        });
      }
    });
    return outArray;
  });
  park.parkData.push(...detailData);

  const images = await page.evaluate(() => {
    const carousel = document.querySelector(".mosaic-carousel");
    const imageArr = carousel?.querySelectorAll(".mosaic-tile");

    const outArr = [];
    if (!imageArr) return [];
    for (const image of imageArr) {
      const pic = image.querySelector("img");
      if (pic) {
        const temp = image.querySelector("img");
        if (temp) {
          outArr.push(temp.src);
        }
      } else {
        outArr.push(image.getAttribute("data-src"));
      }
    }
    return outArr;
  });

  await page.close();

  const filteredImages = images.filter((img) => img !== null);

  park.images.push(...filteredImages);

  return park;
}

async function getLinks(): Promise<string[] | null> {
  const links = await db
    .select({
      link: parks.link,
    })
    .from(parks);
  return links
    .map((row) => row.link)
    .filter((link): link is string => link !== null);
}

export async function test() {
  console.log("HELLO");
  const browser = await puppeteer.launch();
  console.log(
    await scrapeListing(
      "https://www.loopnet.com/Listing/10-9th-Ave-Longmont-CO/32247804",
      browser,
    ),
  );
  await browser.close();
}

async function updateDB(combinedParks: CombinedData[]) {
  console.log("Updating DB");
  console.log(combinedParks);
  for (const combinedPark of combinedParks) {
    const park: MobileHomePark = {
      link: combinedPark.link,
      name: combinedPark.name,
      state: combinedPark.state,
      county: combinedPark.county,
      street: combinedPark.street,
      zipcode: combinedPark.zipcode,
      price: combinedPark.price,
      status: combinedPark.status,
      liked: combinedPark.liked,
    };
    console.log(park);
    const res = await db
      .insert(parks)
      .values(park)
      .onConflictDoNothing()
      .returning({ id: parks.id });

    for (const combinedData of combinedPark.parkData) {
      console.log(combinedData);
      if (!res[0]?.id || !combinedData.key || !combinedData.data) continue;
      const dataPark: dbParkData = {
        parkId: res[0].id,
        key: combinedData.key,
        data: combinedData.data,
      };
      await db.insert(parkData).values(dataPark).onConflictDoNothing();
    }
    const imageArr = [];
    for (const image of combinedPark.images) {
      if (!image) continue;
      imageArr.push({ parkId: res[0]!.id, data: image });
    }
    if (imageArr.length > 0) {
      await db.insert(parkImage).values(imageArr).onConflictDoNothing();
    }
  }
}
