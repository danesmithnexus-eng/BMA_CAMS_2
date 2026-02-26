<?php

$host = '127.0.0.1';
$db = 'bma_cams_db';

$creds = [
    ['root', ''],
    ['root', 'root'],
    ['root', 'password'],
    ['root', '123456'],
    ['admin', 'admin'],
    ['root', 'mysql'],
];

$mysqli = null;
$connected = false;

mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);

foreach ($creds as $pair) {
    try {
        echo "Trying user: '{$pair[0]}' pass: '{$pair[1]}'... ";
        $mysqli = new mysqli($host, $pair[0], $pair[1]);
        echo "Success!\n";
        $connected = true;
        break;
    } catch (Exception $e) {
        echo "Failed: " . $e->getMessage() . "\n";
    }
}

if (!$connected) {
    echo "Could not connect with common credentials.\n";
    exit(1);
}

try {
    $mysqli->query("CREATE DATABASE IF NOT EXISTS $db");
    echo "Database $db created/checked.\n";
    $mysqli->select_db($db);

    $files = glob('../CAMS_DB/*.sql');
    
    // Disable FK checks globally for the session
    $mysqli->query("SET FOREIGN_KEY_CHECKS = 0");

    foreach ($files as $file) {
        echo "Importing " . basename($file) . "...\n";
        $sql = file_get_contents($file);
        
        if ($mysqli->multi_query($sql)) {
            do {
                if ($result = $mysqli->store_result()) {
                    $result->free();
                }
            } while ($mysqli->next_result());
        }
    }

    $mysqli->query("SET FOREIGN_KEY_CHECKS = 1");
    echo "Import completed.\n";

} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
