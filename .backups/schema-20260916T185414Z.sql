


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pg_trgm" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."call_result" AS ENUM (
    'gatekeeper_reached',
    'interested',
    'appointment_booked',
    'no_interest',
    'no_answer'
);


ALTER TYPE "public"."call_result" OWNER TO "postgres";


CREATE TYPE "public"."call_type" AS ENUM (
    'setting_call',
    'closing_call',
    'follow_up_call'
);


ALTER TYPE "public"."call_type" OWNER TO "postgres";


CREATE TYPE "public"."user_role" AS ENUM (
    'admin',
    'employee'
);


ALTER TYPE "public"."user_role" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_get_users"() RETURNS TABLE("id" "uuid", "email" "text", "first_name" "text", "last_name" "text", "role" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Nur Administratoren dürfen Benutzer anzeigen.';
  END IF;

  RETURN QUERY
  SELECT 
    profiles.id,
    profiles.email,
    profiles.first_name,
    profiles.last_name,
    profiles.role
  FROM profiles
  ORDER BY profiles.email;
END;
$$;


ALTER FUNCTION "public"."admin_get_users"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_set_user_role"("user_id" "uuid", "new_role" "text") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Prüfe ob der Aufrufer Admin ist
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Nur Administratoren dürfen Rollen ändern.';
  END IF;

  -- Prüfe ob die Rolle gültig ist
  IF new_role NOT IN ('admin', 'employee') THEN
    RAISE EXCEPTION 'Ungültige Rolle: %', new_role;
  END IF;

  -- Rolle aktualisieren
  UPDATE profiles 
  SET role = new_role 
  WHERE id = user_id;

  RETURN 'Rolle erfolgreich geändert.';
END;
$$;


ALTER FUNCTION "public"."admin_set_user_role"("user_id" "uuid", "new_role" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_old_notification_jobs"() RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM public.notification_jobs
  WHERE created_at < now() - interval '30 days';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;


ALTER FUNCTION "public"."cleanup_old_notification_jobs"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_deal_stage_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  IF OLD.stage_id IS DISTINCT FROM NEW.stage_id THEN
    INSERT INTO deal_stage_history (deal_id, from_stage_id, to_stage_id)
    VALUES (NEW.id, OLD.stage_id, NEW.stage_id);
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_deal_stage_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_contact"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_pipeline_id UUID;
  v_first_stage_id UUID;
BEGIN
  SELECT id INTO v_pipeline_id FROM pipelines WHERE is_default = true LIMIT 1;
  IF v_pipeline_id IS NULL THEN
    SELECT id INTO v_pipeline_id FROM pipelines ORDER BY created_at ASC LIMIT 1;
  END IF;

  IF v_pipeline_id IS NOT NULL THEN
    SELECT id INTO v_first_stage_id
    FROM deal_stages
    WHERE pipeline_id = v_pipeline_id
    ORDER BY position ASC
    LIMIT 1;

    IF v_first_stage_id IS NOT NULL THEN
      INSERT INTO deals (name, pipeline_id, stage_id, contact_id, value)
      VALUES (
        TRIM(NEW.first_name || ' ' || NEW.last_name),
        v_pipeline_id,
        v_first_stage_id,
        NEW.id,
        0
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_contact"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, first_name, last_name, role)
  VALUES (
    NEW.id, 
    NEW.email, 
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'first_name', SPLIT_PART(NEW.raw_user_meta_data->>'full_name', ' ', 1), ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', SUBSTRING(NEW.raw_user_meta_data->>'full_name' FROM POSITION(' ' IN NEW.raw_user_meta_data->>'full_name') + 1), ''),
    'employee'
  );
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin"() RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
    and role = 'admin'
  );
$$;


ALTER FUNCTION "public"."is_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prevent_role_self_escalation"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Prüfe ob der Aufrufer Admin ist
  IF NEW.role != OLD.role AND 
     (SELECT role FROM profiles WHERE id = auth.uid()) != 'admin' THEN
    RAISE EXCEPTION 'Nur Administratoren dürfen Rollen ändern.';
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."prevent_role_self_escalation"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."activities" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "contact_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "description" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "activities_type_check" CHECK (("type" = ANY (ARRAY['email_sent'::"text", 'email_failed'::"text", 'email_bounced'::"text", 'email_complained'::"text", 'whatsapp_sent'::"text", 'whatsapp_failed'::"text", 'whatsapp_bounced'::"text"])))
);


ALTER TABLE "public"."activities" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."call_logs" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "contact_id" "uuid",
    "deal_id" "uuid",
    "user_id" "uuid",
    "call_type" "public"."call_type" NOT NULL,
    "call_result" "public"."call_result",
    "call_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "call_time" time without time zone DEFAULT CURRENT_TIME NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "interest_expressed" boolean,
    "called_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."call_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."companies" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL,
    "website" "text",
    "address" "text",
    "city" "text",
    "postal_code" "text",
    "country" "text",
    "industry" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."companies" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."contacts" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "first_name" "text",
    "last_name" "text",
    "email" "text",
    "phone" "text",
    "company_id" "uuid",
    "is_primary_contact" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "company" "text",
    "status" "text" DEFAULT 'Lead'::"text",
    "notes" "text",
    "country" "text" DEFAULT 'Deutschland'::"text",
    "address" "text",
    "city" "text",
    "zip_code" "text",
    "position" "text",
    "last_contacted_at" timestamp with time zone,
    "assigned_to" "uuid",
    "website" "text",
    "full_name" "text",
    "name" "text",
    "industry" "text",
    "email_opt_in" boolean DEFAULT false NOT NULL,
    "whatsapp_opt_in" boolean DEFAULT false NOT NULL,
    "email_bounce_reason" "text",
    "email_bounced_at" timestamp with time zone,
    "email_complained_at" timestamp with time zone
);


ALTER TABLE "public"."contacts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."deal_stage_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "deal_id" "uuid" NOT NULL,
    "from_stage_id" "uuid",
    "to_stage_id" "uuid",
    "changed_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."deal_stage_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."deal_stages" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "pipeline_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "color" "text" DEFAULT '#6B7280'::"text" NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL
);


ALTER TABLE "public"."deal_stages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."deals" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text",
    "pipeline_id" "uuid" NOT NULL,
    "deal_stage_id" "uuid",
    "contact_id" "uuid",
    "company_id" "uuid",
    "assigned_to" "uuid",
    "value" numeric(12,2) DEFAULT 0 NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "currency" "text" DEFAULT 'EUR'::"text",
    "position" integer DEFAULT 0,
    "description" "text",
    "stage_id" "uuid",
    "title" "text",
    "country" "text",
    "industry" "text",
    "address" "text",
    CONSTRAINT "deals_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'won'::"text", 'lost'::"text"])))
);


ALTER TABLE "public"."deals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notes" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "content" "text" NOT NULL,
    "is_pinned" boolean DEFAULT false NOT NULL,
    "contact_id" "uuid",
    "deal_id" "uuid",
    "author_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "notes_target_required" CHECK ((("contact_id" IS NOT NULL) OR ("deal_id" IS NOT NULL)))
);


ALTER TABLE "public"."notes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notification_job_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "job_id" "uuid" NOT NULL,
    "contact_id" "uuid" NOT NULL,
    "channel" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "error" "text",
    "attempts" integer DEFAULT 0 NOT NULL,
    "processed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "notification_job_items_channel_check" CHECK (("channel" = ANY (ARRAY['email'::"text", 'whatsapp'::"text"]))),
    CONSTRAINT "notification_job_items_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'sent'::"text", 'failed'::"text", 'skipped_no_consent'::"text"])))
);


ALTER TABLE "public"."notification_job_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notification_jobs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "channel" "text" NOT NULL,
    "email_subject" "text",
    "email_body" "text",
    "email_is_html" boolean DEFAULT false NOT NULL,
    "whatsapp_template_name" "text",
    "whatsapp_language_code" "text",
    "total_items" integer DEFAULT 0 NOT NULL,
    "processed_items" integer DEFAULT 0 NOT NULL,
    "sent_items" integer DEFAULT 0 NOT NULL,
    "failed_items" integer DEFAULT 0 NOT NULL,
    "skipped_items" integer DEFAULT 0 NOT NULL,
    "error" "text",
    "created_by" "uuid",
    "locked_until" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "notification_jobs_channel_check" CHECK (("channel" = ANY (ARRAY['email'::"text", 'whatsapp'::"text", 'both'::"text"]))),
    CONSTRAINT "notification_jobs_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'completed'::"text", 'failed'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."notification_jobs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notification_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "key" "text" DEFAULT 'default'::"text" NOT NULL,
    "from_email" "text" NOT NULL,
    "from_name" "text",
    "reply_to_email" "text" NOT NULL,
    "resend_api_key" "text",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."notification_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pipelines" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "description" "text",
    "is_default" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."pipelines" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "email" "text",
    "full_name" "text",
    "role" "public"."user_role" DEFAULT 'employee'::"public"."user_role" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "first_name" "text",
    "last_name" "text",
    "company_name" "text" DEFAULT 'Coaching & Consulting'::"text",
    "avatar_url" "text"
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


ALTER TABLE ONLY "public"."activities"
    ADD CONSTRAINT "activities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."call_logs"
    ADD CONSTRAINT "call_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."companies"
    ADD CONSTRAINT "companies_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."contacts"
    ADD CONSTRAINT "contacts_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."contacts"
    ADD CONSTRAINT "contacts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."deal_stage_history"
    ADD CONSTRAINT "deal_stage_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."deal_stages"
    ADD CONSTRAINT "deal_stages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."deals"
    ADD CONSTRAINT "deals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notes"
    ADD CONSTRAINT "notes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notification_job_items"
    ADD CONSTRAINT "notification_job_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notification_jobs"
    ADD CONSTRAINT "notification_jobs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notification_settings"
    ADD CONSTRAINT "notification_settings_key_key" UNIQUE ("key");



ALTER TABLE ONLY "public"."notification_settings"
    ADD CONSTRAINT "notification_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pipelines"
    ADD CONSTRAINT "pipelines_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



CREATE INDEX "activities_contact_id_idx" ON "public"."activities" USING "btree" ("contact_id");



CREATE INDEX "activities_created_at_idx" ON "public"."activities" USING "btree" ("created_at" DESC);



CREATE INDEX "contacts_email_bounced_at_idx" ON "public"."contacts" USING "btree" ("email_bounced_at");



CREATE INDEX "idx_call_logs_called_at" ON "public"."call_logs" USING "btree" ("called_at" DESC);



CREATE INDEX "idx_call_logs_contact" ON "public"."call_logs" USING "btree" ("contact_id");



CREATE INDEX "idx_call_logs_contact_id" ON "public"."call_logs" USING "btree" ("contact_id");



CREATE INDEX "idx_call_logs_deal" ON "public"."call_logs" USING "btree" ("deal_id");



CREATE INDEX "idx_call_logs_user" ON "public"."call_logs" USING "btree" ("user_id");



CREATE INDEX "idx_companies_name_trgm" ON "public"."companies" USING "gin" ("name" "public"."gin_trgm_ops");



CREATE INDEX "idx_contacts_assigned_to" ON "public"."contacts" USING "btree" ("assigned_to");



CREATE INDEX "idx_contacts_company" ON "public"."contacts" USING "btree" ("company_id");



CREATE INDEX "idx_contacts_created_at" ON "public"."contacts" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_contacts_email" ON "public"."contacts" USING "btree" ("email");



CREATE INDEX "idx_contacts_name_trgm" ON "public"."contacts" USING "gin" ((((COALESCE("first_name", ''::"text") || ' '::"text") || COALESCE("last_name", ''::"text"))) "public"."gin_trgm_ops");



CREATE INDEX "idx_deal_stage_history_changed_at" ON "public"."deal_stage_history" USING "btree" ("changed_at" DESC);



CREATE INDEX "idx_deal_stage_history_deal_id" ON "public"."deal_stage_history" USING "btree" ("deal_id");



CREATE INDEX "idx_deal_stages_pipe" ON "public"."deal_stages" USING "btree" ("pipeline_id");



CREATE INDEX "idx_deal_stages_pipeline_id" ON "public"."deal_stages" USING "btree" ("pipeline_id");



CREATE INDEX "idx_deals_assigned" ON "public"."deals" USING "btree" ("assigned_to");



CREATE INDEX "idx_deals_company" ON "public"."deals" USING "btree" ("company_id");



CREATE INDEX "idx_deals_contact" ON "public"."deals" USING "btree" ("contact_id");



CREATE INDEX "idx_deals_contact_id" ON "public"."deals" USING "btree" ("contact_id");



CREATE INDEX "idx_deals_created_at" ON "public"."deals" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_deals_name_trgm" ON "public"."deals" USING "gin" ("name" "public"."gin_trgm_ops");



CREATE INDEX "idx_deals_pipeline" ON "public"."deals" USING "btree" ("pipeline_id");



CREATE INDEX "idx_deals_pipeline_id" ON "public"."deals" USING "btree" ("pipeline_id");



CREATE INDEX "idx_deals_stage" ON "public"."deals" USING "btree" ("deal_stage_id");



CREATE INDEX "idx_deals_stage_id" ON "public"."deals" USING "btree" ("stage_id");



CREATE INDEX "idx_notes_contact" ON "public"."notes" USING "btree" ("contact_id");



CREATE INDEX "idx_notes_contact_id" ON "public"."notes" USING "btree" ("contact_id");



CREATE INDEX "idx_notes_created_at" ON "public"."notes" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_notes_deal" ON "public"."notes" USING "btree" ("deal_id");



CREATE INDEX "notification_job_items_job_status_idx" ON "public"."notification_job_items" USING "btree" ("job_id", "status");



CREATE INDEX "notification_jobs_status_created_idx" ON "public"."notification_jobs" USING "btree" ("status", "created_at" DESC);



CREATE OR REPLACE TRIGGER "enforce_role_change" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_role_self_escalation"();



CREATE OR REPLACE TRIGGER "on_contact_created" AFTER INSERT ON "public"."contacts" FOR EACH ROW EXECUTE FUNCTION "public"."handle_new_contact"();



CREATE OR REPLACE TRIGGER "on_deal_stage_change" AFTER UPDATE ON "public"."deals" FOR EACH ROW EXECUTE FUNCTION "public"."handle_deal_stage_change"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."call_logs" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."companies" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."contacts" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."deal_stages" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."deals" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."notes" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."pipelines" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."activities"
    ADD CONSTRAINT "activities_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."call_logs"
    ADD CONSTRAINT "call_logs_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."call_logs"
    ADD CONSTRAINT "call_logs_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."call_logs"
    ADD CONSTRAINT "call_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."contacts"
    ADD CONSTRAINT "contacts_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."contacts"
    ADD CONSTRAINT "contacts_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."deal_stage_history"
    ADD CONSTRAINT "deal_stage_history_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."deal_stage_history"
    ADD CONSTRAINT "deal_stage_history_from_stage_id_fkey" FOREIGN KEY ("from_stage_id") REFERENCES "public"."deal_stages"("id");



ALTER TABLE ONLY "public"."deal_stage_history"
    ADD CONSTRAINT "deal_stage_history_to_stage_id_fkey" FOREIGN KEY ("to_stage_id") REFERENCES "public"."deal_stages"("id");



ALTER TABLE ONLY "public"."deal_stages"
    ADD CONSTRAINT "deal_stages_pipeline_id_fkey" FOREIGN KEY ("pipeline_id") REFERENCES "public"."pipelines"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."deals"
    ADD CONSTRAINT "deals_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."deals"
    ADD CONSTRAINT "deals_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."deals"
    ADD CONSTRAINT "deals_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."deals"
    ADD CONSTRAINT "deals_deal_stage_id_fkey" FOREIGN KEY ("deal_stage_id") REFERENCES "public"."deal_stages"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."deals"
    ADD CONSTRAINT "deals_pipeline_id_fkey" FOREIGN KEY ("pipeline_id") REFERENCES "public"."pipelines"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."deals"
    ADD CONSTRAINT "deals_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "public"."deal_stages"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notes"
    ADD CONSTRAINT "notes_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."notes"
    ADD CONSTRAINT "notes_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notes"
    ADD CONSTRAINT "notes_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notification_job_items"
    ADD CONSTRAINT "notification_job_items_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notification_job_items"
    ADD CONSTRAINT "notification_job_items_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."notification_jobs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notification_jobs"
    ADD CONSTRAINT "notification_jobs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Authenticated users can read activities" ON "public"."activities" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can read notification job items" ON "public"."notification_job_items" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can read notification jobs" ON "public"."notification_jobs" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can read notification settings" ON "public"."notification_settings" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Only admin can insert deal_stages" ON "public"."deal_stages" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"public"."user_role")))));



CREATE POLICY "Only admins can delete deal_stages" ON "public"."deal_stages" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"public"."user_role")))));



CREATE POLICY "Only admins can insert deal_stages" ON "public"."deal_stages" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"public"."user_role")))));



CREATE POLICY "Only admins can update deal_stages" ON "public"."deal_stages" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"public"."user_role")))));



CREATE POLICY "Users can insert call_logs" ON "public"."call_logs" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Users can insert notes" ON "public"."notes" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Users can update own call_logs" ON "public"."call_logs" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own notes" ON "public"."notes" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "author_id")) WITH CHECK (("auth"."uid"() = "author_id"));



CREATE POLICY "Users can view call_logs" ON "public"."call_logs" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Users can view deal_stage_history" ON "public"."deal_stage_history" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Users can view deal_stages" ON "public"."deal_stages" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Users can view notes" ON "public"."notes" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."activities" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."call_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "call_logs_delete_admin_only" ON "public"."call_logs" FOR DELETE TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "call_logs_insert" ON "public"."call_logs" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "call_logs_select" ON "public"."call_logs" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "call_logs_update" ON "public"."call_logs" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "public"."companies" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "companies_delete_admin_only" ON "public"."companies" FOR DELETE TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "companies_insert" ON "public"."companies" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "companies_select" ON "public"."companies" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "companies_update" ON "public"."companies" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "public"."contacts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "contacts_delete_admin_only" ON "public"."contacts" FOR DELETE TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "contacts_insert" ON "public"."contacts" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "contacts_select" ON "public"."contacts" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "contacts_update" ON "public"."contacts" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "public"."deal_stage_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."deal_stages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "deal_stages_delete_admin_only" ON "public"."deal_stages" FOR DELETE TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "deal_stages_insert_admin_only" ON "public"."deal_stages" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"());



CREATE POLICY "deal_stages_select" ON "public"."deal_stages" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "deal_stages_update_admin_only" ON "public"."deal_stages" FOR UPDATE TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



ALTER TABLE "public"."deals" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "deals_delete_admin_only" ON "public"."deals" FOR DELETE TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "deals_insert" ON "public"."deals" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "deals_select" ON "public"."deals" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "deals_update" ON "public"."deals" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "public"."notes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "notes_delete_admin_only" ON "public"."notes" FOR DELETE TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "notes_insert" ON "public"."notes" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "notes_select" ON "public"."notes" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "notes_update" ON "public"."notes" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "public"."notification_job_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notification_jobs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notification_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pipelines" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "pipelines_delete_admin_only" ON "public"."pipelines" FOR DELETE TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "pipelines_insert_admin_only" ON "public"."pipelines" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"());



CREATE POLICY "pipelines_select" ON "public"."pipelines" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "pipelines_update_admin_only" ON "public"."pipelines" FOR UPDATE TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles_delete_policy" ON "public"."profiles" FOR DELETE USING ("public"."is_admin"());



CREATE POLICY "profiles_insert_policy" ON "public"."profiles" FOR INSERT WITH CHECK ((("auth"."uid"() = "id") OR "public"."is_admin"()));



CREATE POLICY "profiles_select_policy" ON "public"."profiles" FOR SELECT USING ((("auth"."uid"() = "id") OR "public"."is_admin"()));



CREATE POLICY "profiles_update_policy" ON "public"."profiles" FOR UPDATE USING ((("auth"."uid"() = "id") OR "public"."is_admin"()));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "service_role";






















































































































































GRANT ALL ON FUNCTION "public"."admin_get_users"() TO "anon";
GRANT ALL ON FUNCTION "public"."admin_get_users"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_get_users"() TO "service_role";



GRANT ALL ON FUNCTION "public"."admin_set_user_role"("user_id" "uuid", "new_role" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."admin_set_user_role"("user_id" "uuid", "new_role" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_set_user_role"("user_id" "uuid", "new_role" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_old_notification_jobs"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_old_notification_jobs"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_old_notification_jobs"() TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_deal_stage_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_deal_stage_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_deal_stage_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_contact"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_contact"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_contact"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."prevent_role_self_escalation"() TO "anon";
GRANT ALL ON FUNCTION "public"."prevent_role_self_escalation"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."prevent_role_self_escalation"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "postgres";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "anon";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "service_role";



GRANT ALL ON FUNCTION "public"."show_limit"() TO "postgres";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "anon";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "service_role";



GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "service_role";


















GRANT ALL ON TABLE "public"."activities" TO "anon";
GRANT ALL ON TABLE "public"."activities" TO "authenticated";
GRANT ALL ON TABLE "public"."activities" TO "service_role";



GRANT ALL ON TABLE "public"."call_logs" TO "anon";
GRANT ALL ON TABLE "public"."call_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."call_logs" TO "service_role";



GRANT ALL ON TABLE "public"."companies" TO "anon";
GRANT ALL ON TABLE "public"."companies" TO "authenticated";
GRANT ALL ON TABLE "public"."companies" TO "service_role";



GRANT ALL ON TABLE "public"."contacts" TO "anon";
GRANT ALL ON TABLE "public"."contacts" TO "authenticated";
GRANT ALL ON TABLE "public"."contacts" TO "service_role";



GRANT ALL ON TABLE "public"."deal_stage_history" TO "anon";
GRANT ALL ON TABLE "public"."deal_stage_history" TO "authenticated";
GRANT ALL ON TABLE "public"."deal_stage_history" TO "service_role";



GRANT ALL ON TABLE "public"."deal_stages" TO "anon";
GRANT ALL ON TABLE "public"."deal_stages" TO "authenticated";
GRANT ALL ON TABLE "public"."deal_stages" TO "service_role";



GRANT ALL ON TABLE "public"."deals" TO "anon";
GRANT ALL ON TABLE "public"."deals" TO "authenticated";
GRANT ALL ON TABLE "public"."deals" TO "service_role";



GRANT ALL ON TABLE "public"."notes" TO "anon";
GRANT ALL ON TABLE "public"."notes" TO "authenticated";
GRANT ALL ON TABLE "public"."notes" TO "service_role";



GRANT ALL ON TABLE "public"."notification_job_items" TO "anon";
GRANT ALL ON TABLE "public"."notification_job_items" TO "authenticated";
GRANT ALL ON TABLE "public"."notification_job_items" TO "service_role";



GRANT ALL ON TABLE "public"."notification_jobs" TO "anon";
GRANT ALL ON TABLE "public"."notification_jobs" TO "authenticated";
GRANT ALL ON TABLE "public"."notification_jobs" TO "service_role";



GRANT ALL ON TABLE "public"."notification_settings" TO "anon";
GRANT ALL ON TABLE "public"."notification_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."notification_settings" TO "service_role";



GRANT ALL ON TABLE "public"."pipelines" TO "anon";
GRANT ALL ON TABLE "public"."pipelines" TO "authenticated";
GRANT ALL ON TABLE "public"."pipelines" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































