CREATE SCHEMA "public";
CREATE SCHEMA "drizzle";
CREATE SCHEMA "neon_auth";
CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" uuid NOT NULL,
	"type" varchar(255) NOT NULL,
	"provider" varchar(255) NOT NULL,
	"provider_account_id" varchar(255) NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,	
	"token_type" varchar(255),
	"scope" varchar(255),
	"id_token" text,
	"session_state" varchar(255),
	"created_at" timestamp with time zone,
	"updated_at" timestamp with time zone
);
CREATE TABLE "addons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"name" varchar(255) NOT NULL,
	"description" text NOT NULL,
	"price" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE "admin_auth" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"username" varchar(255) NOT NULL CONSTRAINT "admin_auth_username_unique" UNIQUE,
	"password_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE "availability_overrides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"date" varchar(10) NOT NULL,
	"start_time" varchar(5) NOT NULL,
	"end_time" varchar(5) NOT NULL,
	"mode" varchar(20) NOT NULL,
	"reason" varchar(500),
	"created_by_admin_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE "booking_addons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"booking_id" uuid NOT NULL,
	"addon_id" uuid NOT NULL,
	"addon_name_snapshot" varchar(255) NOT NULL,
	"unit_price_snapshot" integer NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE "booking_services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"booking_id" uuid NOT NULL,
	"service_id" uuid NOT NULL,
	"service_name_snapshot" varchar(255) NOT NULL,
	"unit_price_snapshot" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE "bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"reference" varchar(50) NOT NULL CONSTRAINT "bookings_reference_unique" UNIQUE,
	"customer_id" uuid NOT NULL,
	"appointment_date" varchar(10) NOT NULL,
	"start_time" varchar(5) NOT NULL,
	"end_time" varchar(5) NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"phone" varchar(20) NOT NULL,
	"customer_notes" text,
	"subtotal" integer NOT NULL,
	"deposit_required" integer NOT NULL,
	"total" integer NOT NULL,
	"previous_booking_id" uuid,
	"created_by_admin_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"cancelled_at" timestamp with time zone,
	"completed_at" timestamp with time zone
);
CREATE TABLE "credentials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"auth_user_id" uuid NOT NULL CONSTRAINT "credentials_auth_user_id_unique" UNIQUE,
	"password_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE "email_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"event_type" varchar(100) NOT NULL,
	"booking_id" uuid,
	"recipient" varchar(255) NOT NULL,
	"payload" text NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" varchar(1000),
	"scheduled_for" timestamp with time zone NOT NULL,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE "gallery_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"storage_key" varchar(500) NOT NULL,
	"public_url" varchar(500) NOT NULL,
	"caption" varchar(120),
	"alt_text" varchar(255),
	"display_order" integer DEFAULT 0 NOT NULL,
	"width" integer,
	"height" integer,
	"uploaded_by" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE "homepage_media" (
	"slot" varchar(50) PRIMARY KEY,
	"storage_key" varchar(500) NOT NULL,
	"public_url" varchar(500) NOT NULL,
	"alt_text" varchar(255),
	"width" integer,
	"height" integer,
	"uploaded_by" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"type" varchar(100) NOT NULL,
	"booking_id" uuid,
	"customer_id" uuid,
	"title" varchar(255) NOT NULL,
	"message" text NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"read_at" timestamp with time zone
);
CREATE TABLE "password_reset_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"identifier" varchar(255) NOT NULL,
	"token" varchar(128) NOT NULL CONSTRAINT "password_reset_tokens_token_unique" UNIQUE,
	"expires" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"booking_id" uuid NOT NULL,
	"amount" integer NOT NULL,
	"payment_type" varchar(20) NOT NULL,
	"note" varchar(500),
	"recorded_by_admin_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE "reference_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"booking_id" uuid NOT NULL,
	"storage_key" varchar(500) NOT NULL,
	"original_filename" varchar(255) NOT NULL,
	"mime_type" varchar(50) NOT NULL,
	"size_bytes" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE "service_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"service_id" uuid NOT NULL,
	"storage_key" varchar(500) NOT NULL,
	"public_url" varchar(500) NOT NULL,
	"alt_text" varchar(255),
	"display_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE "services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"name" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL CONSTRAINT "services_slug_unique" UNIQUE,
	"category" varchar(50) NOT NULL,
	"description" text NOT NULL,
	"notes" text NOT NULL,
	"price" integer NOT NULL,
	"duration_minutes" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"is_featured" boolean DEFAULT false NOT NULL
);
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"session_token" varchar(255) NOT NULL CONSTRAINT "sessions_session_token_unique" UNIQUE,
	"user_id" uuid NOT NULL,
	"expires" timestamp with time zone NOT NULL
);
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"auth_user_id" uuid NOT NULL CONSTRAINT "users_auth_user_id_unique" UNIQUE,
	"name" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"phone" varchar(20),
	"role" varchar(20) DEFAULT 'customer' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
CREATE TABLE "verification_tokens" (
	"identifier" varchar(255) NOT NULL,
	"token" varchar(255) NOT NULL CONSTRAINT "verification_tokens_token_unique" UNIQUE,
	"expires" timestamp with time zone NOT NULL
);
CREATE TABLE "drizzle"."__drizzle_migrations" (
	"id" serial PRIMARY KEY,
	"hash" text NOT NULL,
	"created_at" bigint
);
CREATE TABLE "neon_auth"."account" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"accountId" text NOT NULL,
	"providerId" text NOT NULL,
	"userId" uuid NOT NULL,
	"accessToken" text,
	"refreshToken" text,
	"idToken" text,
	"accessTokenExpiresAt" timestamp with time zone,
	"refreshTokenExpiresAt" timestamp with time zone,
	"scope" text,
	"password" text,
	"createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp with time zone NOT NULL
);
CREATE TABLE "neon_auth"."invitation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"organizationId" uuid NOT NULL,
	"email" text NOT NULL,
	"role" text,
	"status" text NOT NULL,
	"expiresAt" timestamp with time zone NOT NULL,
	"createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"inviterId" uuid NOT NULL
);
CREATE TABLE "neon_auth"."jwks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"publicKey" text NOT NULL,
	"privateKey" text NOT NULL,
	"createdAt" timestamp with time zone NOT NULL,
	"expiresAt" timestamp with time zone
);
CREATE TABLE "neon_auth"."member" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"organizationId" uuid NOT NULL,
	"userId" uuid NOT NULL,
	"role" text NOT NULL,
	"createdAt" timestamp with time zone NOT NULL
);
CREATE TABLE "neon_auth"."organization" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"name" text NOT NULL,
	"slug" text NOT NULL CONSTRAINT "organization_slug_key" UNIQUE,
	"logo" text,
	"createdAt" timestamp with time zone NOT NULL,
	"metadata" text
);
CREATE TABLE "neon_auth"."project_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"name" text NOT NULL,
	"endpoint_id" text NOT NULL CONSTRAINT "project_config_endpoint_id_key" UNIQUE,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"trusted_origins" jsonb NOT NULL,
	"social_providers" jsonb NOT NULL,
	"email_provider" jsonb,
	"email_and_password" jsonb,
	"allow_localhost" boolean NOT NULL,
	"plugin_configs" jsonb,
	"webhook_config" jsonb
);
CREATE TABLE "neon_auth"."session" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"expiresAt" timestamp with time zone NOT NULL,
	"token" text NOT NULL CONSTRAINT "session_token_key" UNIQUE,
	"createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp with time zone NOT NULL,
	"ipAddress" text,
	"userAgent" text,
	"userId" uuid NOT NULL,
	"impersonatedBy" text,
	"activeOrganizationId" text
);
CREATE TABLE "neon_auth"."user" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"name" text NOT NULL,
	"email" text NOT NULL CONSTRAINT "user_email_key" UNIQUE,
	"emailVerified" boolean NOT NULL,
	"image" text,
	"createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"role" text,
	"banned" boolean,
	"banReason" text,
	"banExpires" timestamp with time zone
);
CREATE TABLE "neon_auth"."verification" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expiresAt" timestamp with time zone NOT NULL,
	"createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE UNIQUE INDEX "accounts_pkey" ON "accounts" ("id");
CREATE UNIQUE INDEX "accounts_provider_providerAccountId_unique" ON "accounts" ("provider","provider_account_id");
CREATE INDEX "accounts_userId_idx" ON "accounts" ("user_id");
CREATE INDEX "addons_display_order_idx" ON "addons" ("display_order");
CREATE INDEX "addons_is_active_idx" ON "addons" ("is_active");
CREATE UNIQUE INDEX "addons_pkey" ON "addons" ("id");
CREATE UNIQUE INDEX "admin_auth_pkey" ON "admin_auth" ("id");
CREATE UNIQUE INDEX "admin_auth_username_unique" ON "admin_auth" ("username");
CREATE INDEX "availability_overrides_date_idx" ON "availability_overrides" ("date");
CREATE UNIQUE INDEX "availability_overrides_pkey" ON "availability_overrides" ("id");
CREATE INDEX "booking_addons_addon_id_idx" ON "booking_addons" ("addon_id");
CREATE INDEX "booking_addons_booking_id_idx" ON "booking_addons" ("booking_id");
CREATE UNIQUE INDEX "booking_addons_pkey" ON "booking_addons" ("id");
CREATE INDEX "booking_services_booking_id_idx" ON "booking_services" ("booking_id");
CREATE UNIQUE INDEX "booking_services_pkey" ON "booking_services" ("id");
CREATE INDEX "booking_services_service_id_idx" ON "booking_services" ("service_id");
CREATE UNIQUE INDEX "active_booking_slot_unique" ON "bookings" ("appointment_date","start_time","end_time");
CREATE INDEX "bookings_appointment_date_idx" ON "bookings" ("appointment_date");
CREATE INDEX "bookings_created_at_idx" ON "bookings" ("created_at");
CREATE INDEX "bookings_customer_id_idx" ON "bookings" ("customer_id");
CREATE UNIQUE INDEX "bookings_pkey" ON "bookings" ("id");
CREATE UNIQUE INDEX "bookings_reference_unique" ON "bookings" ("reference");
CREATE INDEX "bookings_status_idx" ON "bookings" ("status");
CREATE UNIQUE INDEX "credentials_auth_user_id_unique" ON "credentials" ("auth_user_id");
CREATE UNIQUE INDEX "credentials_pkey" ON "credentials" ("id");
CREATE INDEX "email_events_booking_id_idx" ON "email_events" ("booking_id");
CREATE UNIQUE INDEX "email_events_pkey" ON "email_events" ("id");
CREATE INDEX "email_events_status_scheduled_for_idx" ON "email_events" ("status","scheduled_for");
CREATE INDEX "gallery_images_display_order_idx" ON "gallery_images" ("display_order");
CREATE UNIQUE INDEX "gallery_images_pkey" ON "gallery_images" ("id");
CREATE UNIQUE INDEX "homepage_media_pkey" ON "homepage_media" ("slot");
CREATE INDEX "notifications_booking_id_idx" ON "notifications" ("booking_id");
CREATE INDEX "notifications_created_at_idx" ON "notifications" ("created_at");
CREATE INDEX "notifications_customer_id_idx" ON "notifications" ("customer_id");
CREATE INDEX "notifications_is_read_idx" ON "notifications" ("is_read");
CREATE UNIQUE INDEX "notifications_pkey" ON "notifications" ("id");
CREATE INDEX "password_reset_tokens_identifier_idx" ON "password_reset_tokens" ("identifier");
CREATE UNIQUE INDEX "password_reset_tokens_pkey" ON "password_reset_tokens" ("id");
CREATE UNIQUE INDEX "password_reset_tokens_token_unique" ON "password_reset_tokens" ("token");
CREATE INDEX "payments_booking_id_idx" ON "payments" ("booking_id");
CREATE UNIQUE INDEX "payments_pkey" ON "payments" ("id");
CREATE INDEX "reference_images_booking_id_idx" ON "reference_images" ("booking_id");
CREATE INDEX "reference_images_expires_at_idx" ON "reference_images" ("expires_at");
CREATE UNIQUE INDEX "reference_images_pkey" ON "reference_images" ("id");
CREATE INDEX "service_images_display_order_idx" ON "service_images" ("display_order");
CREATE UNIQUE INDEX "service_images_pkey" ON "service_images" ("id");
CREATE INDEX "service_images_service_id_idx" ON "service_images" ("service_id");
CREATE INDEX "services_category_idx" ON "services" ("category");
CREATE INDEX "services_deleted_at_idx" ON "services" ("deleted_at");
CREATE INDEX "services_display_order_idx" ON "services" ("display_order");
CREATE INDEX "services_is_active_idx" ON "services" ("is_active");
CREATE INDEX "services_is_featured_idx" ON "services" ("is_featured");
CREATE UNIQUE INDEX "services_pkey" ON "services" ("id");
CREATE UNIQUE INDEX "services_slug_unique" ON "services" ("slug");
CREATE UNIQUE INDEX "sessions_pkey" ON "sessions" ("id");
CREATE UNIQUE INDEX "sessions_session_token_unique" ON "sessions" ("session_token");
CREATE INDEX "sessions_userId_idx" ON "sessions" ("user_id");
CREATE UNIQUE INDEX "users_auth_user_id_unique" ON "users" ("auth_user_id");
CREATE INDEX "users_deleted_at_idx" ON "users" ("deleted_at");
CREATE INDEX "users_email_idx" ON "users" ("email");
CREATE UNIQUE INDEX "users_pkey" ON "users" ("id");
CREATE INDEX "users_role_idx" ON "users" ("role");
CREATE UNIQUE INDEX "verification_tokens_identifier_token_unique" ON "verification_tokens" ("identifier","token");
CREATE UNIQUE INDEX "verification_tokens_token_unique" ON "verification_tokens" ("token");
CREATE UNIQUE INDEX "__drizzle_migrations_pkey" ON "drizzle"."__drizzle_migrations" ("id");
CREATE UNIQUE INDEX "account_pkey" ON "neon_auth"."account" ("id");
CREATE INDEX "account_userId_idx" ON "neon_auth"."account" ("userId");
CREATE INDEX "invitation_email_idx" ON "neon_auth"."invitation" ("email");
CREATE INDEX "invitation_organizationId_idx" ON "neon_auth"."invitation" ("organizationId");
CREATE UNIQUE INDEX "invitation_pkey" ON "neon_auth"."invitation" ("id");
CREATE UNIQUE INDEX "jwks_pkey" ON "neon_auth"."jwks" ("id");
CREATE INDEX "member_organizationId_idx" ON "neon_auth"."member" ("organizationId");
CREATE UNIQUE INDEX "member_pkey" ON "neon_auth"."member" ("id");
CREATE INDEX "member_userId_idx" ON "neon_auth"."member" ("userId");
CREATE UNIQUE INDEX "organization_pkey" ON "neon_auth"."organization" ("id");
CREATE UNIQUE INDEX "organization_slug_key" ON "neon_auth"."organization" ("slug");
CREATE UNIQUE INDEX "organization_slug_uidx" ON "neon_auth"."organization" ("slug");
CREATE UNIQUE INDEX "project_config_endpoint_id_key" ON "neon_auth"."project_config" ("endpoint_id");
CREATE UNIQUE INDEX "project_config_pkey" ON "neon_auth"."project_config" ("id");
CREATE UNIQUE INDEX "session_pkey" ON "neon_auth"."session" ("id");
CREATE UNIQUE INDEX "session_token_key" ON "neon_auth"."session" ("token");
CREATE INDEX "session_userId_idx" ON "neon_auth"."session" ("userId");
CREATE UNIQUE INDEX "user_email_key" ON "neon_auth"."user" ("email");
CREATE UNIQUE INDEX "user_pkey" ON "neon_auth"."user" ("id");
CREATE INDEX "verification_identifier_idx" ON "neon_auth"."verification" ("identifier");
CREATE UNIQUE INDEX "verification_pkey" ON "neon_auth"."verification" ("id");
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
ALTER TABLE "booking_addons" ADD CONSTRAINT "booking_addons_addon_id_addons_id_fk" FOREIGN KEY ("addon_id") REFERENCES "addons"("id") ON DELETE RESTRICT;
ALTER TABLE "booking_addons" ADD CONSTRAINT "booking_addons_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE;
ALTER TABLE "booking_services" ADD CONSTRAINT "booking_services_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE;
ALTER TABLE "booking_services" ADD CONSTRAINT "booking_services_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE RESTRICT;
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_customer_id_users_id_fk" FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "payments" ADD CONSTRAINT "payments_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT;
ALTER TABLE "reference_images" ADD CONSTRAINT "reference_images_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE;
ALTER TABLE "service_images" ADD CONSTRAINT "service_images_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE CASCADE;
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
ALTER TABLE "neon_auth"."account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "neon_auth"."user"("id") ON DELETE CASCADE;
ALTER TABLE "neon_auth"."invitation" ADD CONSTRAINT "invitation_inviterId_fkey" FOREIGN KEY ("inviterId") REFERENCES "neon_auth"."user"("id") ON DELETE CASCADE;
ALTER TABLE "neon_auth"."invitation" ADD CONSTRAINT "invitation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "neon_auth"."organization"("id") ON DELETE CASCADE;
ALTER TABLE "neon_auth"."member" ADD CONSTRAINT "member_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "neon_auth"."organization"("id") ON DELETE CASCADE;
ALTER TABLE "neon_auth"."member" ADD CONSTRAINT "member_userId_fkey" FOREIGN KEY ("userId") REFERENCES "neon_auth"."user"("id") ON DELETE CASCADE;
ALTER TABLE "neon_auth"."session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "neon_auth"."user"("id") ON DELETE CASCADE;