import { z } from "zod";
import { latLngSchema } from "@/lib/api";
import { CATEGORY_KEYS } from "@/lib/categories";

/** Yaratma və redaktə formasının ortaq sahələri */
export const reportFieldsSchema = latLngSchema.extend({
  category: z.enum(CATEGORY_KEYS),
  note: z.string().trim().max(280).default(""),
  // İstifadəçinin əl ilə yazdığı ünvan (istəyə bağlı); boşdursa koordinatdan təyin olunur
  address: z
    .string()
    .trim()
    .max(120)
    .transform((v) => v.replace(/\s+/g, " ") || undefined)
    .optional(),
});

/** Formdan sahələri oxuyur */
export function parseReportFields(form: FormData) {
  return reportFieldsSchema.parse({
    category: form.get("category"),
    note: form.get("note") ?? "",
    lat: form.get("lat"),
    lng: form.get("lng"),
    address: form.get("address") ?? undefined,
  });
}
