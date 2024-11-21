export async function getPuppeteer() {
  if (process.env.NODE_ENV === "production") {
    const puppeteerCore = await import("puppeteer-core");
    return {
      puppeteer: puppeteerCore,
      Browser: puppeteerCore.Browser,
    };
  } else {
    const puppeteerModule = await import("puppeteer");
    return {
      puppeteer: puppeteerModule.default,
      Browser: puppeteerModule.Browser,
    };
  }
}
