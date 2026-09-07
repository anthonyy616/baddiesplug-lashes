interface Env {
  databaseUrl: string;
  authSecret: string;
  authUrl: string;
  resendApiKey: string;
  resendFromEmail: string;
  r2AccountId: string;
  r2AccessKeyId: string;
  r2SecretAccessKey: string;
  r2BucketName: string;
  r2PublicUrl: string;
  adminEmail: string;
  whatsappNumber: string;
  cronSecret: string;
}

function getEnv(): Env {
  const missing: string[] = [];

  const envVars = {
    DATABASE_URL: 'databaseUrl',
    AUTH_SECRET: 'authSecret',
    AUTH_URL: 'authUrl',
    RESEND_API_KEY: 'resendApiKey',
    R2_ACCOUNT_ID: 'r2AccountId',
    R2_ACCESS_KEY_ID: 'r2AccessKeyId',
    R2_SECRET_ACCESS_KEY: 'r2SecretAccessKey',
    R2_BUCKET_NAME: 'r2BucketName',
    ADMIN_EMAIL: 'adminEmail',
    WHATSAPP_NUMBER: 'whatsappNumber',
    CRON_SECRET: 'cronSecret',
  };

  for (const [envKey, propName] of Object.entries(envVars)) {
    if (!process.env[envKey]) {
      missing.push(envKey);
    }
  }

  if (missing.length > 0) {
    console.warn(`Warning: Missing environment variables: ${missing.join(', ')}`);
  }

  return {
    databaseUrl: process.env.DATABASE_URL ?? '',
    authSecret: process.env.AUTH_SECRET ?? '',
    authUrl: process.env.AUTH_URL ?? '',
    resendApiKey: process.env.RESEND_API_KEY ?? '',
    resendFromEmail: process.env.RESEND_FROM_EMAIL ?? 'noreply@baddiesplug.com',
    r2AccountId: process.env.R2_ACCOUNT_ID ?? '',
    r2AccessKeyId: process.env.R2_ACCESS_KEY_ID ?? '',
    r2SecretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? '',
    r2BucketName: process.env.R2_BUCKET_NAME ?? '',
    r2PublicUrl: process.env.R2_PUBLIC_URL ?? '',
    adminEmail: process.env.ADMIN_EMAIL ?? '',
    whatsappNumber: process.env.WHATSAPP_NUMBER ?? '',
    cronSecret: process.env.CRON_SECRET ?? '',
  };
}

const env = typeof process !== 'undefined' && 'env' in process
  ? getEnv()
  : ({} as Env);

export default env;
export type { Env };
