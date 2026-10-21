// Read the raw route so React Router's encoded-slash normalization cannot turn a
// literal "%2F" in a provider's model name into a different model.
export function modelNameFromPricingPath(pathname: string): string | null {
  const match = /^\/(?:console\/)?pricing\/model\/(.*)$/.exec(pathname);
  if (!match) return null;
  try { return decodeURIComponent(match[1]); } catch { return null; }
}
