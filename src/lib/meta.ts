export const meta = (title: string, description: string) => ({
  meta: [
    { title: `${title} · Multi Asset Terminal` },
    { name: "description", content: description },
    { property: "og:title", content: `${title} · Multi Asset Terminal` },
    { property: "og:description", content: description },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ],
});
