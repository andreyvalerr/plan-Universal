<?php
// Проверка, существует ли куки с авторизацией (для дополнительной серверной защиты)
// Примечание: это дополнение к клиентской проверке через localStorage
session_start();

// Если страница - login.html, то не делаем перенаправление, чтобы избежать бесконечной петли
$isLoginPage = (strpos($_SERVER['REQUEST_URI'], 'login.html') !== false);

// Не перенаправляем запросы к SVG-файлам, находящимся в папке floor_plan_svg
$isSvgFile = (strpos($_SERVER['REQUEST_URI'], 'floor_plan_svg/') !== false && strpos($_SERVER['REQUEST_URI'], '.svg') !== false);

// Проверяем авторизацию только если это не страница входа и не SVG-файл
if (!$isLoginPage && !$isSvgFile) {
    // Если пользователь не авторизован через PHP сессию
    if (!isset($_SESSION['isAuthenticated']) || $_SESSION['isAuthenticated'] !== true) {
        // Перенаправляем на страницу входа
        header('Location: login.html');
        exit;
    }
}

// Проверяем, какой файл запросили
$requestedFile = $_SERVER['REQUEST_URI'];

// Если запрос к корню сайта или к index.html/index.php
if ($requestedFile == '/' || 
    $requestedFile == '/index.html' || 
    $requestedFile == '/index.php') {
    // Показываем index.html
    include('index.html');
    exit;
}

// Если запрос к другому файлу (style.css, script.js, svg и т.д.), показываем его
$filePath = __DIR__ . $requestedFile;
if (file_exists($filePath) && is_file($filePath)) {
    // Определение MIME-типа
    $mimeTypes = [
        'css' => 'text/css',
        'js' => 'application/javascript',
        'svg' => 'image/svg+xml',
        'html' => 'text/html',
        'json' => 'application/json',
        'png' => 'image/png',
        'jpg' => 'image/jpeg',
        'jpeg' => 'image/jpeg',
        'gif' => 'image/gif',
    ];
    
    $extension = pathinfo($filePath, PATHINFO_EXTENSION);
    if (isset($mimeTypes[$extension])) {
        header('Content-Type: ' . $mimeTypes[$extension]);
    }
    
    readfile($filePath);
    exit;
}
?> 