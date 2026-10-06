import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "YolXəbər — yol dəyişiklikləri",
    short_name: "YolXəbər",
    description: "Yeni nişanlar, sürət limitləri və kameralar haqqında sürücülərdən bildirişlər.",
    lang: "az",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#F3F5F8",
    theme_color: "#F3F5F8",
    categories: ["navigation", "travel", "utilities"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Bildir", url: "/bildir", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Lent", url: "/lent", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
