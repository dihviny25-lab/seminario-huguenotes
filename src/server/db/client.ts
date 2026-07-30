import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import * as schema from "./schema";

/**
 * Cliente HTTP do Neon: funciona tanto em Node (dev local) quanto no
 * runtime de Cloudflare Workers usado no deploy (nitro `cloudflare-module`),
 * já que não depende de uma conexão TCP persistente.
 */
function requireDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL não configurada. Copie .env.example para .env e preencha com a connection string do Neon.",
    );
  }
  return url;
}

export const db = drizzle(neon(requireDatabaseUrl()), { schema });
