
DROP TABLE accounts;
CREATE TABLE accounts (
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
    weight numeric(39) DEFAULT NULL::numeric ,
    pending character varying(39) DEFAULT NULL::character varying,
    key character varying(64) DEFAULT NULL::character varying
);


CREATE INDEX accounts_account ON accounts USING btree(account);
CREATE INDEX accounts_balance ON accounts USING btree(balance);
CREATE INDEX accounts_representative ON accounts USING btree(representative);
CREATE INDEX accounts_pending ON accounts USING btree(pending);
CREATE INDEX accounts_modified_timestamp ON accounts USING btree(modified_timestamp);
ALTER TABLE accounts ADD PRIMARY KEY (account);



--
--
DROP TABLE blocks;
CREATE TABLE blocks (
    hash character varying(65) DEFAULT NULL::character varying,
    amount numeric(39) DEFAULT NULL::numeric,
    balance numeric(39) DEFAULT NULL::numeric,
    height integer DEFAULT NULL::integer,
    local_timestamp integer  DEFAULT NULL::integer ,
    confirmed integer DEFAULT NULL::integer,
    type integer DEFAULT NULL::integer,
    account character varying(65) DEFAULT NULL::character varying,
    previous character varying(65) DEFAULT NULL::character varying,
    representative character varying(65) DEFAULT NULL::character varying,
    link character varying(65) DEFAULT NULL::character varying,
    link_as_account character varying(65) DEFAULT NULL::character varying,
    signature character varying(128) DEFAULT NULL::character varying,
    work character varying(16) DEFAULT NULL::character varying,
    subtype integer DEFAULT NULL::integer 
);

CREATE INDEX blocks_account ON blocks USING btree(account);
CREATE INDEX blocks_type ON blocks USING btree(type);
CREATE INDEX blocks_subtype ON blocks USING btree(subtype);
CREATE INDEX blocks_amount ON blocks USING btree(amount);
CREATE INDEX blocks_balance ON blocks USING btree(balance);
CREATE INDEX blocks_representative ON blocks USING btree(representative);
CREATE INDEX blocks_local_timestamp ON blocks USING btree(local_timestamp);
ALTER TABLE blocks ADD PRIMARY KEY (hash);