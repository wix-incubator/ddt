<?php

require 'ddt.php';

// $channels = string;
// default is: $_GET['channels']

// $options = array('name' => string, expires => int, path => string);
// defaults are: ddt_watch, 1 year, /

// if you want to use the addtional options:
// \DVNT\DDT::writeAndExit($channels, $options);

\DVNT\DDT::writeAndExit();
