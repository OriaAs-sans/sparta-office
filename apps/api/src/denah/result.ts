import { z } from "zod"

export const denahResultSchema = z.object({
  ringkasan: z.string(),
  model_id: z.string(),
  lebar_m: z.number(),
  panjang_m: z.number(),
  luas_bounding_m2: z.number(),
  panjang_garis_dinding_m: z.number(),
  jumlah_garis: z.number(),
  layer: z.array(z.object({ name: z.string(), segments: z.number() })),
  layer_dinding: z.array(z.string()),
  satuan: z.string(),
  catatan: z.array(z.string()).default([]),
})

export type DenahResult = z.infer<typeof denahResultSchema>
