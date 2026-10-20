export const meta = (title: string, description: string) => ({
  meta: [
    { title: `${title} · XAUUSDc Terminal` },
    { name: "description", content: description },
    { property: "og:title", content: `${title} · XAUUSDc Terminal` },
    { property: "og:description", content: description },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ],
});
