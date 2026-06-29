// Temporary fallback images (Unsplash) used while real local photos are not
// uploaded yet, plus a final generic placeholder so the UI never breaks.

const UNSPLASH = (id: string) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=400&q=80`;

/** Generic food placeholder — last-resort image that should always load. */
export const FOOD_PLACEHOLDER = UNSPLASH("photo-1504674900247-0877df9cc836");

const BURGER = UNSPLASH("photo-1568901346375-23c9450c58cd");
const PIZZA = UNSPLASH("photo-1574071318508-1cdbab80d002");
const FRIED = UNSPLASH("photo-1639024471283-03518883512d");
const DRINK = UNSPLASH("photo-1608270586620-248524c67de9");
const FROZEN = UNSPLASH("photo-1488900128323-21503983a07e");
const SOUP = UNSPLASH("photo-1547592180-85f173990554");
const CREPE = UNSPLASH("photo-1519676867240-f03562e64548");

/** Map a category slug to a temporary stock image. */
export function categoryFallbackImage(slug: string | undefined | null): string {
  switch (slug) {
    case "burgers-classicos":
    case "burgers-smash":
      return BURGER;
    case "pizzas":
      return PIZZA;
    case "pasteis":
    case "petiscos":
      return FRIED;
    case "bebidas":
      return DRINK;
    case "gelados":
      return FROZEN;
    case "caldos":
      return SOUP;
    case "crepes":
      return CREPE;
    default:
      return FOOD_PLACEHOLDER;
  }
}

/** Returns the best initial image: the real one, or a category fallback. */
export function resolveInitialImage(
  imageUrl: string | undefined | null,
  slug: string | undefined | null,
): string {
  return imageUrl && imageUrl.trim() ? imageUrl : categoryFallbackImage(slug);
}
