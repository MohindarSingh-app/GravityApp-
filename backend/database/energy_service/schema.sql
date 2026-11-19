-- Current PostgreSQL schema snapshot generated from the configured database.
-- Source of truth for schema changes: database/migrations/*.sql.
-- Apply changes with `npm run migrate`; do not apply this snapshot to a managed database.
--
-- PostgreSQL database dump
--

\restrict ixPDNJ5IXsYBV9F48YkDnt5HDSoEDURhWEa2TbU1Db0AeP8ylpXbpOCmvQqJfqt

-- Dumped from database version 18.0
-- Dumped by pg_dump version 18.0

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: attachments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.attachments (
    id uuid DEFAULT gen_random_uuid() CONSTRAINT customer_attachments_id_not_null NOT NULL,
    company_id uuid CONSTRAINT customer_attachments_company_id_not_null NOT NULL,
    uploaded_by uuid CONSTRAINT customer_attachments_customer_id_not_null NOT NULL,
    entity_type character varying(32),
    entity_id uuid,
    file_name character varying(255) CONSTRAINT customer_attachments_file_name_not_null NOT NULL,
    mime_type character varying(120) CONSTRAINT customer_attachments_content_type_not_null NOT NULL,
    file_reference character varying(512) CONSTRAINT customer_attachments_storage_key_not_null NOT NULL,
    byte_size integer,
    created_at timestamp with time zone DEFAULT now() CONSTRAINT customer_attachments_created_at_not_null NOT NULL,
    updated_at timestamp with time zone DEFAULT now() CONSTRAINT customer_attachments_updated_at_not_null NOT NULL,
    CONSTRAINT attachments_entity_type_check CHECK (((entity_type IS NULL) OR ((entity_type)::text = ANY ((ARRAY['amc_request'::character varying, 'repair_ticket'::character varying, 'project_request'::character varying, 'service_request'::character varying, 'field_signal'::character varying])::text[])))),
    CONSTRAINT customer_attachments_byte_size_check CHECK (((byte_size IS NULL) OR (byte_size >= 0))),
    CONSTRAINT customer_attachments_file_name_check CHECK ((char_length(btrim((file_name)::text)) >= 1)),
    CONSTRAINT customer_attachments_storage_key_check CHECK ((char_length(btrim((file_reference)::text)) >= 1))
);


--
-- Name: amc_attachments; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.amc_attachments AS
 SELECT id,
    entity_id AS amc_request_id,
    file_reference,
    file_name,
    mime_type,
    uploaded_by,
    created_at
   FROM public.attachments
  WHERE ((entity_type)::text = 'amc_request'::text);


--
-- Name: amc_contract_number_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.amc_contract_number_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: amc_contract_statuses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.amc_contract_statuses (
    code character varying(32) NOT NULL,
    name character varying(80) NOT NULL,
    sort_order integer NOT NULL
);


--
-- Name: amc_contracts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.amc_contracts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    customer_id uuid NOT NULL,
    company_id uuid NOT NULL,
    site_id uuid NOT NULL,
    contract_number character varying(32) NOT NULL,
    contract_type character varying(40) CONSTRAINT amc_contracts_amc_type_not_null NOT NULL,
    coverage text NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    visit_frequency character varying(32) NOT NULL,
    visits_per_year integer,
    next_visit_date date,
    preferred_visit_time character varying(5),
    status character varying(24) DEFAULT 'active'::character varying NOT NULL,
    assigned_engineer_name character varying(120),
    assigned_service_team character varying(120),
    service_contact character varying(160),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT amc_contracts_coverage_check CHECK ((char_length(btrim(coverage)) >= 2)),
    CONSTRAINT amc_contracts_dates_check CHECK ((end_date >= start_date)),
    CONSTRAINT amc_contracts_frequency_check CHECK (((visit_frequency)::text = ANY ((ARRAY['monthly'::character varying, 'quarterly'::character varying, 'half_yearly'::character varying, 'yearly'::character varying, 'custom'::character varying])::text[]))),
    CONSTRAINT amc_contracts_type_check CHECK (((contract_type)::text = ANY ((ARRAY['comprehensive'::character varying, 'non_comprehensive'::character varying, 'preventive'::character varying, 'labour'::character varying, 'breakdown'::character varying])::text[]))),
    CONSTRAINT amc_contracts_visits_check CHECK (((visits_per_year IS NULL) OR (visits_per_year > 0)))
);


--
-- Name: COLUMN amc_contracts.visit_frequency; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.amc_contracts.visit_frequency IS 'Visit schedule frequency';


--
-- Name: COLUMN amc_contracts.visits_per_year; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.amc_contracts.visits_per_year IS 'Visit schedule count';


--
-- Name: COLUMN amc_contracts.next_visit_date; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.amc_contracts.next_visit_date IS 'Visit schedule next date';


--
-- Name: COLUMN amc_contracts.preferred_visit_time; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.amc_contracts.preferred_visit_time IS 'Visit schedule preferred time';


--
-- Name: amc_plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.amc_plans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    site_id uuid,
    title character varying(160) NOT NULL,
    status character varying(20) DEFAULT 'quoted'::character varying NOT NULL,
    discount_percent integer,
    quote_hours integer DEFAULT 48 NOT NULL,
    coverage character varying(240) NOT NULL,
    priority_response boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT amc_plans_status_check CHECK (((status)::text = ANY ((ARRAY['quoted'::character varying, 'active'::character varying, 'expired'::character varying])::text[]))),
    CONSTRAINT amc_plans_title_check CHECK ((char_length(btrim((title)::text)) >= 2))
);


--
-- Name: amc_request_number_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.amc_request_number_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: amc_request_statuses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.amc_request_statuses (
    code character varying(32) NOT NULL,
    name character varying(80) NOT NULL,
    sort_order integer NOT NULL
);


--
-- Name: amc_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.amc_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    customer_id uuid NOT NULL,
    company_id uuid NOT NULL,
    site_id uuid NOT NULL,
    contract_id uuid,
    request_type character varying(40) NOT NULL,
    service_requirement text CONSTRAINT amc_requests_requested_service_not_null NOT NULL,
    preferred_date date,
    preferred_time character varying(5),
    description text,
    scheduled_date date,
    scheduled_time character varying(5),
    status character varying(32) DEFAULT 'draft'::character varying NOT NULL,
    submitted_at timestamp with time zone,
    cancelled_at timestamp with time zone,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    request_number character varying(32) NOT NULL,
    CONSTRAINT amc_requests_service_check CHECK ((char_length(btrim(service_requirement)) >= 2)),
    CONSTRAINT amc_requests_submitted_check CHECK ((((status)::text = ANY ((ARRAY['draft'::character varying, 'cancelled'::character varying])::text[])) OR (preferred_date IS NOT NULL))),
    CONSTRAINT amc_requests_type_check CHECK (((request_type)::text = ANY ((ARRAY['new_amc'::character varying, 'renewal'::character varying, 'visit'::character varying, 'coverage_change'::character varying])::text[])))
);


--
-- Name: amc_reschedule_statuses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.amc_reschedule_statuses (
    code character varying(32) NOT NULL,
    name character varying(80) NOT NULL,
    sort_order integer NOT NULL
);


--
-- Name: amc_reschedules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.amc_reschedules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    amc_request_id uuid,
    amc_contract_id uuid,
    customer_id uuid NOT NULL,
    company_id uuid NOT NULL,
    previous_schedule date CONSTRAINT amc_reschedules_old_scheduled_date_not_null NOT NULL,
    requested_schedule date CONSTRAINT amc_reschedules_requested_new_date_not_null NOT NULL,
    requested_time character varying(5),
    reason text NOT NULL,
    notes text,
    status character varying(24) DEFAULT 'pending'::character varying NOT NULL,
    previous_request_status character varying(32),
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    review_note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT amc_reschedules_dates_check CHECK ((requested_schedule <> previous_schedule)),
    CONSTRAINT amc_reschedules_reason_check CHECK ((char_length(btrim(reason)) >= 2)),
    CONSTRAINT amc_reschedules_requested_time_check CHECK (((requested_time IS NULL) OR ((requested_time)::text ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'::text))),
    CONSTRAINT amc_reschedules_ref_check CHECK (((amc_request_id IS NOT NULL) OR (amc_contract_id IS NOT NULL)))
);


--
-- Name: amc_status_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.amc_status_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    amc_request_id uuid,
    amc_contract_id uuid,
    amc_reschedule_id uuid,
    old_status character varying(32),
    new_status character varying(32) NOT NULL,
    changed_by uuid,
    changed_at timestamp with time zone DEFAULT now() NOT NULL,
    remarks text,
    CONSTRAINT amc_status_history_one_target_check CHECK ((((
CASE
    WHEN (amc_request_id IS NULL) THEN 0
    ELSE 1
END +
CASE
    WHEN (amc_contract_id IS NULL) THEN 0
    ELSE 1
END) +
CASE
    WHEN (amc_reschedule_id IS NULL) THEN 0
    ELSE 1
END) = 1))
);


--
-- Name: api_keys; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.api_keys (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    company_id uuid,
    key_name character varying(80) CONSTRAINT api_keys_name_not_null NOT NULL,
    key_prefix character varying(16) NOT NULL,
    key_hash character(64) NOT NULL,
    last_used_at timestamp with time zone,
    expires_at timestamp with time zone,
    revoked_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT api_keys_name_check CHECK ((char_length(btrim((key_name)::text)) >= 2))
);


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    action character varying(64) NOT NULL,
    entity_type character varying(64),
    entity_id uuid,
    ip_address inet,
    user_agent character varying(255),
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    company_id uuid,
    site_id uuid,
    description text
);


--
-- Name: companies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.companies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_user_id uuid,
    company_name character varying(200) NOT NULL,
    gst_number character varying(15) CONSTRAINT companies_gstin_not_null NOT NULL,
    industry character varying(80) NOT NULL,
    city character varying(80) NOT NULL,
    status character varying(20) DEFAULT 'active'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    legal_name character varying(200),
    state character varying(80),
    country character varying(80) DEFAULT 'India'::character varying NOT NULL,
    pincode character varying(12),
    address character varying(500),
    CONSTRAINT companies_gstin_format_check CHECK (((gst_number)::text ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$'::text)),
    CONSTRAINT companies_name_check CHECK ((char_length(btrim((company_name)::text)) >= 2)),
    CONSTRAINT companies_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'inactive'::character varying, 'suspended'::character varying])::text[])))
);


--
-- Name: company_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.company_members (
    company_id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: compliance_certs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.compliance_certs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    site_id uuid,
    name character varying(160) NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT compliance_certs_name_check CHECK ((char_length(btrim((name)::text)) >= 2))
);


--
-- Name: customers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    company_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: devices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.devices (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    customer_id uuid NOT NULL,
    company_id uuid NOT NULL,
    site_id uuid NOT NULL,
    device_type character varying(32) NOT NULL,
    manufacturer character varying(120) NOT NULL,
    model character varying(120),
    serial_number character varying(120),
    asset_number character varying(80),
    location character varying(160) CONSTRAINT devices_installation_location_not_null NOT NULL,
    power_rating character varying(40),
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT devices_location_check CHECK ((char_length(btrim((location)::text)) >= 1)),
    CONSTRAINT devices_manufacturer_check CHECK ((char_length(btrim((manufacturer)::text)) >= 1)),
    CONSTRAINT devices_type_check CHECK (((device_type)::text = ANY ((ARRAY['vfd'::character varying, 'plc'::character varying, 'hmi'::character varying, 'servo'::character varying, 'mcc'::character varying, 'panel'::character varying, 'motor'::character varying, 'drive'::character varying, 'sensor'::character varying, 'other'::character varying])::text[])))
);


--
-- Name: field_jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.field_jobs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    site_id uuid,
    code character varying(24) NOT NULL,
    title character varying(160) NOT NULL,
    category character varying(32) NOT NULL,
    priority character varying(20) DEFAULT 'scheduled'::character varying NOT NULL,
    status character varying(24) DEFAULT 'open'::character varying NOT NULL,
    location_label character varying(160),
    engineer_name character varying(120),
    engineer_trade character varying(80),
    rating numeric(2,1),
    estimate_amount integer,
    sla_due_at timestamp with time zone,
    eta_minutes integer,
    notes character varying(500),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT field_jobs_category_check CHECK (((category)::text = ANY ((ARRAY['job'::character varying, 'quick'::character varying, 'project'::character varying])::text[]))),
    CONSTRAINT field_jobs_priority_check CHECK (((priority)::text = ANY ((ARRAY['emergency'::character varying, 'scheduled'::character varying])::text[]))),
    CONSTRAINT field_jobs_status_check CHECK (((status)::text = ANY ((ARRAY['open'::character varying, 'on_the_way'::character varying, 'in_progress'::character varying, 'completed'::character varying, 'cancelled'::character varying])::text[]))),
    CONSTRAINT field_jobs_title_check CHECK ((char_length(btrim((title)::text)) >= 2))
);


--
-- Name: field_signals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.field_signals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    site_id uuid,
    job_id uuid,
    device_id uuid,
    kind character varying(32) NOT NULL,
    title character varying(160) NOT NULL,
    detail character varying(400) NOT NULL,
    issues_found jsonb DEFAULT '[]'::jsonb NOT NULL,
    error_code character varying(80),
    risk_note character varying(400),
    scope_costs jsonb DEFAULT '{}'::jsonb NOT NULL,
    status character varying(24) DEFAULT 'open'::character varying NOT NULL,
    eta_minutes integer,
    actor_name character varying(120),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT field_signals_kind_check CHECK (((kind)::text = ANY ((ARRAY['emergency'::character varying, 'recommendation'::character varying, 'transit'::character varying, 'repair_send_in'::character varying, 'expert'::character varying])::text[]))),
    CONSTRAINT field_signals_issues_found_check CHECK ((jsonb_typeof(issues_found) = 'array'::text)),
    CONSTRAINT field_signals_scope_costs_check CHECK ((jsonb_typeof(scope_costs) = 'object'::text)),
    CONSTRAINT field_signals_status_check CHECK (((status)::text = ANY ((ARRAY['open'::character varying, 'closed'::character varying])::text[])))
);


--
-- Name: otp_verifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.otp_verifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    purpose character varying(32) NOT NULL,
    otp_code character(64) CONSTRAINT otp_verifications_otp_hash_not_null NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    attempts integer DEFAULT 0 CONSTRAINT otp_verifications_attempt_count_not_null NOT NULL,
    max_attempts integer DEFAULT 5 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    user_id uuid,
    identifier character varying(255) NOT NULL,
    verified_at timestamp with time zone,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    CONSTRAINT otp_verifications_attempt_count_check CHECK ((attempts >= 0)),
    CONSTRAINT otp_verifications_purpose_check CHECK (((purpose)::text = ANY ((ARRAY['signup'::character varying, 'login'::character varying, 'forgot_password'::character varying, 'phone_verification'::character varying, 'email_verification'::character varying])::text[]))),
    CONSTRAINT otp_verifications_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'verified'::character varying, 'expired'::character varying, 'invalidated'::character varying])::text[])))
);


--
-- Name: project_attachments; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.project_attachments AS
 SELECT id,
    entity_id AS project_request_id,
    file_reference,
    file_name,
    mime_type,
    uploaded_by,
    created_at
   FROM public.attachments
  WHERE ((entity_type)::text = 'project_request'::text);


--
-- Name: project_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code character varying(40) NOT NULL,
    name character varying(120) NOT NULL,
    sort_order integer NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT project_categories_name_check CHECK ((char_length(btrim((name)::text)) >= 2))
);


--
-- Name: project_request_details; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_request_details (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_request_id uuid NOT NULL,
    field_key character varying(80) NOT NULL,
    field_value text,
    data_type character varying(20) DEFAULT 'text'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT project_request_details_key_check CHECK (((field_key)::text ~ '^[a-z][a-z0-9_]{0,79}$'::text)),
    CONSTRAINT project_request_details_type_check CHECK (((data_type)::text = ANY ((ARRAY['text'::character varying, 'number'::character varying, 'date'::character varying, 'boolean'::character varying])::text[])))
);


--
-- Name: project_request_number_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.project_request_number_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: project_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    customer_id uuid NOT NULL,
    company_id uuid NOT NULL,
    site_id uuid NOT NULL,
    category_id uuid NOT NULL,
    project_type_id uuid NOT NULL,
    title character varying(160) NOT NULL,
    description text NOT NULL,
    requirements text,
    estimated_scope text,
    preferred_timeline character varying(160),
    budget_amount numeric(14,2),
    budget_currency character(3),
    status character varying(32) DEFAULT 'draft'::character varying NOT NULL,
    submitted_at timestamp with time zone,
    cancelled_at timestamp with time zone,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    request_number character varying(32) NOT NULL,
    CONSTRAINT project_requests_budget_check CHECK (((budget_amount IS NULL) OR (budget_amount >= (0)::numeric))),
    CONSTRAINT project_requests_currency_check CHECK ((((budget_amount IS NULL) AND (budget_currency IS NULL)) OR ((budget_amount IS NOT NULL) AND (budget_currency IS NOT NULL)))),
    CONSTRAINT project_requests_description_check CHECK ((char_length(btrim(description)) >= 2)),
    CONSTRAINT project_requests_title_check CHECK ((char_length(btrim((title)::text)) >= 2))
);


--
-- Name: project_status_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_status_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_request_id uuid NOT NULL,
    old_status character varying(32),
    new_status character varying(32) NOT NULL,
    changed_by uuid,
    remarks text,
    changed_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: project_statuses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_statuses (
    code character varying(32) NOT NULL,
    name character varying(80) NOT NULL,
    sort_order integer NOT NULL
);


--
-- Name: project_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_types (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    category_id uuid NOT NULL,
    code character varying(64) NOT NULL,
    name character varying(160) NOT NULL,
    sort_order integer NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT project_types_name_check CHECK ((char_length(btrim((name)::text)) >= 2))
);


--
-- Name: repair_attachments; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.repair_attachments AS
 SELECT id,
    entity_id AS repair_ticket_id,
    file_reference,
    file_name,
    mime_type AS file_type,
    uploaded_by,
    created_at
   FROM public.attachments
  WHERE ((entity_type)::text = 'repair_ticket'::text);


--
-- Name: repair_status_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.repair_status_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    repair_ticket_id uuid NOT NULL,
    old_status character varying(32),
    new_status character varying(32) NOT NULL,
    changed_by uuid,
    remarks text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: repair_statuses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.repair_statuses (
    code character varying(32) NOT NULL,
    name character varying(80) NOT NULL,
    sort_order integer NOT NULL
);


--
-- Name: repair_ticket_number_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.repair_ticket_number_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: repair_tickets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.repair_tickets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ticket_number character varying(32) NOT NULL,
    customer_id uuid NOT NULL,
    company_id uuid NOT NULL,
    site_id uuid NOT NULL,
    device_id uuid,
    repair_scope character varying(40),
    service_type character varying(40),
    priority character varying(20),
    requested_turnaround character varying(80),
    additional_requirements text,
    issue_description text,
    symptoms text,
    error_details text,
    status character varying(32) DEFAULT 'draft'::character varying NOT NULL,
    submitted_at timestamp with time zone,
    cancelled_at timestamp with time zone,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT repair_tickets_priority_check CHECK (((priority IS NULL) OR ((priority)::text = ANY ((ARRAY['low'::character varying, 'normal'::character varying, 'high'::character varying, 'urgent'::character varying])::text[])))),
    CONSTRAINT repair_tickets_scope_check CHECK (((repair_scope IS NULL) OR ((repair_scope)::text = ANY ((ARRAY['on_site'::character varying, 'workshop'::character varying, 'pickup_and_return'::character varying])::text[])))),
    CONSTRAINT repair_tickets_service_check CHECK (((service_type IS NULL) OR ((service_type)::text = ANY ((ARRAY['inspection'::character varying, 'component_repair'::character varying, 'replacement'::character varying, 'calibration'::character varying, 'overhaul'::character varying, 'other'::character varying])::text[])))),
    CONSTRAINT repair_tickets_submitted_check CHECK ((((status)::text = ANY ((ARRAY['draft'::character varying, 'cancelled'::character varying])::text[])) OR ((device_id IS NOT NULL) AND (repair_scope IS NOT NULL) AND (service_type IS NOT NULL) AND (priority IS NOT NULL) AND (issue_description IS NOT NULL) AND (char_length(btrim(issue_description)) >= 2))))
);


--
-- Name: roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(32) NOT NULL,
    description character varying(160) DEFAULT ''::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    status character varying(20) DEFAULT 'active'::character varying NOT NULL,
    CONSTRAINT roles_name_check CHECK (((name)::text = ANY ((ARRAY['DIRECTOR_OWNER'::character varying, 'MAINTENANCE_HEAD'::character varying, 'PURCHASE_MGR'::character varying, 'SITE_ENGINEER'::character varying])::text[]))),
    CONSTRAINT roles_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'inactive'::character varying])::text[])))
);


--
-- Name: schema_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schema_migrations (
    id text NOT NULL,
    applied_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: service_catalog; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_catalog (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code character varying(40) NOT NULL,
    name character varying(120) NOT NULL,
    category character varying(32) NOT NULL,
    summary character varying(240) NOT NULL,
    same_day boolean DEFAULT false NOT NULL,
    active boolean DEFAULT true NOT NULL,
    CONSTRAINT service_catalog_category_check CHECK (((category)::text = ANY ((ARRAY['quick'::character varying, 'project'::character varying, 'repair'::character varying])::text[])))
);


--
-- Name: service_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code character varying(64) NOT NULL,
    name character varying(120) NOT NULL,
    summary text,
    icon_key character varying(40),
    sort_order integer NOT NULL,
    status character varying(16) DEFAULT 'active'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT service_categories_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'inactive'::character varying])::text[])))
);


--
-- Name: service_field_options; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_field_options (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    field_id uuid NOT NULL,
    value character varying(80) NOT NULL,
    label character varying(160) NOT NULL,
    summary text,
    sort_order integer NOT NULL,
    status character varying(16) DEFAULT 'active'::character varying NOT NULL,
    CONSTRAINT service_field_options_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'inactive'::character varying])::text[])))
);


--
-- Name: service_form_fields; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_form_fields (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    step_id uuid NOT NULL,
    field_key character varying(64) NOT NULL,
    label character varying(160) NOT NULL,
    field_type character varying(24) NOT NULL,
    required boolean DEFAULT false NOT NULL,
    placeholder character varying(200),
    help_text text,
    sort_order integer NOT NULL,
    status character varying(16) DEFAULT 'active'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT service_form_fields_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'inactive'::character varying])::text[]))),
    CONSTRAINT service_form_fields_type_check CHECK (((field_type)::text = ANY ((ARRAY['text'::character varying, 'textarea'::character varying, 'select'::character varying, 'multiselect'::character varying, 'number'::character varying])::text[])))
);


--
-- Name: service_options; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_options (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    step_id uuid NOT NULL,
    code character varying(64) NOT NULL,
    name character varying(160) NOT NULL,
    summary text,
    icon_key character varying(40),
    sort_order integer NOT NULL,
    status character varying(16) DEFAULT 'active'::character varying NOT NULL,
    next_action character varying(40),
    next_action_label character varying(80),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT service_options_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'inactive'::character varying])::text[])))
);


--
-- Name: service_request_answers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_request_answers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    request_id uuid NOT NULL,
    field_id uuid NOT NULL,
    value_text text NOT NULL
);


--
-- Name: service_request_number_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.service_request_number_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: service_request_selections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_request_selections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    request_id uuid NOT NULL,
    step_id uuid NOT NULL,
    option_id uuid NOT NULL,
    sort_order integer NOT NULL
);


--
-- Name: service_request_status_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_request_status_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    service_request_id uuid NOT NULL,
    old_status character varying(32),
    new_status character varying(32) NOT NULL,
    changed_by uuid,
    remarks text,
    changed_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: service_request_statuses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_request_statuses (
    code character varying(32) NOT NULL,
    name character varying(80) NOT NULL,
    sort_order integer NOT NULL
);


--
-- Name: service_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    customer_id uuid NOT NULL,
    company_id uuid NOT NULL,
    site_id uuid NOT NULL,
    category_id uuid NOT NULL,
    request_number character varying(32) NOT NULL,
    status character varying(32) NOT NULL,
    priority character varying(40),
    preferred_date date,
    preferred_time character varying(5),
    assigned_engineer_name character varying(120),
    assigned_at timestamp with time zone,
    submitted_at timestamp with time zone,
    cancelled_at timestamp with time zone,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT service_requests_time_check CHECK (((preferred_time IS NULL) OR ((preferred_time)::text ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'::text)))
);


--
-- Name: service_steps; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_steps (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    category_id uuid NOT NULL,
    parent_option_id uuid,
    follows_step_id uuid,
    code character varying(64) NOT NULL,
    title character varying(160) NOT NULL,
    summary text,
    step_kind character varying(16) NOT NULL,
    sort_order integer NOT NULL,
    status character varying(16) DEFAULT 'active'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT service_steps_kind_check CHECK (((step_kind)::text = ANY ((ARRAY['choice'::character varying, 'form'::character varying])::text[]))),
    CONSTRAINT service_steps_link_check CHECK (((parent_option_id IS NULL) OR (follows_step_id IS NULL))),
    CONSTRAINT service_steps_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'inactive'::character varying])::text[])))
);


--
-- Name: sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sessions (
    id uuid DEFAULT gen_random_uuid() CONSTRAINT refresh_sessions_id_not_null NOT NULL,
    user_id uuid CONSTRAINT refresh_sessions_user_id_not_null NOT NULL,
    refresh_token_hash character(64) CONSTRAINT refresh_sessions_token_hash_not_null NOT NULL,
    expires_at timestamp with time zone CONSTRAINT refresh_sessions_expires_at_not_null NOT NULL,
    revoked_at timestamp with time zone,
    user_agent character varying(255),
    ip_address inet,
    last_used_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() CONSTRAINT refresh_sessions_created_at_not_null NOT NULL,
    device_id character varying(128),
    device_name character varying(120)
);


--
-- Name: sites; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sites (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    site_name character varying(160) NOT NULL,
    address character varying(500) CONSTRAINT sites_full_address_not_null NOT NULL,
    city character varying(80) NOT NULL,
    state character varying(80),
    country character varying(80) DEFAULT 'India'::character varying NOT NULL,
    latitude numeric(9,6) NOT NULL,
    longitude numeric(9,6) NOT NULL,
    site_type character varying(20) NOT NULL,
    is_primary boolean DEFAULT false NOT NULL,
    status character varying(20) DEFAULT 'active'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    pincode character varying(12),
    CONSTRAINT sites_latitude_check CHECK (((latitude >= ('-90'::integer)::numeric) AND (latitude <= (90)::numeric))),
    CONSTRAINT sites_longitude_check CHECK (((longitude >= ('-180'::integer)::numeric) AND (longitude <= (180)::numeric))),
    CONSTRAINT sites_name_check CHECK ((char_length(btrim((site_name)::text)) >= 2)),
    CONSTRAINT sites_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'inactive'::character varying])::text[]))),
    CONSTRAINT sites_type_check CHECK (((site_type)::text = ANY ((ARRAY['factory'::character varying, 'plant'::character varying, 'warehouse'::character varying, 'office'::character varying, 'other'::character varying])::text[])))
);


--
-- Name: spare_catalog; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.spare_catalog (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sku character varying(40) NOT NULL,
    name character varying(120) NOT NULL,
    summary character varying(240) NOT NULL,
    active boolean DEFAULT true NOT NULL
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid,
    role_id uuid NOT NULL,
    name character varying(120),
    email character varying(255),
    phone character varying(20),
    secondary_phone character varying(20),
    password_hash text,
    email_verified boolean DEFAULT false NOT NULL,
    phone_verified boolean DEFAULT false NOT NULL,
    status character varying(20) DEFAULT 'active'::character varying NOT NULL,
    last_login_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    avatar_url text,
    CONSTRAINT users_password_hash_check CHECK (((password_hash IS NULL) OR (char_length(password_hash) > 0))),
    CONSTRAINT users_secondary_phone_check CHECK (((secondary_phone IS NULL) OR ((secondary_phone)::text ~ '^\+[1-9][0-9]{7,14}$'::text))),
    CONSTRAINT users_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'inactive'::character varying, 'suspended'::character varying])::text[])))
);


--
-- Name: notification_reads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notification_reads (
    user_id uuid NOT NULL,
    audit_log_id uuid NOT NULL,
    read_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: support_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.support_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    company_id uuid,
    subject character varying(160) NOT NULL,
    message character varying(4000) NOT NULL,
    status character varying(20) DEFAULT 'open'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT support_requests_status_check CHECK (((status)::text = ANY ((ARRAY['open'::character varying, 'in_progress'::character varying, 'resolved'::character varying])::text[]))),
    CONSTRAINT support_requests_subject_check CHECK ((char_length(btrim((subject)::text)) >= 3)),
    CONSTRAINT support_requests_message_check CHECK ((char_length(btrim((message)::text)) >= 10))
);


--
-- Name: TABLE users; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.users IS 'created by migration 005_restore_users_table.sql';


--
-- Name: amc_contract_statuses amc_contract_statuses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.amc_contract_statuses
    ADD CONSTRAINT amc_contract_statuses_pkey PRIMARY KEY (code);


--
-- Name: amc_contracts amc_contracts_number_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.amc_contracts
    ADD CONSTRAINT amc_contracts_number_unique UNIQUE (contract_number);


--
-- Name: amc_contracts amc_contracts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.amc_contracts
    ADD CONSTRAINT amc_contracts_pkey PRIMARY KEY (id);


--
-- Name: amc_plans amc_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.amc_plans
    ADD CONSTRAINT amc_plans_pkey PRIMARY KEY (id);


--
-- Name: amc_request_statuses amc_request_statuses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.amc_request_statuses
    ADD CONSTRAINT amc_request_statuses_pkey PRIMARY KEY (code);


--
-- Name: amc_requests amc_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.amc_requests
    ADD CONSTRAINT amc_requests_pkey PRIMARY KEY (id);


--
-- Name: amc_requests amc_requests_request_number_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.amc_requests
    ADD CONSTRAINT amc_requests_request_number_unique UNIQUE (request_number);


--
-- Name: amc_reschedule_statuses amc_reschedule_statuses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.amc_reschedule_statuses
    ADD CONSTRAINT amc_reschedule_statuses_pkey PRIMARY KEY (code);


--
-- Name: amc_reschedules amc_reschedules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.amc_reschedules
    ADD CONSTRAINT amc_reschedules_pkey PRIMARY KEY (id);


--
-- Name: amc_status_history amc_status_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.amc_status_history
    ADD CONSTRAINT amc_status_history_pkey PRIMARY KEY (id);


--
-- Name: api_keys api_keys_hash_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_keys
    ADD CONSTRAINT api_keys_hash_unique UNIQUE (key_hash);


--
-- Name: api_keys api_keys_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_keys
    ADD CONSTRAINT api_keys_pkey PRIMARY KEY (id);


--
-- Name: attachments attachments_company_reference_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attachments
    ADD CONSTRAINT attachments_company_reference_unique UNIQUE (company_id, file_reference);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: companies companies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.companies
    ADD CONSTRAINT companies_pkey PRIMARY KEY (id);


--
-- Name: company_members company_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_members
    ADD CONSTRAINT company_members_pkey PRIMARY KEY (company_id, user_id);


--
-- Name: compliance_certs compliance_certs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_certs
    ADD CONSTRAINT compliance_certs_pkey PRIMARY KEY (id);


--
-- Name: attachments customer_attachments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attachments
    ADD CONSTRAINT customer_attachments_pkey PRIMARY KEY (id);


--
-- Name: customers customers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (id);


--
-- Name: customers customers_company_user_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_company_user_unique UNIQUE (company_id, user_id);


--
-- Name: devices devices_company_serial_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.devices
    ADD CONSTRAINT devices_company_serial_unique UNIQUE (company_id, serial_number);


--
-- Name: devices devices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.devices
    ADD CONSTRAINT devices_pkey PRIMARY KEY (id);


--
-- Name: field_jobs field_jobs_code_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.field_jobs
    ADD CONSTRAINT field_jobs_code_unique UNIQUE (code);


--
-- Name: field_jobs field_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.field_jobs
    ADD CONSTRAINT field_jobs_pkey PRIMARY KEY (id);


--
-- Name: field_signals field_signals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.field_signals
    ADD CONSTRAINT field_signals_pkey PRIMARY KEY (id);


--
-- Name: otp_verifications otp_verifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.otp_verifications
    ADD CONSTRAINT otp_verifications_pkey PRIMARY KEY (id);


--
-- Name: project_categories project_categories_code_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_categories
    ADD CONSTRAINT project_categories_code_unique UNIQUE (code);


--
-- Name: project_categories project_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_categories
    ADD CONSTRAINT project_categories_pkey PRIMARY KEY (id);


--
-- Name: project_request_details project_request_details_key_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_request_details
    ADD CONSTRAINT project_request_details_key_unique UNIQUE (project_request_id, field_key);


--
-- Name: project_request_details project_request_details_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_request_details
    ADD CONSTRAINT project_request_details_pkey PRIMARY KEY (id);


--
-- Name: project_requests project_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_requests
    ADD CONSTRAINT project_requests_pkey PRIMARY KEY (id);


--
-- Name: project_requests project_requests_request_number_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_requests
    ADD CONSTRAINT project_requests_request_number_unique UNIQUE (request_number);


--
-- Name: project_status_history project_status_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_status_history
    ADD CONSTRAINT project_status_history_pkey PRIMARY KEY (id);


--
-- Name: project_statuses project_statuses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_statuses
    ADD CONSTRAINT project_statuses_pkey PRIMARY KEY (code);


--
-- Name: project_types project_types_code_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_types
    ADD CONSTRAINT project_types_code_unique UNIQUE (code);


--
-- Name: project_types project_types_id_category_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_types
    ADD CONSTRAINT project_types_id_category_unique UNIQUE (id, category_id);


--
-- Name: project_types project_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_types
    ADD CONSTRAINT project_types_pkey PRIMARY KEY (id);


--
-- Name: sessions refresh_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT refresh_sessions_pkey PRIMARY KEY (id);


--
-- Name: repair_status_history repair_status_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.repair_status_history
    ADD CONSTRAINT repair_status_history_pkey PRIMARY KEY (id);


--
-- Name: repair_statuses repair_statuses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.repair_statuses
    ADD CONSTRAINT repair_statuses_pkey PRIMARY KEY (code);


--
-- Name: repair_tickets repair_tickets_number_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.repair_tickets
    ADD CONSTRAINT repair_tickets_number_unique UNIQUE (ticket_number);


--
-- Name: repair_tickets repair_tickets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.repair_tickets
    ADD CONSTRAINT repair_tickets_pkey PRIMARY KEY (id);


--
-- Name: roles roles_name_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_name_unique UNIQUE (name);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (id);


--
-- Name: service_catalog service_catalog_code_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_catalog
    ADD CONSTRAINT service_catalog_code_unique UNIQUE (code);


--
-- Name: service_catalog service_catalog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_catalog
    ADD CONSTRAINT service_catalog_pkey PRIMARY KEY (id);


--
-- Name: service_categories service_categories_code_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_categories
    ADD CONSTRAINT service_categories_code_unique UNIQUE (code);


--
-- Name: service_categories service_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_categories
    ADD CONSTRAINT service_categories_pkey PRIMARY KEY (id);


--
-- Name: service_field_options service_field_options_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_field_options
    ADD CONSTRAINT service_field_options_pkey PRIMARY KEY (id);


--
-- Name: service_field_options service_field_options_value_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_field_options
    ADD CONSTRAINT service_field_options_value_unique UNIQUE (field_id, value);


--
-- Name: service_form_fields service_form_fields_key_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_form_fields
    ADD CONSTRAINT service_form_fields_key_unique UNIQUE (step_id, field_key);


--
-- Name: service_form_fields service_form_fields_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_form_fields
    ADD CONSTRAINT service_form_fields_pkey PRIMARY KEY (id);


--
-- Name: service_options service_options_code_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_options
    ADD CONSTRAINT service_options_code_unique UNIQUE (step_id, code);


--
-- Name: service_options service_options_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_options
    ADD CONSTRAINT service_options_pkey PRIMARY KEY (id);


--
-- Name: service_request_answers service_request_answers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_request_answers
    ADD CONSTRAINT service_request_answers_pkey PRIMARY KEY (id);


--
-- Name: service_request_answers service_request_answers_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_request_answers
    ADD CONSTRAINT service_request_answers_unique UNIQUE (request_id, field_id);


--
-- Name: service_request_selections service_request_selections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_request_selections
    ADD CONSTRAINT service_request_selections_pkey PRIMARY KEY (id);


--
-- Name: service_request_selections service_request_selections_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_request_selections
    ADD CONSTRAINT service_request_selections_unique UNIQUE (request_id, step_id);


--
-- Name: service_request_status_history service_request_status_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_request_status_history
    ADD CONSTRAINT service_request_status_history_pkey PRIMARY KEY (id);


--
-- Name: service_request_statuses service_request_statuses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_request_statuses
    ADD CONSTRAINT service_request_statuses_pkey PRIMARY KEY (code);


--
-- Name: service_requests service_requests_number_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_requests
    ADD CONSTRAINT service_requests_number_unique UNIQUE (request_number);


--
-- Name: service_requests service_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_requests
    ADD CONSTRAINT service_requests_pkey PRIMARY KEY (id);


--
-- Name: service_steps service_steps_code_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_steps
    ADD CONSTRAINT service_steps_code_unique UNIQUE (category_id, code);


--
-- Name: service_steps service_steps_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_steps
    ADD CONSTRAINT service_steps_pkey PRIMARY KEY (id);


--
-- Name: sessions sessions_refresh_token_hash_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_refresh_token_hash_unique UNIQUE (refresh_token_hash);


--
-- Name: sites sites_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sites
    ADD CONSTRAINT sites_pkey PRIMARY KEY (id);


--
-- Name: spare_catalog spare_catalog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.spare_catalog
    ADD CONSTRAINT spare_catalog_pkey PRIMARY KEY (id);


--
-- Name: spare_catalog spare_catalog_sku_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.spare_catalog
    ADD CONSTRAINT spare_catalog_sku_unique UNIQUE (sku);


--
-- Name: users users_email_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_unique UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: amc_contracts_company_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX amc_contracts_company_idx ON public.amc_contracts USING btree (company_id, created_at DESC);


--
-- Name: amc_contracts_site_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX amc_contracts_site_idx ON public.amc_contracts USING btree (site_id);


--
-- Name: amc_contracts_site_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX amc_contracts_site_status_idx ON public.amc_contracts USING btree (company_id, site_id, status);


--
-- Name: amc_plans_company_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX amc_plans_company_idx ON public.amc_plans USING btree (company_id, created_at DESC);


--
-- Name: amc_requests_company_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX amc_requests_company_idx ON public.amc_requests USING btree (company_id, created_at DESC);


--
-- Name: amc_requests_contract_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX amc_requests_contract_idx ON public.amc_requests USING btree (contract_id);


--
-- Name: amc_requests_site_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX amc_requests_site_status_idx ON public.amc_requests USING btree (company_id, site_id, status);


--
-- Name: amc_reschedules_company_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX amc_reschedules_company_idx ON public.amc_reschedules USING btree (company_id, created_at DESC);


--
-- Name: amc_reschedules_one_pending_contract; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX amc_reschedules_one_pending_contract ON public.amc_reschedules USING btree (amc_contract_id) WHERE (((status)::text = 'pending'::text) AND (amc_request_id IS NULL));


--
-- Name: amc_reschedules_one_pending_request; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX amc_reschedules_one_pending_request ON public.amc_reschedules USING btree (amc_request_id) WHERE (((status)::text = 'pending'::text) AND (amc_request_id IS NOT NULL));


--
-- Name: amc_status_history_contract_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX amc_status_history_contract_idx ON public.amc_status_history USING btree (amc_contract_id, changed_at);


--
-- Name: amc_status_history_request_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX amc_status_history_request_idx ON public.amc_status_history USING btree (amc_request_id, changed_at);


--
-- Name: amc_status_history_reschedule_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX amc_status_history_reschedule_idx ON public.amc_status_history USING btree (amc_reschedule_id, changed_at);


--
-- Name: api_keys_company_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX api_keys_company_id_idx ON public.api_keys USING btree (company_id);


--
-- Name: api_keys_key_hash_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX api_keys_key_hash_idx ON public.api_keys USING btree (key_hash);


--
-- Name: api_keys_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX api_keys_user_id_idx ON public.api_keys USING btree (user_id);


--
-- Name: audit_logs_action_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_logs_action_idx ON public.audit_logs USING btree (action);


--
-- Name: audit_logs_company_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_logs_company_id_idx ON public.audit_logs USING btree (company_id);


--
-- Name: audit_logs_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_logs_created_at_idx ON public.audit_logs USING btree (created_at DESC);


--
-- Name: audit_logs_entity_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_logs_entity_idx ON public.audit_logs USING btree (entity_type, entity_id);


--
-- Name: audit_logs_site_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_logs_site_id_idx ON public.audit_logs USING btree (site_id);


--
-- Name: audit_logs_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_logs_user_id_idx ON public.audit_logs USING btree (user_id);


--
-- Name: companies_city_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX companies_city_idx ON public.companies USING btree (city);


--
-- Name: companies_gst_owner_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX companies_gst_owner_idx ON public.companies USING btree (gst_number, owner_user_id) WHERE (owner_user_id IS NOT NULL);


--
-- Name: company_members_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX company_members_user_id_idx ON public.company_members USING btree (user_id, created_at DESC);




--
-- Name: compliance_certs_company_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX compliance_certs_company_idx ON public.compliance_certs USING btree (company_id, expires_at);


--
-- Name: customer_attachments_entity_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX customer_attachments_entity_idx ON public.attachments USING btree (entity_type, entity_id);


--
-- Name: customers_company_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX customers_company_idx ON public.customers USING btree (company_id);


--
-- Name: devices_company_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX devices_company_idx ON public.devices USING btree (company_id, created_at DESC);


--
-- Name: devices_company_site_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX devices_company_site_idx ON public.devices USING btree (company_id, site_id);


--
-- Name: devices_site_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX devices_site_idx ON public.devices USING btree (site_id);


--
-- Name: field_jobs_company_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX field_jobs_company_idx ON public.field_jobs USING btree (company_id, created_at DESC);


--
-- Name: field_signals_company_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX field_signals_company_idx ON public.field_signals USING btree (company_id, created_at DESC);

--
-- Name: field_signals_device_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX field_signals_device_idx ON public.field_signals USING btree (device_id) WHERE (device_id IS NOT NULL);


--
-- Name: otp_verifications_expires_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX otp_verifications_expires_at_idx ON public.otp_verifications USING btree (expires_at);


--
-- Name: otp_verifications_identifier_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX otp_verifications_identifier_idx ON public.otp_verifications USING btree (identifier, purpose, created_at DESC);


--
-- Name: otp_verifications_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX otp_verifications_user_id_idx ON public.otp_verifications USING btree (user_id);


--
-- Name: project_request_details_request_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX project_request_details_request_idx ON public.project_request_details USING btree (project_request_id);


--
-- Name: project_requests_company_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX project_requests_company_idx ON public.project_requests USING btree (company_id, created_at DESC);


--
-- Name: project_requests_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX project_requests_type_idx ON public.project_requests USING btree (company_id, project_type_id, status);


--
-- Name: project_status_history_request_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX project_status_history_request_idx ON public.project_status_history USING btree (project_request_id, changed_at);


--
-- Name: project_types_category_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX project_types_category_idx ON public.project_types USING btree (category_id, sort_order);


--
-- Name: repair_status_history_ticket_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX repair_status_history_ticket_idx ON public.repair_status_history USING btree (repair_ticket_id, created_at);


--
-- Name: repair_tickets_company_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX repair_tickets_company_idx ON public.repair_tickets USING btree (company_id, created_at DESC);


--
-- Name: repair_tickets_device_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX repair_tickets_device_idx ON public.repair_tickets USING btree (device_id);


--
-- Name: repair_tickets_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX repair_tickets_status_idx ON public.repair_tickets USING btree (company_id, status);


--
-- Name: service_options_step_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX service_options_step_idx ON public.service_options USING btree (step_id, sort_order);


--
-- Name: service_request_status_history_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX service_request_status_history_idx ON public.service_request_status_history USING btree (service_request_id, changed_at);


--
-- Name: service_requests_company_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX service_requests_company_idx ON public.service_requests USING btree (company_id, created_at DESC);


--
-- Name: service_requests_customer_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX service_requests_customer_idx ON public.service_requests USING btree (customer_id);


--
-- Name: service_steps_category_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX service_steps_category_idx ON public.service_steps USING btree (category_id, sort_order);


--
-- Name: sessions_expires_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sessions_expires_at_idx ON public.sessions USING btree (expires_at);


--
-- Name: sessions_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sessions_user_id_idx ON public.sessions USING btree (user_id);


--
-- Name: sites_city_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sites_city_idx ON public.sites USING btree (city);


--
-- Name: sites_company_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sites_company_id_idx ON public.sites USING btree (company_id);


--
-- Name: sites_one_primary_per_company_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX sites_one_primary_per_company_idx ON public.sites USING btree (company_id) WHERE ((is_primary = true) AND ((status)::text = 'active'::text));


--
-- Name: notification_reads_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX notification_reads_user_idx ON public.notification_reads USING btree (user_id, read_at DESC);


--
-- Name: support_requests_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX support_requests_user_idx ON public.support_requests USING btree (user_id, created_at DESC);


--
-- Name: users_company_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX users_company_id_idx ON public.users USING btree (company_id);


--
-- Name: users_phone_unique_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX users_phone_unique_idx ON public.users USING btree (phone) WHERE (phone IS NOT NULL);


--
-- Name: users_role_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX users_role_id_idx ON public.users USING btree (role_id);


--
-- Name: amc_contracts amc_contracts_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER amc_contracts_set_updated_at BEFORE UPDATE ON public.amc_contracts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: amc_plans amc_plans_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER amc_plans_set_updated_at BEFORE UPDATE ON public.amc_plans FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: amc_requests amc_requests_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER amc_requests_set_updated_at BEFORE UPDATE ON public.amc_requests FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: amc_reschedules amc_reschedules_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER amc_reschedules_set_updated_at BEFORE UPDATE ON public.amc_reschedules FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: companies companies_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER companies_set_updated_at BEFORE UPDATE ON public.companies FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: attachments customer_attachments_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER customer_attachments_set_updated_at BEFORE UPDATE ON public.attachments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: customers customers_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER customers_set_updated_at BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: devices devices_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER devices_set_updated_at BEFORE UPDATE ON public.devices FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: field_jobs field_jobs_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER field_jobs_set_updated_at BEFORE UPDATE ON public.field_jobs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: project_categories project_categories_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER project_categories_set_updated_at BEFORE UPDATE ON public.project_categories FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: project_request_details project_request_details_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER project_request_details_set_updated_at BEFORE UPDATE ON public.project_request_details FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: project_requests project_requests_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER project_requests_set_updated_at BEFORE UPDATE ON public.project_requests FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: project_types project_types_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER project_types_set_updated_at BEFORE UPDATE ON public.project_types FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: repair_tickets repair_tickets_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER repair_tickets_set_updated_at BEFORE UPDATE ON public.repair_tickets FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: roles roles_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER roles_set_updated_at BEFORE UPDATE ON public.roles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: service_requests service_requests_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER service_requests_set_updated_at BEFORE UPDATE ON public.service_requests FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: sites sites_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER sites_set_updated_at BEFORE UPDATE ON public.sites FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: users users_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER users_set_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: TRIGGER users_set_updated_at ON users; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TRIGGER users_set_updated_at ON public.users IS 'created by migration 005_restore_users_table.sql';


--
-- Name: amc_contracts amc_contracts_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.amc_contracts
    ADD CONSTRAINT amc_contracts_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: amc_contracts amc_contracts_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.amc_contracts
    ADD CONSTRAINT amc_contracts_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE RESTRICT;


--
-- Name: amc_contracts amc_contracts_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.amc_contracts
    ADD CONSTRAINT amc_contracts_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE RESTRICT;


--
-- Name: amc_contracts amc_contracts_status_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.amc_contracts
    ADD CONSTRAINT amc_contracts_status_fkey FOREIGN KEY (status) REFERENCES public.amc_contract_statuses(code);


--
-- Name: amc_plans amc_plans_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.amc_plans
    ADD CONSTRAINT amc_plans_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: amc_plans amc_plans_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.amc_plans
    ADD CONSTRAINT amc_plans_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE SET NULL;


--
-- Name: amc_requests amc_requests_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.amc_requests
    ADD CONSTRAINT amc_requests_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: amc_requests amc_requests_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.amc_requests
    ADD CONSTRAINT amc_requests_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE RESTRICT;


--
-- Name: amc_requests amc_requests_existing_contract_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.amc_requests
    ADD CONSTRAINT amc_requests_existing_contract_id_fkey FOREIGN KEY (contract_id) REFERENCES public.amc_contracts(id) ON DELETE RESTRICT;


--
-- Name: amc_requests amc_requests_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.amc_requests
    ADD CONSTRAINT amc_requests_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE RESTRICT;


--
-- Name: amc_requests amc_requests_status_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.amc_requests
    ADD CONSTRAINT amc_requests_status_fkey FOREIGN KEY (status) REFERENCES public.amc_request_statuses(code);


--
-- Name: amc_reschedules amc_reschedules_amc_contract_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.amc_reschedules
    ADD CONSTRAINT amc_reschedules_amc_contract_id_fkey FOREIGN KEY (amc_contract_id) REFERENCES public.amc_contracts(id) ON DELETE CASCADE;


--
-- Name: amc_reschedules amc_reschedules_amc_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.amc_reschedules
    ADD CONSTRAINT amc_reschedules_amc_request_id_fkey FOREIGN KEY (amc_request_id) REFERENCES public.amc_requests(id) ON DELETE CASCADE;


--
-- Name: amc_reschedules amc_reschedules_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.amc_reschedules
    ADD CONSTRAINT amc_reschedules_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: amc_reschedules amc_reschedules_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.amc_reschedules
    ADD CONSTRAINT amc_reschedules_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE RESTRICT;


--
-- Name: amc_reschedules amc_reschedules_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.amc_reschedules
    ADD CONSTRAINT amc_reschedules_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: amc_reschedules amc_reschedules_status_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.amc_reschedules
    ADD CONSTRAINT amc_reschedules_status_fkey FOREIGN KEY (status) REFERENCES public.amc_reschedule_statuses(code);


--
-- Name: amc_status_history amc_status_history_amc_contract_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.amc_status_history
    ADD CONSTRAINT amc_status_history_amc_contract_id_fkey FOREIGN KEY (amc_contract_id) REFERENCES public.amc_contracts(id) ON DELETE CASCADE;


--
-- Name: amc_status_history amc_status_history_amc_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.amc_status_history
    ADD CONSTRAINT amc_status_history_amc_request_id_fkey FOREIGN KEY (amc_request_id) REFERENCES public.amc_requests(id) ON DELETE CASCADE;


--
-- Name: amc_status_history amc_status_history_amc_reschedule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.amc_status_history
    ADD CONSTRAINT amc_status_history_amc_reschedule_id_fkey FOREIGN KEY (amc_reschedule_id) REFERENCES public.amc_reschedules(id) ON DELETE CASCADE;


--
-- Name: amc_status_history amc_status_history_changed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.amc_status_history
    ADD CONSTRAINT amc_status_history_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: amc_status_history amc_status_history_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.amc_status_history
    ADD CONSTRAINT amc_status_history_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: api_keys api_keys_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_keys
    ADD CONSTRAINT api_keys_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: api_keys api_keys_user_id_restore_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_keys
    ADD CONSTRAINT api_keys_user_id_restore_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE NOT VALID;


--
-- Name: CONSTRAINT api_keys_user_id_restore_fkey ON api_keys; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON CONSTRAINT api_keys_user_id_restore_fkey ON public.api_keys IS 'created by migration 005_restore_users_table.sql';


--
-- Name: audit_logs audit_logs_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE SET NULL;


--
-- Name: audit_logs audit_logs_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE SET NULL;


--
-- Name: audit_logs audit_logs_user_id_restore_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_user_id_restore_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL NOT VALID;


--
-- Name: CONSTRAINT audit_logs_user_id_restore_fkey ON audit_logs; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON CONSTRAINT audit_logs_user_id_restore_fkey ON public.audit_logs IS 'created by migration 005_restore_users_table.sql';


--
-- Name: compliance_certs compliance_certs_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_certs
    ADD CONSTRAINT compliance_certs_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: compliance_certs compliance_certs_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_certs
    ADD CONSTRAINT compliance_certs_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE SET NULL;


--
-- Name: attachments customer_attachments_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attachments
    ADD CONSTRAINT customer_attachments_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: attachments customer_attachments_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attachments
    ADD CONSTRAINT customer_attachments_customer_id_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- Name: customers customers_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: customers customers_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- Name: devices devices_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.devices
    ADD CONSTRAINT devices_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: devices devices_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.devices
    ADD CONSTRAINT devices_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE RESTRICT;


--
-- Name: devices devices_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.devices
    ADD CONSTRAINT devices_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE RESTRICT;


--
-- Name: field_jobs field_jobs_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.field_jobs
    ADD CONSTRAINT field_jobs_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: field_jobs field_jobs_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.field_jobs
    ADD CONSTRAINT field_jobs_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE SET NULL;


--
-- Name: field_signals field_signals_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.field_signals
    ADD CONSTRAINT field_signals_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: field_signals field_signals_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.field_signals
    ADD CONSTRAINT field_signals_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.field_jobs(id) ON DELETE SET NULL;

--
-- Name: field_signals field_signals_device_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.field_signals
    ADD CONSTRAINT field_signals_device_id_fkey FOREIGN KEY (device_id) REFERENCES public.devices(id) ON DELETE SET NULL;


--
-- Name: field_signals field_signals_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.field_signals
    ADD CONSTRAINT field_signals_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE SET NULL;


--
-- Name: project_request_details project_request_details_project_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_request_details
    ADD CONSTRAINT project_request_details_project_request_id_fkey FOREIGN KEY (project_request_id) REFERENCES public.project_requests(id) ON DELETE CASCADE;


--
-- Name: project_requests project_requests_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_requests
    ADD CONSTRAINT project_requests_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: project_requests project_requests_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_requests
    ADD CONSTRAINT project_requests_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE RESTRICT;


--
-- Name: project_requests project_requests_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_requests
    ADD CONSTRAINT project_requests_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE RESTRICT;


--
-- Name: project_requests project_requests_status_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_requests
    ADD CONSTRAINT project_requests_status_fkey FOREIGN KEY (status) REFERENCES public.project_statuses(code);


--
-- Name: project_requests project_requests_type_category_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_requests
    ADD CONSTRAINT project_requests_type_category_fkey FOREIGN KEY (project_type_id, category_id) REFERENCES public.project_types(id, category_id);


--
-- Name: project_status_history project_status_history_changed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_status_history
    ADD CONSTRAINT project_status_history_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: project_status_history project_status_history_project_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_status_history
    ADD CONSTRAINT project_status_history_project_request_id_fkey FOREIGN KEY (project_request_id) REFERENCES public.project_requests(id) ON DELETE CASCADE;


--
-- Name: project_types project_types_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_types
    ADD CONSTRAINT project_types_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.project_categories(id) ON DELETE RESTRICT;


--
-- Name: repair_status_history repair_status_history_changed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.repair_status_history
    ADD CONSTRAINT repair_status_history_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: repair_status_history repair_status_history_repair_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.repair_status_history
    ADD CONSTRAINT repair_status_history_repair_ticket_id_fkey FOREIGN KEY (repair_ticket_id) REFERENCES public.repair_tickets(id) ON DELETE CASCADE;


--
-- Name: repair_tickets repair_tickets_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.repair_tickets
    ADD CONSTRAINT repair_tickets_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: repair_tickets repair_tickets_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.repair_tickets
    ADD CONSTRAINT repair_tickets_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE RESTRICT;


--
-- Name: repair_tickets repair_tickets_device_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.repair_tickets
    ADD CONSTRAINT repair_tickets_device_id_fkey FOREIGN KEY (device_id) REFERENCES public.devices(id) ON DELETE RESTRICT;


--
-- Name: repair_tickets repair_tickets_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.repair_tickets
    ADD CONSTRAINT repair_tickets_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE RESTRICT;


--
-- Name: repair_tickets repair_tickets_status_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.repair_tickets
    ADD CONSTRAINT repair_tickets_status_fkey FOREIGN KEY (status) REFERENCES public.repair_statuses(code);


--
-- Name: service_field_options service_field_options_field_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_field_options
    ADD CONSTRAINT service_field_options_field_id_fkey FOREIGN KEY (field_id) REFERENCES public.service_form_fields(id) ON DELETE CASCADE;


--
-- Name: service_form_fields service_form_fields_step_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_form_fields
    ADD CONSTRAINT service_form_fields_step_id_fkey FOREIGN KEY (step_id) REFERENCES public.service_steps(id) ON DELETE CASCADE;


--
-- Name: service_options service_options_step_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_options
    ADD CONSTRAINT service_options_step_id_fkey FOREIGN KEY (step_id) REFERENCES public.service_steps(id) ON DELETE CASCADE;


--
-- Name: service_request_answers service_request_answers_field_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_request_answers
    ADD CONSTRAINT service_request_answers_field_id_fkey FOREIGN KEY (field_id) REFERENCES public.service_form_fields(id) ON DELETE RESTRICT;


--
-- Name: service_request_answers service_request_answers_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_request_answers
    ADD CONSTRAINT service_request_answers_request_id_fkey FOREIGN KEY (request_id) REFERENCES public.service_requests(id) ON DELETE CASCADE;


--
-- Name: service_request_selections service_request_selections_option_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_request_selections
    ADD CONSTRAINT service_request_selections_option_id_fkey FOREIGN KEY (option_id) REFERENCES public.service_options(id) ON DELETE RESTRICT;


--
-- Name: service_request_selections service_request_selections_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_request_selections
    ADD CONSTRAINT service_request_selections_request_id_fkey FOREIGN KEY (request_id) REFERENCES public.service_requests(id) ON DELETE CASCADE;


--
-- Name: service_request_selections service_request_selections_step_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_request_selections
    ADD CONSTRAINT service_request_selections_step_id_fkey FOREIGN KEY (step_id) REFERENCES public.service_steps(id) ON DELETE RESTRICT;


--
-- Name: service_request_status_history service_request_status_history_changed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_request_status_history
    ADD CONSTRAINT service_request_status_history_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: service_request_status_history service_request_status_history_service_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_request_status_history
    ADD CONSTRAINT service_request_status_history_service_request_id_fkey FOREIGN KEY (service_request_id) REFERENCES public.service_requests(id) ON DELETE CASCADE;


--
-- Name: service_requests service_requests_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_requests
    ADD CONSTRAINT service_requests_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.service_categories(id) ON DELETE RESTRICT;


--
-- Name: service_requests service_requests_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_requests
    ADD CONSTRAINT service_requests_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: service_requests service_requests_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_requests
    ADD CONSTRAINT service_requests_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE RESTRICT;


--
-- Name: service_requests service_requests_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_requests
    ADD CONSTRAINT service_requests_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE RESTRICT;


--
-- Name: service_requests service_requests_status_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_requests
    ADD CONSTRAINT service_requests_status_fkey FOREIGN KEY (status) REFERENCES public.service_request_statuses(code);


--
-- Name: service_steps service_steps_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_steps
    ADD CONSTRAINT service_steps_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.service_categories(id) ON DELETE CASCADE;


--
-- Name: service_steps service_steps_follows_step_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_steps
    ADD CONSTRAINT service_steps_follows_step_id_fkey FOREIGN KEY (follows_step_id) REFERENCES public.service_steps(id) ON DELETE CASCADE;


--
-- Name: service_steps service_steps_parent_option_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_steps
    ADD CONSTRAINT service_steps_parent_option_fkey FOREIGN KEY (parent_option_id) REFERENCES public.service_options(id) ON DELETE CASCADE;


--
-- Name: sessions sessions_user_id_restore_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_user_id_restore_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE NOT VALID;


--
-- Name: CONSTRAINT sessions_user_id_restore_fkey ON sessions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON CONSTRAINT sessions_user_id_restore_fkey ON public.sessions IS 'created by migration 005_restore_users_table.sql';


--
-- Name: sites sites_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sites
    ADD CONSTRAINT sites_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: companies companies_owner_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.companies
    ADD CONSTRAINT companies_owner_user_id_fkey FOREIGN KEY (owner_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: company_members company_members_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_members
    ADD CONSTRAINT company_members_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: company_members company_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_members
    ADD CONSTRAINT company_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: users users_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE SET NULL;


--
-- Name: users users_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE RESTRICT;


--
-- Name: notification_reads notification_reads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_reads
    ADD CONSTRAINT notification_reads_pkey PRIMARY KEY (user_id, audit_log_id);


--
-- Name: support_requests support_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_requests
    ADD CONSTRAINT support_requests_pkey PRIMARY KEY (id);


--
-- Name: notification_reads notification_reads_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_reads
    ADD CONSTRAINT notification_reads_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: notification_reads notification_reads_audit_log_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_reads
    ADD CONSTRAINT notification_reads_audit_log_id_fkey FOREIGN KEY (audit_log_id) REFERENCES public.audit_logs(id) ON DELETE CASCADE;


--
-- Name: support_requests support_requests_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_requests
    ADD CONSTRAINT support_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: support_requests support_requests_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_requests
    ADD CONSTRAINT support_requests_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--

\unrestrict ixPDNJ5IXsYBV9F48YkDnt5HDSoEDURhWEa2TbU1Db0AeP8ylpXbpOCmvQqJfqt


-- Migration 012: marketplace commerce tables
CREATE TABLE IF NOT EXISTS product_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(80) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  description VARCHAR(500),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(180) NOT NULL,
  code VARCHAR(80) NOT NULL UNIQUE,
  email VARCHAR(320),
  phone VARCHAR(40),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES product_categories (id) ON DELETE SET NULL,
  supplier_id UUID REFERENCES suppliers (id) ON DELETE SET NULL,
  sku VARCHAR(100) NOT NULL UNIQUE,
  name VARCHAR(180) NOT NULL,
  brand VARCHAR(120),
  summary VARCHAR(1000),
  description TEXT,
  unit VARCHAR(30) NOT NULL DEFAULT 'piece',
  price NUMERIC(12, 2) NOT NULL CHECK (price >= 0),
  currency CHAR(3) NOT NULL DEFAULT 'INR',
  stock_quantity INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
  image_url TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS products_active_category_idx
  ON products (category_id, name) WHERE active = TRUE;

CREATE TABLE IF NOT EXISTS carts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, company_id)
);

CREATE TABLE IF NOT EXISTS cart_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id UUID NOT NULL REFERENCES carts (id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products (id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL CHECK (quantity BETWEEN 1 AND 99),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (cart_id, product_id)
);

CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number BIGSERIAL UNIQUE,
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  company_id UUID NOT NULL REFERENCES companies (id) ON DELETE RESTRICT,
  site_id UUID NOT NULL REFERENCES sites (id) ON DELETE RESTRICT,
  status VARCHAR(30) NOT NULL DEFAULT 'payment_pending'
    CHECK (status IN ('payment_pending', 'confirmed', 'processing', 'dispatched', 'delivered', 'cancelled', 'payment_failed')),
  currency CHAR(3) NOT NULL DEFAULT 'INR',
  subtotal NUMERIC(12, 2) NOT NULL CHECK (subtotal >= 0),
  delivery_fee NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (delivery_fee >= 0),
  total NUMERIC(12, 2) NOT NULL CHECK (total >= 0),
  payment_mode VARCHAR(20) NOT NULL DEFAULT 'sandbox'
    CHECK (payment_mode IN ('sandbox', 'provider')),
  shipping_address JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS orders_company_created_idx
  ON orders (company_id, created_at DESC);

CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
  product_id UUID REFERENCES products (id) ON DELETE SET NULL,
  sku VARCHAR(100) NOT NULL,
  product_name VARCHAR(180) NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity BETWEEN 1 AND 99),
  unit_price NUMERIC(12, 2) NOT NULL CHECK (unit_price >= 0),
  line_total NUMERIC(12, 2) NOT NULL CHECK (line_total >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
  status VARCHAR(30) NOT NULL
    CHECK (status IN ('payment_pending', 'confirmed', 'processing', 'dispatched', 'delivered', 'cancelled', 'payment_failed')),
  note VARCHAR(500),
  changed_by UUID REFERENCES users (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS order_status_history_order_idx
  ON order_status_history (order_id, created_at);

CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL UNIQUE REFERENCES orders (id) ON DELETE RESTRICT,
  provider VARCHAR(40) NOT NULL CHECK (provider IN ('sandbox', 'razorpay', 'stripe')),
  provider_reference VARCHAR(180) NOT NULL UNIQUE,
  status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'succeeded', 'failed', 'refunded')),
  amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
  currency CHAR(3) NOT NULL DEFAULT 'INR',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
