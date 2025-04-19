<?php
// Начинаем сессию
session_start();

// Очищаем все переменные сессии
$_SESSION = array();

// Если используются куки сессии, удаляем их
if (ini_get("session.use_cookies")) {
    $params = session_get_cookie_params();
    setcookie(session_name(), '', time() - 42000,
        $params["path"], $params["domain"],
        $params["secure"], $params["httponly"]
    );
}

// Уничтожаем сессию
session_destroy();

// Перенаправляем на страницу входа
header('Location: login.html');
exit;
?> 