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

export async function scrapeMHP() {
  console.log("Scraping Daily");

  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto(
    "https://www.mobilehomeparkstore.com/mobile-home-parks-for-sale/usa",
  );

  await page.waitForSelector(
    "#search-results > div.search-results-list > div:nth-child(3) > nav > ul > li:nth-child(6) > a",
  );

  const pages: number | null = await page.evaluate((): number | null => {
    const element = document.querySelector(
      "#search-results > div.search-results-list > div:nth-child(3) > nav > ul > li:nth-child(6) > a",
    );
    return element
      ? ((element as HTMLElement).innerText as unknown as number)
      : null;
  });
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
      `https://www.mobilehomeparkstore.com/mobile-home-parks-for-sale/usa/page/${i}?order=create_desc`,
      browser,
    );
    console.log(pagelinks);
    const listingsToScrape = pagelinks.filter(
      (link) => !listings!.some((listing) => listing === link),
    );
    listings = listings.filter(
      (link) => !pagelinks.some((listing) => listing === link),
    );

    if (listingsToScrape.length != 0) {
      const parkRes = [];
      for (const pageLink of listingsToScrape) {
        parkRes.push(await scrapeListing(pageLink, browser));
      }

      const parkResNulless = parkRes.filter((res) => res !== null);

      await updateDB(parkResNulless);
    }
  }
  await browser.close();
}

export async function scrapeSold() {
  console.log("Scraping Sold");

  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto(
    "https://www.mobilehomeparkstore.com/mobile-home-parks/sold/all/",
  );

  await page.waitForSelector(
    "#search-results > div.search-results-list > div:nth-child(3) > nav > ul > li:nth-child(6) > a",
  );

  const pages: number | null = await page.evaluate((): number | null => {
    const element = document.querySelector(
      "#search-results > div.search-results-list > div:nth-child(3) > nav > ul > li:nth-child(6) > a",
    );
    return element
      ? ((element as HTMLElement).innerText as unknown as number)
      : null;
  });
  console.log(pages);

  if (!pages) {
    throw new Error("Page number not found");
  }

  for (let i = 1; i <= pages; i++) {
    console.log("Scraping page " + i);
    const pagelinks: string[] = await scrape(
      `https://www.mobilehomeparkstore.com/mobile-home-parks/sold/all/page/${i}?order=create_desc`,
      browser,
    );
    console.log(pagelinks);
    if (pagelinks.length != 0) {
      const parkRes = [];
      for (const pageLink of pagelinks) {
        parkRes.push(await scrapeListing(pageLink, browser));
      }

      const parkResNulless = parkRes.filter((res) => res !== null);

      await updateDB(parkResNulless);
    }
  }
  await browser.close();
}

async function scrape(URL: string, browser: Browser): Promise<string[]> {
  const page = await browser.newPage();
  await page.goto(URL); // Replace with the actual URL

  await page.waitForSelector(".item-title");

  const links = await page.evaluate(() => {
    const elements = Array.from(document.querySelectorAll(".item-title"));
    return elements.map(
      (element): string => (element as HTMLAnchorElement).href,
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

  await page.goto(URL, { timeout: 120000 });

  await page.waitForSelector(".page-header");

  let nameLocation = await page.evaluate((): string | null => {
    const headerElement = document.querySelector(".page-header");
    if (!headerElement) return null;

    const nameElement = headerElement.querySelector('[itemprop="name"]');
    return nameElement ? (nameElement as HTMLElement).innerText : null;
  });
  if (!nameLocation?.split("\n")[1]) nameLocation = "No Info \n No Info";
  park.name = nameLocation.split("\n")[0];

  const addressFull = nameLocation.split("\n")[1]!.trim();
  if (addressFull) {
    const address = addressFull.split(",");
    switch (address.length) {
      case 1:
        const stateTemp = address[0]!.split(" ");
        if (stateTemp.length == 3) {
          park.state = stateTemp[2]!.substring(0, 2);
        }
        break;
      case 2:
        park.county = address[0]!.trim();
        park.state = address[1]!.trim();
        break;
      case 3:
        park.street = address[0]!.trim();
        park.county = address[1]!.trim();
        park.state = address[2]!.trim();
        break;
    }
    const zipTemp = park.state ? park.state.split(" ") : null;
    if (zipTemp && zipTemp.length > 1) {
      park.zipcode = zipTemp[1]!.trim() as unknown as number;
      park.state = zipTemp[0]!.trim();
    }
  }

  const price = await page.evaluate((): string | undefined => {
    const priceElement = document.querySelector(
      "#main > div.container > div.page-header.bordered.mb0 > div.row > div.col-fixed.text-right > h1",
    );
    return priceElement ? (priceElement as HTMLElement).innerText : undefined;
  });

  if (price) {
    const parkArr = price.split(" "); // TODO: This is a hack
    parkArr.forEach((parkArrItem) => {
      parkArrItem = parkArrItem.trim();
      switch (parkArrItem) {
        case "For":
          park.status = "For Sale";
          break;
        case "Sale":
          break;
        case "Pending":
          park.status = "Sale Pending";
          break;
        case "Sold":
          park.status = "Sold";
          break;
        case "Reduced":
          park.parkData.push({ key: "Reduced", data: "true" });
          break;
        case "Price":
          park.status = "Call for Price";
          break;
        case "for":
          park.status = "Call for Price";
          break;
        case "Call":
          park.status = "Call for Price";
          break;
        default:
          park.price = Number(parkArrItem.replace(/[$,]/g, ""));
          break;
      }
    });
  }

  const brokerData = await page.evaluate(() => {
    const brokerElement = document.querySelector(
      "#sidebar > div > div.card.shadow > h2",
    );
    const broker = brokerElement
      ? (brokerElement as HTMLElement).innerText
      : undefined;
    if (broker) {
      return { key: "Broker", data: broker };
    }
    return null;
  });
  if (brokerData) {
    park.parkData.push(brokerData);
  }

  const featureData: ParkData[] = await page.evaluate(() => {
    const outArray: ParkData[] = [];
    let featureListElement = document.querySelector(
      "#content > div.row.justify-content-md-center > div.col-fluid > div > div:nth-child(3) > ul",
    );
    if (!featureListElement) {
      featureListElement = document.querySelector(
        "#content > div.row.justify-content-md-center > div.col-fluid > div > div:nth-child(2) > ul",
      );
    }

    if (!featureListElement) return outArray;

    featureListElement.querySelectorAll("li").forEach((li) => {
      outArray.push({
        key: li.innerText.split(":")[0]!.trim(),
        data: li.innerText.split(":")[1]!.trim(),
      });
    });
    return outArray;
  });

  park.parkData.push(...featureData);

  const moreData = await page.evaluate(() => {
    const outArray: ParkData[] = [];
    let trHtml: NodeListOf<HTMLTableRowElement> | undefined = document
      .querySelector(
        "#content > div.row.justify-content-md-center > div.col-fluid > div > div:nth-child(3)",
      )
      ?.querySelectorAll("tr");

    if (!trHtml || trHtml.length === 0) {
      trHtml = document
        .querySelector(
          "#content > div.row.justify-content-md-center > div.col-fluid > div > div:nth-child(2)",
        )
        ?.querySelectorAll("tr");
    }

    if (trHtml) {
      trHtml.forEach((td) => {
        const item = td.innerText.split(":")[0];
        const desc = td.innerText.split(":")[1];
        outArray.push({ key: item!, data: desc! });
      });
    }
    return outArray;
  });
  park.parkData.push(...moreData);

  const images = await page.evaluate(() => {
    const imageArr = document.querySelectorAll(".swiper-image");

    if (!imageArr) return [];
    const outArr = [];

    for (const image of imageArr) {
      outArr.push(image.getAttribute("src"));
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
  /*const testing: MobileHomePark = {
    id: 0,
    name: "test",
    link: "test",
    state: "te",
    county: "test",
    street: "test",
    zipcode: 0,
    price: 0,
    status: "test",
    reduced: false,
    broker: "test",
    desc: "test",
    location: "test",
    occupancy: 0,
    lots: 0,
    yearbuilt: 0,
    size: 0,
    lotrent: 0,
    community: "test",
    water: "test",
    waterpaid: "test",
    sewer: "test",
    grossincome: 0,
    operatingexpenses: 0,
    operatingincome: 0,
    infotype: "test",
    caprate: 0,
    debt: "test",
    sglots: 0,
    dblots: 0,
    tplots: 0,
    pmlots: 0,
    parkowned: 0,
    avgrent: 0,
    rvlots: 0,
    rvlotrent: 0,
    purchasemethod: "test",
  };

  const tests: MobileHomePark[] = [];
  tests.push(testing);

  updateDB(tests)
    .then(() => console.log("done"))
    .catch(console.error);*/
  const browser = await puppeteer.launch();
  console.log(
    await scrapeListing(
      "https://www.mobilehomeparkstore.com/mobile-home-parks/6538572-lakeview-trailer-park-for-sale-in-mooringsport-la",
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
