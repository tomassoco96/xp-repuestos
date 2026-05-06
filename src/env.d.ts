/// <reference types="astro/client" />

interface ImportMetaEnv {
  // Public (expuestas al cliente — nunca poner secrets acá)
  readonly PUBLIC_SITE_URL: string;
  readonly PUBLIC_MP_PUBLIC_KEY: string;

  // Server-only (jamás se mandan al bundle del cliente)
  readonly MP_ACCESS_TOKEN: string;
  readonly MP_WEBHOOK_SECRET: string;
  readonly RESEND_API_KEY: string;
  readonly EMAIL_FROM: string;
  readonly ADMIN_NOTIFY_EMAIL: string;
  readonly ANTHROPIC_API_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
