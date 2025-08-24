<?php
// Общие функции аутентификации и «запомнить меня»

// Секрет для подписи cookie «remember me». Замените на собственный случайный секрет.
// Можно брать из переменной окружения, если есть: REMEMBER_ME_SECRET
$__REMEMBER_ME_SECRET = getenv('REMEMBER_ME_SECRET') ?: 'change-this-secret-to-a-long-random-string';

/**
 * Создать cookie «remember me» на 30 дней для указанного пользователя.
 */
function setRememberMeCookie(string $username): void {
    global $__REMEMBER_ME_SECRET;
    $expiresAt = time() + 60 * 60 * 24 * 30; // 30 дней
    $payload = $username . '|' . $expiresAt;
    $signature = hash_hmac('sha256', $payload, $__REMEMBER_ME_SECRET);
    $token = base64_encode($payload . '|' . $signature);

    // Путь к приложению (подстрахуемся указав корень проекта)
    $path = '/plan-Universal';
    // Устанавливаем cookie (HTTP only, SameSite=Lax). Для HTTPS можно включить secure=true
    setcookie('remember_me', $token, [
        'expires'  => $expiresAt,
        'path'     => $path,
        'httponly' => true,
        'samesite' => 'Lax',
        // 'secure' => true, // включить на HTTPS
    ]);
}

/**
 * Удалить cookie «remember me».
 */
function clearRememberMeCookie(): void {
    $path = '/plan-Universal';
    setcookie('remember_me', '', [
        'expires'  => time() - 3600,
        'path'     => $path,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
}

/**
 * Если серверной сессии нет, но есть валидный remember_me cookie — поднять сессию.
 */
function ensureSessionFromRememberMe(): void {
    if (isset($_SESSION['isAuthenticated']) && $_SESSION['isAuthenticated'] === true) {
        return;
    }
    if (empty($_COOKIE['remember_me'])) {
        return;
    }

    global $__REMEMBER_ME_SECRET;
    $raw = base64_decode($_COOKIE['remember_me'], true);
    if ($raw === false) { return; }
    $parts = explode('|', $raw);
    if (count($parts) !== 3) { return; }
    [$username, $expiresAt, $sig] = $parts;
    if (!ctype_digit($expiresAt) || (int)$expiresAt < time()) { return; }

    $payload = $username . '|' . $expiresAt;
    $expected = hash_hmac('sha256', $payload, $__REMEMBER_ME_SECRET);
    if (!hash_equals($expected, $sig)) { return; }

    // Поднимаем сессию
    $_SESSION['isAuthenticated'] = true;
    $_SESSION['username'] = $username;
}

/**
 * Простой хелпер: требуется ли аутентификация и есть ли она сейчас.
 */
function isAuthenticated(): bool {
    return isset($_SESSION['isAuthenticated']) && $_SESSION['isAuthenticated'] === true;
}


