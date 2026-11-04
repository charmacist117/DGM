const INGREDIENT_FIELDS = ["name", "content", "origin", "brand", "kilogramPriceRange"];

export function supplyIngredientCsvCells(ingredients = []) {
  const populated = (Array.isArray(ingredients) ? ingredients : []).filter((ingredient) => (
    INGREDIENT_FIELDS.some((field) => String(ingredient?.[field] ?? "").trim())
  ));
  return INGREDIENT_FIELDS.map((field) => populated.map((ingredient) => ingredient?.[field] ?? "").join("\n"));
}
