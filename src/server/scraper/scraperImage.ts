import puppeteer from "puppeteer";
import { type Browser } from "puppeteer";
import { db } from "../server/db/index";
import { parks, parkImage } from "../server/db/schema";
type ImageLinks = {
  data: string;
  parkId: number;
};

export async function scrapeImage() {
  const browser = await puppeteer.launch({ headless: false });

  let listings = await getLinks();
  if (!listings) listings = [];
  for (const listing of listings) {
    try {
      const imageArr = [];
      if (listing.link?.includes("crexi")) {
        imageArr.push(...(await scrapeCrexi({ listing, browser })));
      } else if (listing.link?.includes("loopnet")) {
        imageArr.push(...(await scrapeLoopNet({ listing, browser })));
      } else if (listing.link?.includes("mobilehomeparkstore")) {
        imageArr.push(...(await scrapeMHP({ listing, browser })));
      }
      const filteredArr = imageArr.filter(
        (img) => img.data != null && img.data != undefined,
      );
      if (filteredArr.length === 0) continue;
      console.log(filteredArr);
      await updateDB(filteredArr as ImageLinks[]);
    } catch (e) {
      console.log(e);
    }
  }

  await browser.close();
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function scrapeCrexi({
  listing,
  browser,
}: {
  listing: { link: string | null; id: number };
  browser: Browser;
}) {
  console.log("CREXI");
  const page = await browser.newPage();
  await page.goto(listing.link!, {
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
      console.log("1 image only");
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
  const outArr = images.map((img) => ({ data: img, parkId: listing.id }));
  return outArr;
}

async function scrapeMHP({
  listing,
  browser,
}: {
  listing: { link: string | null; id: number };
  browser: Browser;
}) {
  console.log("MHP");
  const page = await browser.newPage();
  await page.goto(listing.link!, { waitUntil: "networkidle2" });
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
  const outArr = images.map((img) => ({ data: img, parkId: listing.id }));
  return outArr;
}

async function scrapeLoopNet({
  listing,
  browser,
}: {
  listing: { link: string | null; id: number };
  browser: Browser;
}) {
  console.log("LOOP");
  const page = await browser.newPage();
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Safari/537.36",
  );
  await page.goto(listing.link!, { waitUntil: "networkidle2" });
  const images = await page.evaluate(() => {
    const carousel = document.querySelector(".mosaic-carousel");
    const imageArr = carousel?.querySelectorAll(".mosaic-tile");

    const outArr = [];
    if (!imageArr) return [];
    for (const image of imageArr) {
      const pic = image.querySelector("img");
      if (pic) {
        outArr.push(image.querySelector("img")?.src);
      } else {
        outArr.push(image.getAttribute("data-src"));
      }
    }
    return outArr;
  });
  await page.close();

  const outArr = images.map((img) => ({ data: img, parkId: listing.id }));
  return outArr;
}

async function getLinks() {
  const links = await db.query.parks.findMany({
    columns: {
      link: true,
      id: true,
    },
    with: {
      parkImage: true,
    },
  });

  const outArr = links
    .map((link) => {
      if (link.parkImage.length <= 0) {
        return {
          link: link.link,
          id: link.id,
        };
      }
      return null;
    })
    .filter((item) => item !== null);

  console.log(outArr);
  return outArr;
}

async function updateDB(imageLinks: ImageLinks[]) {
  await db.insert(parkImage).values(imageLinks).onConflictDoNothing();
}
