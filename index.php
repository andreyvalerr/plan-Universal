<?php
// Проверка, существует ли куки с авторизацией (для дополнительной серверной защиты)
// Примечание: это дополнение к клиентской проверке через localStorage
session_start();

require_once __DIR__ . '/auth.php';
// Если сессии нет — попытаться поднять по remember_me
ensureSessionFromRememberMe();

// Нормализуем базовый путь приложения и путь запроса
$basePath = rtrim(dirname($_SERVER['SCRIPT_NAME']), '/');
$requestPath = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

// Если страница - login.html, то не делаем перенаправление, чтобы избежать бесконечной петли
$isLoginPage = (strpos($requestPath, 'login.html') !== false);

// Не перенаправляем запросы к SVG-файлам, находящимся в папке floor_plan_svg
$isSvgFile = (strpos($requestPath, 'floor_plan_svg/') !== false && strpos($requestPath, '.svg') !== false);

// Разрешаем доступ к API (обработка загрузки Excel) только для авторизованных, 
// но не перенаправляем, чтобы API мог вернуть 401 JSON, а не HTML.
$isApiRequest = (strpos($requestPath, '/api.php') !== false);
// Разрешаем доступ к проверке сессии без редиректа
$isSessionCheck = (strpos($requestPath, '/session.php') !== false);

// Проверяем авторизацию только если это не страница входа и не SVG-файл
if (!$isLoginPage && !$isSvgFile && !$isApiRequest && !$isSessionCheck) {
    // Если пользователь не авторизован через PHP сессию
    if (!isAuthenticated()) {
        // Перенаправляем на страницу входа
        $loginUrl = ($basePath !== '' ? $basePath : '') . '/login.html';
        header('Location: ' . $loginUrl);
        exit;
    }
}

// Если запрос к корню приложения или к index.html/index.php внутри подкаталога — отдаём index.html
if (
    $requestPath === $basePath . '/' ||
    $requestPath === $basePath ||
    $requestPath === $basePath . '/index.html' ||
    $requestPath === $basePath . '/index.php'
) {
    include('index.html');
    exit;
}

// Если запрос к другому файлу (style.css, script.js, svg и т.д.), показываем его
// Строим путь относительно базового префикса приложения
$relativePath = ltrim(substr($requestPath, strlen($basePath)), '/');
$filePath = __DIR__ . '/' . $relativePath;
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
    
    // Для SVG отключаем кэширование, чтобы изменения были видны сразу
    if ($extension === 'svg') {
        header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
        header('Pragma: no-cache');
        header('Expires: 0');
    }
    
    readfile($filePath);
    exit;
}
?> 