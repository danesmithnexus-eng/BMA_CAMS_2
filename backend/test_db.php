<?php
$mysqli = new mysqli("127.0.0.1", "root", "", "bma_cams_db");

if ($mysqli->connect_errno) {
    echo "Failed to connect to MySQL: " . $mysqli->connect_error;
    exit();
}

$result = $mysqli->query("SELECT * FROM users");
$users = $result->fetch_all(MYSQLI_ASSOC);

echo json_encode($users, JSON_PRETTY_PRINT);

$mysqli->close();
?>
