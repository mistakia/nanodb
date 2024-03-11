DROP TABLE IF EXISTS accounts;

CREATE TABLE
  accounts (
    account character varying(65) DEFAULT NULL::character varying,
    frontier character varying(64) DEFAULT NULL::character varying,
    open_block character varying(64) DEFAULT NULL::character varying,
    representative_block character varying(64) DEFAULT NULL::character varying,
    balance numeric(39) DEFAULT NULL::numeric,
    modified_timestamp integer DEFAULT NULL::integer,
    block_count integer DEFAULT NULL::integer,
    confirmation_height integer DEFAULT NULL::integer,
    confirmation_height_frontier character varying(64) DEFAULT NULL::character varying,
    representative character varying(65) DEFAULT NULL::character varying,
    weight numeric(39) DEFAULT NULL::numeric,
    pending character varying(39) DEFAULT NULL::character varying,
    key character varying(64) DEFAULT NULL::character varying
  );

CREATE INDEX accounts_account ON accounts USING btree (account);

CREATE INDEX accounts_balance ON accounts USING btree (balance);

CREATE INDEX accounts_representative ON accounts USING btree (representative);

CREATE INDEX accounts_pending ON accounts USING btree (pending);

CREATE INDEX accounts_modified_timestamp ON accounts USING btree (modified_timestamp);

ALTER TABLE accounts
ADD PRIMARY KEY (account);

--
--
DROP TABLE IF EXISTS blocks;

CREATE TABLE
  blocks (
    hash character varying(65) DEFAULT NULL::character varying,
    amount numeric(39) DEFAULT NULL::numeric,
    balance numeric(39) DEFAULT NULL::numeric,
    height integer DEFAULT NULL::integer,
    local_timestamp integer DEFAULT NULL::integer,
    confirmed integer DEFAULT NULL::integer,
    type integer DEFAULT NULL::integer,
    account character varying(65) DEFAULT NULL::character varying,
    previous character varying(65) DEFAULT NULL::character varying,
    representative character varying(65) DEFAULT NULL::character varying,
    link character varying(65) DEFAULT NULL::character varying,
    link_account character varying(65) DEFAULT NULL::character varying,
    signature character varying(128) DEFAULT NULL::character varying,
    work character varying(16) DEFAULT NULL::character varying,
    subtype integer DEFAULT NULL::integer,
    election_duration integer DEFAULT NULL::integer,
    election_time bigint DEFAULT NULL::bigint,
    election_tally numeric(39) DEFAULT NULL::numeric,
    election_request_count integer DEFAULT NULL::integer,
    election_blocks integer DEFAULT NULL::integer,
    election_voters integer DEFAULT NULL::integer
  );

CREATE INDEX blocks_account ON blocks USING btree (account);

CREATE INDEX blocks_type ON blocks USING btree (
  type
);

CREATE INDEX blocks_subtype ON blocks USING btree (subtype);

CREATE INDEX blocks_amount ON blocks USING btree (amount);

CREATE INDEX blocks_balance ON blocks USING btree (balance);

CREATE INDEX blocks_representative ON blocks USING btree (representative);

CREATE INDEX blocks_local_timestamp ON blocks USING btree (local_timestamp);

CREATE INDEX blocks_confirmed ON blocks USING btree (confirmed);

CREATE INDEX blocks_election_time ON blocks USING btree (election_time);

ALTER TABLE blocks
ADD PRIMARY KEY (hash);

--
--
DROP TABLE IF EXISTS account_stats;

CREATE TABLE
  account_stats (
    account character varying(65) NOT NULL,
    block_count integer NOT NULL,
    account_count integer NOT NULL,
    min_timestamp integer NOT NULL,
    max_timestamp integer NOT NULL,
    min_amount numeric(39) DEFAULT NULL,
    max_amount numeric(39) DEFAULT NULL,
    total_amount numeric(39) DEFAULT NULL,
    max_account character varying(65) NOT NULL,
    type integer NOT NULL,
    CONSTRAINT unique_account_stats_account UNIQUE (account)
  );

--
--
DROP TABLE IF EXISTS account_blocks_summary;

CREATE TABLE
  account_blocks_summary (
    source_account character varying(65) NOT NULL,
    destination_account character varying(65) NOT NULL,
    type character varying(7) NOT NULL,
    block_count integer DEFAULT NULL,
    min_timestamp integer NOT NULL,
    max_timestamp integer NOT NULL,
    min_amount numeric(39) DEFAULT NULL,
    max_amount numeric(39) DEFAULT NULL,
    total_amount numeric(39) DEFAULT NULL
  );

CREATE INDEX
type ON account_blocks_summary USING btree (
  type
);

CREATE INDEX source_account ON account_blocks_summary USING btree (source_account);

CREATE INDEX destination_account ON account_blocks_summary USING btree (destination_account);

--
--
DROP TABLE IF EXISTS accounts_tags;

CREATE TABLE
  accounts_tags (
    account character varying(65) NOT NULL,
    tag character varying(65) NOT NULL,
    CONSTRAINT unique_accounts_tags UNIQUE (account, tag)
  );

--
--
DROP TABLE IF EXISTS rollup_daily;

CREATE TABLE
  rollup_daily (
    active_addresses integer DEFAULT 0,
    blocks integer DEFAULT 0,
    send_count integer DEFAULT 0,
    open_count integer DEFAULT 0,
    receive_count integer DEFAULT 0,
    change_count integer DEFAULT 0,
    send_volume numeric(39) DEFAULT 0, -- amount of nano sent
    change_volume numeric(39) DEFAULT 0, -- amount of voting weight shifted
    receive_volume numeric(39) DEFAULT 0, -- amount of nano received
    open_volume numeric(39) DEFAULT 0,
    _1000000_count integer DEFAULT 0,
    _100000_count integer DEFAULT 0,
    _10000_count integer DEFAULT 0,
    _1000_count integer DEFAULT 0,
    _100_count integer DEFAULT 0,
    _10_count integer DEFAULT 0,
    _1_count integer DEFAULT 0,
    _01_count integer DEFAULT 0,
    _001_count integer DEFAULT 0,
    _0001_count integer DEFAULT 0,
    _00001_count integer DEFAULT 0,
    _000001_count integer DEFAULT 0,
    _000001_below_count integer DEFAULT 0,
    _1000000_total numeric(39) DEFAULT 0,
    _100000_total numeric(39) DEFAULT 0,
    _10000_total numeric(39) DEFAULT 0,
    _1000_total numeric(39) DEFAULT 0,
    _100_total numeric(39) DEFAULT 0,
    _10_total numeric(39) DEFAULT 0,
    _1_total numeric(39) DEFAULT 0,
    _01_total numeric(39) DEFAULT 0,
    _001_total numeric(39) DEFAULT 0,
    _0001_total numeric(39) DEFAULT 0,
    _00001_total numeric(39) DEFAULT 0,
    _000001_total numeric(39) DEFAULT 0,
    _000001_below_total numeric(39) DEFAULT 0,
    timestamp integer NOT NULL,
    timestamp_utc timestamp without time zone NOT NULL,
    CONSTRAINT unique_rollup_daily UNIQUE (timestamp)
  );

--
--
DROP TABLE IF EXISTS source_destination_stats;

CREATE TABLE
  source_destination_stats (
    source_account character varying(65) NOT NULL,
    destination_account character varying(65) NOT NULL,
    block_count integer DEFAULT NULL::integer,
    total_amount numeric(39) DEFAULT NULL::numeric,
    blocktype integer NOT NULL,
    modified_timestamp integer NOT NULL,
    CONSTRAINT unique_source_destination_stats UNIQUE (source_account, destination_account)
  );

CREATE INDEX total_amount ON source_destination_stats USING btree (total_amount);

CREATE INDEX blocktype ON source_destination_stats USING btree (blocktype);

CREATE INDEX block_count ON source_destination_stats USING btree (block_count);

DROP TABLE IF EXISTS historical_price;

CREATE TABLE
  historical_price (
    source character varying(10) NOT NULL,
    timestamp_utc timestamp without time zone NOT NULL,
    price numeric(39, 18) NOT NULL,
    volume numeric(39, 2) NOT NULL,
    CONSTRAINT unique_historical_price UNIQUE (source, timestamp_utc)
  );
