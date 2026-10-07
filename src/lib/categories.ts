import type { IconName } from "@/components/ui/Icon";

export const CATEGORY_KEYS = ["nisan", "surat", "kamera", "zolaq", "donus", "park", "stop", "diger"] as const;
export type CategoryKey = (typeof CATEGORY_KEYS)[number];

export type CategoryMeta = {
  key: CategoryKey;
  name: string;
  short: string;
  /** Pin / ikon fonu */
  color: string;
  /** Fon üzərindəki ikon rəngi */
  fg: string;
  /** Açıq fonda mətn rəngi (lent kartında kateqoriya adı) */
  text: string;
  icon: IconName;
};

// Rənglər dizayndakı CATS obyektindən götürülüb.
export const CATEGORIES: Record<CategoryKey, CategoryMeta> = {
  nisan: { key: "nisan", name: "Yeni nişan", short: "Nişan", color: "#F5B800", fg: "#1F1500", text: "#8A5F00", icon: "nisan" },
  surat: { key: "surat", name: "Sürət limiti dəyişib", short: "Sürət", color: "#D7262E", fg: "#fff", text: "#C01F27", icon: "surat" },
  kamera: { key: "kamera", name: "Yeni kamera", short: "Kamera", color: "#0E7C86", fg: "#fff", text: "#0B6B74", icon: "kamera" },
  zolaq: { key: "zolaq", name: "Xətt / zolaq dəyişikliyi", short: "Zolaq", color: "#EA6A12", fg: "#fff", text: "#B9500A", icon: "zolaq" },
  donus: { key: "donus", name: "Dönüş qadağası", short: "Dönüş", color: "#9F1239", fg: "#fff", text: "#9F1239", icon: "donus" },
  park: { key: "park", name: "Dayanma / parklanma", short: "Parklanma", color: "#1D5BD8", fg: "#fff", text: "#1D4FB8", icon: "park" },
  stop: { key: "stop", name: "Stop nişanının tələbi pozulması", short: "Stop", color: "#7F1D1D", fg: "#fff", text: "#7F1D1D", icon: "stop" },
  diger: { key: "diger", name: "Digər", short: "Digər", color: "#5B6678", fg: "#fff", text: "#4A5466", icon: "diger" },
};

export const CATEGORY_LIST = CATEGORY_KEYS.map((k) => CATEGORIES[k]);
