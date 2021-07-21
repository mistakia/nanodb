-- --------------------------------------------------------

--
-- Table structure for table `accounts`
--

DROP TABLE IF EXISTS `accounts`;

CREATE TABLE `accounts` (
  `account` char(65) NOT NULL,
  `frontier` char(64) DEFAULT NULL,
  `open_block` char(64) DEFAULT NULL,
  `representative_block` char(64) DEFAULT NULL,
  `balance` decimal(39,0) DEFAULT NULL,
  `modified_timestamp` int(11) DEFAULT NULL,
  `block_count` int(11) DEFAULT NULL,
  `confirmation_height` int(11) DEFAULT NULL,
  `confirmation_height_frontier` char(64) DEFAULT NULL,
  `representative` char(65)  NULL,
  `weight` decimal(39,0) DEFAULT NULL,
  `pending` decimal(39,0) DEFAULT NULL,
  `key` char(64) DEFAULT NULL,
  UNIQUE KEY `account` (`account`),
  INDEX `balance` (`balance`),
  INDEX `representative` (`representative`),
  INDEX `pending` (`pending`),
  INDEX `modified_timestamp` (`modified_timestamp`)
) ENGINE=InnoDB;

-- --------------------------------------------------------

--
-- Table structure for table `account_stats`
--

DROP TABLE IF EXISTS `account_stats`;

CREATE TABLE `account_stats` (
  `account` char(65) NOT NULL,
  `block_count` int(11) DEFAULT NULL,
  `account_count` int(11) DEFAULT NULL,
  `min_timestamp` int(11) NOT NULL,
  `max_timestamp` int(11) NOT NULL,
  `min_amount` decimal(39,0) DEFAULT NULL,
  `max_amount` decimal(39,0) DEFAULT NULL,
  `total_amount` decimal(39,0) DEFAULT NULL,
  `max_account` char(65) NOT NULL,
  `type` tinyint(1) NOT NULL
  UNIQUE KEY `account` (`account`, `type`),
  INDEX `total_amount` (`total_amount`),
  INDEX `type` (`type`),
  INDEX `block_count` (`block_count`)
) ENGINE=InnoDB;

-- --------------------------------------------------------

--
-- Table structure for table `account_blocks_summary`
--

DROP TABLE IF EXISTS `account_blocks_summary`;

CREATE TABLE `account_blocks_summary` (
  `source_account` char(65) NOT NULL,
  `destination_account` char(65) NOT NULL,
  `type` varchar(7) NOT NULL,
  `block_count` int(11) DEFAULT NULL,
  `min_timestamp` int(11) NOT NULL,
  `max_timestamp` int(11) NOT NULL,
  `min_amount` decimal(39,0) DEFAULT NULL,
  `max_amount` decimal(39,0) DEFAULT NULL,
  `total_amount` decimal(39,0) DEFAULT NULL,
  INDEX `type` (`type`),
  INDEX `source_account` (`source_account`),
  INDEX `destination_account` (`destination_account`)
) ENGINE=InnoDB;

-- --------------------------------------------------------

--
-- Table structure for table `block`
--

DROP TABLE IF EXISTS `blocks`;

CREATE TABLE `blocks` (
  `hash` char(64) NOT NULL,
  `amount` decimal(39,0) DEFAULT NULL,
  `balance` decimal(39,0) DEFAULT NULL,
  `height` int(11) NOT NULL,
  `local_timestamp` int(11) NOT NULL,
  `confirmed` tinyint(1) NOT NULL,
  `type` tinyint(1) NOT NULL,
  `account` char(65) NOT NULL,
  `previous` char(64) DEFAULT NULL,
  `representative` char(65) DEFAULT NULL,
  `link` char(65) DEFAULT NULL,
  `link_account` char(65) DEFAULT NULL,
  `signature` char(128) NOT NULL,
  `work` char(16) NOT NULL,
  `subtype` tinyint(1) DEFAULT NULL,
  UNIQUE KEY `block` (`hash`),
  UNIQUE KEY `height` (`account`, `height`),
  INDEX `account` (`account`),
  INDEX `type` (`type`),
  INDEX `subtype` (`subtype`),
  INDEX `amount` (`amount`),
  INDEX `balance` (`balance`),
  INDEX `representative` (`representative`),
  INDEX `local_timestamp` (`local_timestamp`),
  INDEX `link_account` (`link_account`)
) ENGINE=InnoDB;

-- --------------------------------------------------------

--
-- Table structure for table `accounts_tags`
--

DROP TABLE IF EXISTS `accounts_tags`;

CREATE TABLE `accounts_tags` (
  `account` char(65) NOT NULL,
  `tag` char(65) NOT NULL,
  UNIQUE KEY `account` (`account`, `tag`)
) ENGINE=InnoDB;

-- --------------------------------------------------------

--
-- Table structure for table `rollup_daily`
--

DROP TABLE IF EXISTS `rollup_daily`;

CREATE TABLE `rollup_daily` (
  `active_addresses` int(11) DEFAULT 0,
  `blocks` int(11) DEFAULT 0,
  `send_count` int(11) DEFAULT 0,
  `open_count` int(11) DEFAULT 0,
  `receive_count` int(11) DEFAULT 0,
  `change_count` int(11) DEFAULT 0,
  `send_volume` decimal(39,0) DEFAULT 0, -- amount of nano sent
  `change_volume` decimal(39,0) DEFAULT 0, -- amount of voting weight shifted
  `receive_volume` decimal(39,0) DEFAULT 0,
  `open_volume` decimal(39,0) DEFAULT 0,

  `_1000000_count` int(11) DEFAULT 0,
  `_100000_count` int(11) DEFAULT 0,
  `_10000_count` int(11) DEFAULT 0,
  `_1000_count` int(11) DEFAULT 0,
  `_100_count` int(11) DEFAULT 0,
  `_10_count` int(11) DEFAULT 0,
  `_1_count` int(11) DEFAULT 0,
  `_01_count` int(11) DEFAULT 0,
  `_001_count` int(11) DEFAULT 0,
  `_0001_count` int(11) DEFAULT 0,
  `_00001_count` int(11) DEFAULT 0,
  `_000001_count` int(11) DEFAULT 0,
  `_000001_below_count` int(11) DEFAULT 0,

  `_1000000_total` decimal(39,0) DEFAULT 0,
  `_100000_total` decimal(39,0) DEFAULT 0,
  `_10000_total` decimal(39,0) DEFAULT 0,
  `_1000_total` decimal(39,0) DEFAULT 0,
  `_100_total` decimal(39,0) DEFAULT 0,
  `_10_total` decimal(39,0) DEFAULT 0,
  `_1_total` decimal(39,0) DEFAULT 0,
  `_01_total` decimal(39,0) DEFAULT 0,
  `_001_total` decimal(39,0) DEFAULT 0,
  `_0001_total` decimal(39,0) DEFAULT 0,
  `_00001_total` decimal(39,0) DEFAULT 0,
  `_000001_total` decimal(39,0) DEFAULT 0,
  `_000001_below_total` decimal(39,0) DEFAULT 0,

  `timestamp` int(11) DEFAULT NULL,
  UNIQUE KEY `timestamp` (`timestamp`)
) ENGINE=InnoDB;

-- --------------------------------------------------------

--
-- Table structure for table `source_destination_stats`
--

DROP TABLE IF EXISTS `source_destination_stats`;

CREATE TABLE `source_destination_stats` (
  `source_account` char(65) NOT NULL,
  `destination_account` char(65) NOT NULL,
  `block_count` int(11) DEFAULT NULL,
  `total_amount` decimal(39,0) DEFAULT NULL,
  `blocktype` tinyint(1) NOT NULL,
  `modified_timestamp` int(11) NOT NULL,
  UNIQUE KEY `link` (`source_account`, `destination_acount`),
  INDEX `total_amount` (`total_amount`),
  INDEX `blocktype` (`blocktype`),
  INDEX `block_count` (`block_count`)
) ENGINE=InnoDB;

-- --------------------------------------------------------

--
-- Table structure for table `votes`
--

DROP TABLE IF EXISTS `votes`;

CREATE TABLE `votes` (
  `account` char(65) NOT NULL,
  `hash` char(64) NOT NULL,
  `vote_timestamp` bigint unsigned NOT NULL,
  `local_timestamp` int(11) NOT NULL,
  UNIQUE KEY `vote` (`account`, `hash`, `vote_timestamp`),
  INDEX `hash` (`hash`),
  INDEX `account` (`account`),
  INDEX `vote_timestamp` (`vote_timestamp`),
  INDEX `local_timestamp` (`local_timestamp`)
) ENGINE=InnoDB;
