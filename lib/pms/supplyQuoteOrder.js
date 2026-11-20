export function compareSupplyQuotes(left, right) {
  if (left.empty !== right.empty) return left.empty ? -1 : 1;
  if (left.quoteDate !== right.quoteDate) {
    if (!left.quoteDate) return 1;
    if (!right.quoteDate) return -1;
    return right.quoteDate.localeCompare(left.quoteDate);
  }
  return right.createdAt.localeCompare(left.createdAt);
}
