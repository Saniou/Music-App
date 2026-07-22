// Spotify playlist descriptions can contain HTML entities and tags.
export const decodeHtml = (html) => {
  if (!html) return "";
  const decoded = html
    .replace(/&#x2F;/g, "/")
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
  return decoded.replace(/<[^>]*>/g, "");
};
