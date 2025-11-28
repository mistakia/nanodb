--
-- PostgreSQL database dump
--

-- Dumped from database version 15.12 (Ubuntu 15.12-1.pgdg24.04+1)
-- Dumped by pg_dump version 15.12 (Ubuntu 15.12-1.pgdg24.04+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET search_path = public;
SET row_security = off;

DROP INDEX IF EXISTS public.type;
DROP INDEX IF EXISTS public.total_amount;
DROP INDEX IF EXISTS public.source_account;
DROP INDEX IF EXISTS public.idx_stats_hourly_timestamp_desc;
DROP INDEX IF EXISTS public.idx_blocks_confirmed_timestamp_election;
DROP INDEX IF EXISTS public.destination_account;
DROP INDEX IF EXISTS public.blocktype;
DROP INDEX IF EXISTS public.blocks_type;
DROP INDEX IF EXISTS public.blocks_subtype;
DROP INDEX IF EXISTS public.blocks_representative;
DROP INDEX IF EXISTS public.blocks_local_timestamp;
DROP INDEX IF EXISTS public.blocks_election_time;
DROP INDEX IF EXISTS public.blocks_confirmed;
DROP INDEX IF EXISTS public.blocks_balance;
DROP INDEX IF EXISTS public.blocks_amount;
DROP INDEX IF EXISTS public.blocks_account;
DROP INDEX IF EXISTS public.block_count;
DROP INDEX IF EXISTS public.accounts_representative;
DROP INDEX IF EXISTS public.accounts_pending;
DROP INDEX IF EXISTS public.accounts_modified_timestamp;
DROP INDEX IF EXISTS public.accounts_balance;
DROP INDEX IF EXISTS public.accounts_account;
ALTER TABLE IF EXISTS ONLY public.source_destination_stats DROP CONSTRAINT IF EXISTS unique_source_destination_stats;
ALTER TABLE IF EXISTS ONLY public.rollup_daily DROP CONSTRAINT IF EXISTS unique_rollup_daily;
ALTER TABLE IF EXISTS ONLY public.historical_price DROP CONSTRAINT IF EXISTS unique_historical_price;
ALTER TABLE IF EXISTS ONLY public.blocks_tags DROP CONSTRAINT IF EXISTS unique_blocks_tags;
ALTER TABLE IF EXISTS ONLY public.accounts_tags DROP CONSTRAINT IF EXISTS unique_accounts_tags;
ALTER TABLE IF EXISTS ONLY public.account_stats DROP CONSTRAINT IF EXISTS unique_account_stats_account;
ALTER TABLE IF EXISTS ONLY public.stats_hourly DROP CONSTRAINT IF EXISTS stats_hourly_pkey;
ALTER TABLE IF EXISTS ONLY public.blocks DROP CONSTRAINT IF EXISTS blocks_pkey;
ALTER TABLE IF EXISTS ONLY public.accounts DROP CONSTRAINT IF EXISTS accounts_pkey;
DROP TABLE IF EXISTS public.stats_hourly;
DROP TABLE IF EXISTS public.source_destination_stats;
DROP TABLE IF EXISTS public.rollup_daily;
DROP TABLE IF EXISTS public.historical_price;
DROP TABLE IF EXISTS public.blocks_tags;
DROP TABLE IF EXISTS public.blocks;
DROP TABLE IF EXISTS public.accounts_tags;
DROP TABLE IF EXISTS public.accounts;
DROP TABLE IF EXISTS public.account_stats;
DROP TABLE IF EXISTS public.account_blocks_summary;
SET default_table_access_method = heap;

--
-- Name: account_blocks_summary; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.account_blocks_summary (
    source_account character varying(65) NOT NULL,
    destination_account character varying(65) NOT NULL,
    type character varying(7) NOT NULL,
    block_count integer,
    min_timestamp integer NOT NULL,
    max_timestamp integer NOT NULL,
    min_amount numeric(39,0) DEFAULT NULL::numeric,
    max_amount numeric(39,0) DEFAULT NULL::numeric,
    total_amount numeric(39,0) DEFAULT NULL::numeric
);


--
-- Name: account_stats; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.account_stats (
    account character varying(65) NOT NULL,
    block_count integer NOT NULL,
    account_count integer NOT NULL,
    min_timestamp integer NOT NULL,
    max_timestamp integer NOT NULL,
    min_amount numeric(39,0) DEFAULT NULL::numeric,
    max_amount numeric(39,0) DEFAULT NULL::numeric,
    total_amount numeric(39,0) DEFAULT NULL::numeric,
    max_account character varying(65) NOT NULL,
    type integer NOT NULL
);


--
-- Name: accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.accounts (
    account character varying(65) DEFAULT NULL::character varying NOT NULL,
    frontier character varying(64) DEFAULT NULL::character varying,
    open_block character varying(64) DEFAULT NULL::character varying,
    representative_block character varying(64) DEFAULT NULL::character varying,
    balance numeric(39,0) DEFAULT NULL::numeric,
    modified_timestamp integer,
    block_count integer,
    confirmation_height integer,
    confirmation_height_frontier character varying(64) DEFAULT NULL::character varying,
    representative character varying(65) DEFAULT NULL::character varying,
    weight numeric(39,0) DEFAULT NULL::numeric,
    pending character varying(39) DEFAULT NULL::character varying,
    key character varying(64) DEFAULT NULL::character varying
);


--
-- Name: accounts_tags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.accounts_tags (
    account character varying(65) NOT NULL,
    tag character varying(65) NOT NULL
);


--
-- Name: blocks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.blocks (
    hash character varying(65) DEFAULT NULL::character varying NOT NULL,
    amount numeric(39,0) DEFAULT NULL::numeric,
    balance numeric(39,0) DEFAULT NULL::numeric,
    height integer,
    local_timestamp integer,
    confirmed integer,
    type integer,
    account character varying(65) DEFAULT NULL::character varying,
    previous character varying(65) DEFAULT NULL::character varying,
    representative character varying(65) DEFAULT NULL::character varying,
    link character varying(65) DEFAULT NULL::character varying,
    link_account character varying(65) DEFAULT NULL::character varying,
    signature character varying(128) DEFAULT NULL::character varying,
    work character varying(16) DEFAULT NULL::character varying,
    subtype integer,
    election_duration integer,
    election_time bigint,
    election_tally numeric(39,0) DEFAULT NULL::numeric,
    election_request_count integer,
    election_blocks integer,
    election_voters integer
);


--
-- Name: blocks_tags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.blocks_tags (
    block_hash character varying(65) NOT NULL,
    tag character varying(65) NOT NULL
);


--
-- Name: historical_price; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.historical_price (
    source character varying(10) NOT NULL,
    timestamp_utc timestamp without time zone NOT NULL,
    price numeric(39,18) NOT NULL,
    volume numeric(39,2) NOT NULL
);


--
-- Name: rollup_daily; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rollup_daily (
    active_addresses integer,
    blocks integer,
    send_count integer,
    open_count integer,
    receive_count integer,
    change_count integer,
    send_volume numeric(39,0),
    change_volume numeric(39,0),
    receive_volume numeric(39,0),
    open_volume numeric(39,0),
    _1000000_count integer,
    _100000_count integer,
    _10000_count integer,
    _1000_count integer,
    _100_count integer,
    _10_count integer,
    _1_count integer,
    _01_count integer,
    _001_count integer,
    _0001_count integer,
    _00001_count integer,
    _000001_count integer,
    _000001_below_count integer,
    _1000000_total_amount_sent numeric(39,0),
    _100000_total_amount_sent numeric(39,0),
    _10000_total_amount_sent numeric(39,0),
    _1000_total_amount_sent numeric(39,0),
    _100_total_amount_sent numeric(39,0),
    _10_total_amount_sent numeric(39,0),
    _1_total_amount_sent numeric(39,0),
    _01_total_amount_sent numeric(39,0),
    _001_total_amount_sent numeric(39,0),
    _0001_total_amount_sent numeric(39,0),
    _00001_total_amount_sent numeric(39,0),
    _000001_total_amount_sent numeric(39,0),
    _000001_below_total_amount_sent numeric(39,0),
    "timestamp" integer NOT NULL,
    timestamp_utc timestamp without time zone NOT NULL,
    _1000000_total_balance numeric(39,0),
    _100000_total_balance numeric(39,0),
    _10000_total_balance numeric(39,0),
    _1000_total_balance numeric(39,0),
    _100_total_balance numeric(39,0),
    _10_total_balance numeric(39,0),
    _1_total_balance numeric(39,0),
    _01_total_balance numeric(39,0),
    _001_total_balance numeric(39,0),
    _0001_total_balance numeric(39,0),
    _00001_total_balance numeric(39,0),
    _000001_total_balance numeric(39,0),
    _000001_below_total_balance numeric(39,0),
    _1000000_account_count integer,
    _100000_account_count integer,
    _10000_account_count integer,
    _1000_account_count integer,
    _100_account_count integer,
    _10_account_count integer,
    _1_account_count integer,
    _01_account_count integer,
    _001_account_count integer,
    _0001_account_count integer,
    _00001_account_count integer,
    _000001_account_count integer,
    _000001_below_account_count integer,
    _zero_account_count integer
);


--
-- Name: source_destination_stats; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.source_destination_stats (
    source_account character varying(65) NOT NULL,
    destination_account character varying(65) NOT NULL,
    block_count integer,
    total_amount numeric(39,0) DEFAULT NULL::numeric,
    blocktype integer NOT NULL,
    modified_timestamp integer NOT NULL
);


--
-- Name: stats_hourly; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stats_hourly (
    hour_timestamp integer NOT NULL,
    hour_timestamp_utc timestamp without time zone NOT NULL,
    confirmations_count bigint DEFAULT 0 NOT NULL,
    confirmations_without_election_time integer DEFAULT 0 NOT NULL,
    send_volume numeric(39,0) DEFAULT 0 NOT NULL,
    median_latency_ms double precision,
    p95_latency_ms double precision,
    min_latency_ms double precision,
    max_latency_ms double precision,
    send_count integer DEFAULT 0 NOT NULL,
    receive_count integer DEFAULT 0 NOT NULL,
    change_count integer DEFAULT 0 NOT NULL,
    open_count integer DEFAULT 0 NOT NULL,
    active_accounts_count integer DEFAULT 0 NOT NULL,
    processed_blocks_count bigint DEFAULT 0 NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: TABLE stats_hourly; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.stats_hourly IS 'Pre-aggregated hourly statistics for the stats API. Populated by rollup-hourly.mjs script.';


--
-- Name: COLUMN stats_hourly.hour_timestamp; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.stats_hourly.hour_timestamp IS 'Unix timestamp of hour start (divisible by 3600)';


--
-- Name: COLUMN stats_hourly.confirmations_count; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.stats_hourly.confirmations_count IS 'Total confirmed blocks in this hour';


--
-- Name: COLUMN stats_hourly.send_volume; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.stats_hourly.send_volume IS 'Total nano sent in raw units (not converted to NANO)';


--
-- Name: COLUMN stats_hourly.median_latency_ms; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.stats_hourly.median_latency_ms IS 'Median confirmation latency (election_time - local_timestamp*1000)';


--
-- Name: COLUMN stats_hourly.p95_latency_ms; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.stats_hourly.p95_latency_ms IS '95th percentile confirmation latency';


--
-- Name: COLUMN stats_hourly.active_accounts_count; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.stats_hourly.active_accounts_count IS 'Distinct accounts with confirmed blocks this hour';


--
-- Name: accounts accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT accounts_pkey PRIMARY KEY (account);


--
-- Name: blocks blocks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blocks
    ADD CONSTRAINT blocks_pkey PRIMARY KEY (hash);


--
-- Name: stats_hourly stats_hourly_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stats_hourly
    ADD CONSTRAINT stats_hourly_pkey PRIMARY KEY (hour_timestamp);


--
-- Name: account_stats unique_account_stats_account; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_stats
    ADD CONSTRAINT unique_account_stats_account UNIQUE (account);


--
-- Name: accounts_tags unique_accounts_tags; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounts_tags
    ADD CONSTRAINT unique_accounts_tags UNIQUE (account, tag);


--
-- Name: blocks_tags unique_blocks_tags; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blocks_tags
    ADD CONSTRAINT unique_blocks_tags UNIQUE (block_hash, tag);


--
-- Name: historical_price unique_historical_price; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.historical_price
    ADD CONSTRAINT unique_historical_price UNIQUE (source, timestamp_utc);


--
-- Name: rollup_daily unique_rollup_daily; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rollup_daily
    ADD CONSTRAINT unique_rollup_daily UNIQUE ("timestamp");


--
-- Name: source_destination_stats unique_source_destination_stats; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.source_destination_stats
    ADD CONSTRAINT unique_source_destination_stats UNIQUE (source_account, destination_account);


--
-- Name: accounts_account; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX accounts_account ON public.accounts USING btree (account);


--
-- Name: accounts_balance; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX accounts_balance ON public.accounts USING btree (balance);


--
-- Name: accounts_modified_timestamp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX accounts_modified_timestamp ON public.accounts USING btree (modified_timestamp);


--
-- Name: accounts_pending; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX accounts_pending ON public.accounts USING btree (pending);


--
-- Name: accounts_representative; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX accounts_representative ON public.accounts USING btree (representative);


--
-- Name: block_count; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX block_count ON public.source_destination_stats USING btree (block_count);


--
-- Name: blocks_account; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX blocks_account ON public.blocks USING btree (account);


--
-- Name: blocks_amount; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX blocks_amount ON public.blocks USING btree (amount);


--
-- Name: blocks_balance; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX blocks_balance ON public.blocks USING btree (balance);


--
-- Name: blocks_confirmed; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX blocks_confirmed ON public.blocks USING btree (confirmed);


--
-- Name: blocks_election_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX blocks_election_time ON public.blocks USING btree (election_time);


--
-- Name: blocks_local_timestamp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX blocks_local_timestamp ON public.blocks USING btree (local_timestamp);


--
-- Name: blocks_representative; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX blocks_representative ON public.blocks USING btree (representative);


--
-- Name: blocks_subtype; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX blocks_subtype ON public.blocks USING btree (subtype);


--
-- Name: blocks_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX blocks_type ON public.blocks USING btree (type);


--
-- Name: blocktype; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX blocktype ON public.source_destination_stats USING btree (blocktype);


--
-- Name: destination_account; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX destination_account ON public.account_blocks_summary USING btree (destination_account);


--
-- Name: idx_blocks_confirmed_timestamp_election; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_blocks_confirmed_timestamp_election ON public.blocks USING btree (local_timestamp, election_time) WHERE ((confirmed = 1) AND (election_time IS NOT NULL));


--
-- Name: idx_stats_hourly_timestamp_desc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stats_hourly_timestamp_desc ON public.stats_hourly USING btree (hour_timestamp DESC);


--
-- Name: source_account; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX source_account ON public.account_blocks_summary USING btree (source_account);


--
-- Name: total_amount; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX total_amount ON public.source_destination_stats USING btree (total_amount);


--
-- Name: type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX type ON public.account_blocks_summary USING btree (type);


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: -
--

GRANT ALL ON SCHEMA public TO nanodb_user;


--
-- Name: TABLE account_blocks_summary; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.account_blocks_summary TO nanodb_user;


--
-- Name: TABLE account_stats; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.account_stats TO nanodb_user;


--
-- Name: TABLE accounts; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.accounts TO nanodb_user;


--
-- Name: TABLE accounts_tags; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.accounts_tags TO nanodb_user;


--
-- Name: TABLE blocks; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.blocks TO nanodb_user;


--
-- Name: TABLE blocks_tags; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.blocks_tags TO nanodb_user;


--
-- Name: TABLE historical_price; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.historical_price TO nanodb_user;


--
-- Name: TABLE rollup_daily; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.rollup_daily TO nanodb_user;


--
-- Name: TABLE source_destination_stats; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.source_destination_stats TO nanodb_user;


--
-- Name: TABLE stats_hourly; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.stats_hourly TO nanodb_user;


--
-- PostgreSQL database dump complete
--

