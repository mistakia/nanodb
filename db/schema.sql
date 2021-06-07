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
  `balance` varchar(39) DEFAULT NULL,
  `modified_timestamp` int(11) DEFAULT NULL,
  `block_count` int(11) DEFAULT NULL,
  `confirmation_height` int(11) DEFAULT NULL,
  `confirmation_height_frontier` char(64) DEFAULT NULL,
  `representative` char(65) NOT NULL,
  `weight` varchar(39) DEFAULT NULL,
  `pending` varchar(39) DEFAULT NULL,
  `key` char(64) DEFAULT NULL,
  UNIQUE KEY `account` (`account`),
  INDEX `balance` (`balance`),
  INDEX `representative` (`representative`),
  INDEX `pending` (`pending`),
  INDEX `modified_timestamp` (`modified_timestamp`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8 ROW_FORMAT=FIXED;

-- --------------------------------------------------------

--
-- Table structure for table `block`
--

DROP TABLE IF EXISTS `blocks`;

CREATE TABLE `blocks` (
  `hash` char(64) NOT NULL,
  `amount` varchar(39) DEFAULT NULL,
  `balance` varchar(39) DEFAULT NULL,
  `height` int(11) NOT NULL,
  `local_timestamp` int(11) NOT NULL,
  `confirmed` tinyint(1) NOT NULL,
  `type` tinyint(1) NOT NULL,
  `account` char(65) NOT NULL,
  `previous` char(64) DEFAULT NULL,
  `representative` char(65) DEFAULT NULL,
  `link` char(65) DEFAULT NULL,
  `link_as_account` char(65) DEFAULT NULL,
  `signature` char(128) NOT NULL,
  `work` char(16) NOT NULL,
  `subtype` tinyint(1) DEFAULT NULL,
  UNIQUE KEY `block` (`hash`),
  INDEX `account` (`account`),
  INDEX `type` (`type`),
  INDEX `subtype` (`subtype`),
  INDEX `amount` (`amount`),
  INDEX `balance` (`balance`),
  INDEX `representative` (`representative`),
  INDEX `local_timestamp` (`local_timestamp`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8 ROW_FORMAT=FIXED;

-- --------------------------------------------------------

--
-- Table structure for table `votes`
--
