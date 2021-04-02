-- --------------------------------------------------------

--
-- Table structure for table `accounts`
--

DROP TABLE IF EXISTS `accounts`;

CREATE TABLE `accounts` (
  `account` varchar(65) NOT NULL,
  `frontier` varchar(64) DEFAULT NULL,
  `open_block` varchar(64) DEFAULT NULL,
  `representative_block` varchar(64) DEFAULT NULL,
  `balance` varchar(39) DEFAULT NULL,
  `modified_timestamp` int(11) DEFAULT NULL,
  `block_count` int(11) DEFAULT NULL,
  `confirmation_height` int(11) DEFAULT NULL,
  `confirmation_height_frontier` varchar(64) DEFAULT NULL,
  `key` varchar(64) DEFAULT NULL,
  UNIQUE KEY `account` (`account`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `block`
--

DROP TABLE IF EXISTS `blocks`;

CREATE TABLE `blocks` (
  `hash` varchar(64) NOT NULL,
  `amount` varchar(39) NOT NULL,
  `balance` varchar(39) NOT NULL,
  `height` int(11) NOT NULL,
  `local_timestamp` int(11) NOT NULL,
  `confirmed` tinyint(1) NOT NULL,
  `type` tinyint(1) NOT NULL,
  `account` varchar(65) NOT NULL,
  `previous` varchar(64) NOT NULL,
  `representative` varchar(65) NOT NULL,
  `link` varchar(64) NOT NULL,
  `link_as_account` varchar(65) NOT NULL,
  `signature` varchar(128) NOT NULL,
  `work` varchar(16) NOT NULL,
  `subtype` tinyint(1) NOT NULL,
  UNIQUE KEY `block` (`hash`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `votes`
--
