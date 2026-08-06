import catalog from "../src/data/sprites.json";
import { parseSharedLink } from "../src/scripts/share-codec";
import { buildSharePreview } from "../src/scripts/share-preview";

type PagesContext = {
  request: Request;
  next(): Promise<Response>;
};

type ElementHandler = {
  element(element: {
    setAttribute(name: string, value: string): void;
    setInnerContent(value: string): void;
  }): void;
};

declare class HTMLRewriter {
  on(selector: string, handler: ElementHandler): HTMLRewriter;
  transform(response: Response): Response;
}

const releasedIds = new Set(
  catalog.filter((sprite) => !sprite.unreleased).map((sprite) => sprite.id),
);

function content(value: string): ElementHandler {
  return { element: (element) => element.setAttribute("content", value) };
}

export async function onRequest(context: PagesContext): Promise<Response> {
  const url = new URL(context.request.url);
  const shared = parseSharedLink(url.search, releasedIds);
  if (!shared) return context.next();

  const response = await context.next();
  if (!response.headers.get("content-type")?.includes("text/html")) return response;

  const preview = buildSharePreview(shared, releasedIds.size);
  return new HTMLRewriter()
    .on("title", { element: (element) => element.setInnerContent(preview.title) })
    .on('meta[name="description"]', content(preview.description))
    .on('meta[property="og:url"]', content(url.toString()))
    .on('meta[property="og:title"]', content(preview.title))
    .on('meta[property="og:description"]', content(preview.description))
    .on('meta[name="twitter:title"]', content(preview.title))
    .on('meta[name="twitter:description"]', content(preview.description))
    .transform(response);
}
