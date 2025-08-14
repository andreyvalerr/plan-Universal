<?php
// Рендер HTML-таблицы исходного Excel (последний загруженный файл)
// Требует: libs/SimpleXLSX.php и libs/SimpleXLS.php

session_start();
if (!isset($_SESSION['isAuthenticated']) || $_SESSION['isAuthenticated'] !== true) {
    http_response_code(401);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'Unauthorized';
    exit;
}

$uploadsDir = __DIR__ . '/uploads';

function latestUploadedFile(string $dir): ?string {
    if (!is_dir($dir)) return null;
    $files = glob($dir . '/*.{xls,xlsx}', GLOB_BRACE);
    if (!$files) return null;
    usort($files, function ($a, $b) { return filemtime($b) <=> filemtime($a); });
    return $files[0];
}

$file = latestUploadedFile($uploadsDir);

header('Content-Type: text/html; charset=utf-8');
?>
<!doctype html>
<html lang="ru">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Таблица данных</title>
    <style>
        body { margin: 0; font-family: Arial, sans-serif; }
        .wrap { padding: 10px; }
        .note { color: #555; margin: 10px 0; }
        table.excel { border-collapse: collapse; width: 100%; font-size: 14px; }
        table.excel th, table.excel td { border: 1px solid #ecf0f1; padding: 6px 8px; text-align: left; }
        table.excel th { background: #f5f7f9; position: sticky; top: 0; z-index: 1; }
        .table-scroll { max-height: 600px; overflow: auto; border: 1px solid #ecf0f1; }
    </style>
</head>
<body>
<div class="wrap">
<?php
if (!$file) {
    echo '<div class="note">Файл Excel ещё не загружен. Загрузите .xls или .xlsx выше, чтобы увидеть таблицу.</div>';
    echo '</div></body></html>';
    exit;
}

$ext = strtolower(pathinfo($file, PATHINFO_EXTENSION));

try {
    echo '<div class="note">Источник: ' . htmlspecialchars(basename($file), ENT_QUOTES) . ' (обновлено: ' . date('Y-m-d H:i:s', filemtime($file)) . ')</div>';
    echo '<div class="table-scroll">';
    if ($ext === 'xlsx') {
        require_once __DIR__ . '/libs/SimpleXLSX.php';
        if ($xlsx = \Shuchkin\SimpleXLSX::parse($file)) {
            // Рендерим первый лист
            echo $xlsx->toHTML(0);
        } else {
            echo '<div class="note">Ошибка чтения XLSX: ' . htmlspecialchars(\Shuchkin\SimpleXLSX::parseError(), ENT_QUOTES) . '</div>';
        }
    } else {
        require_once __DIR__ . '/libs/SimpleXLS.php';
        if ($xls = \Shuchkin\SimpleXLS::parse($file)) {
            echo $xls->toHTML(0);
        } else {
            echo '<div class="note">Ошибка чтения XLS: ' . htmlspecialchars(\Shuchkin\SimpleXLS::parseError(), ENT_QUOTES) . '</div>';
        }
    }
    echo '</div>';
} catch (Throwable $e) {
    echo '<div class="note">Исключение при рендере таблицы: ' . htmlspecialchars($e->getMessage(), ENT_QUOTES) . '</div>';
}
?>
</div>
</body>
</html>


