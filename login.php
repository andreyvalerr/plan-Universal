<?php
// Начинаем сессию
session_start();

// Получаем данные из POST запроса
$username = isset($_POST['username']) ? $_POST['username'] : '';
$password = isset($_POST['password']) ? $_POST['password'] : '';

// Проверяем учетные данные (замените на свои или подключите к базе данных)
$validUsername = 'admin';
$validPassword = 'Pbey*n';

// Формируем ответ
$response = [];

if ($username === $validUsername && $password === $validPassword) {
    // Устанавливаем статус авторизации в сессии
    $_SESSION['isAuthenticated'] = true;
    $_SESSION['username'] = $username;
    
    // Успешная авторизация
    $response['success'] = true;
} else {
    // Ошибка авторизации
    $response['success'] = false;
    $response['message'] = 'Неверный логин или пароль';
}

// Отправляем ответ в формате JSON
header('Content-Type: application/json');
echo json_encode($response);
?> 