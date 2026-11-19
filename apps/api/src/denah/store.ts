import { randomUUID } from "node:crypto"
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"

import { paths } from "../paths.ts"
import type { DenahModel } from "./convert.ts"

export function saveModel(model: DenahModel) {
  mkdirSync(paths.denahModels, { recursive: true })
  const id = randomUUID()
  writeFileSync(join(paths.denahModels, `${id}.json`), JSON.stringify(model))
  return id
}

export function loadModel(id: string): DenahModel | null {
  // id hanya boleh UUID supaya tidak bisa dipakai membaca file lain.
  if (!/^[0-9a-f-]{36}$/.test(id)) return null
  try {
    return JSON.parse(readFileSync(join(paths.denahModels, `${id}.json`), "utf8")) as DenahModel
  } catch {
    return null
  }
}
