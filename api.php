<?php
// API: загрузка и парсинг Excel (.xls/.xlsx), хранение и отдача данных в формате JSON
// Требует: libs/SimpleXLSX.php и libs/SimpleXLS.php

session_start();

require_once __DIR__ . '/auth.php';
// Поднимаем сессию по remember_me при необходимости
ensureSessionFromRememberMe();

// Защищаем API: требуется авторизация через PHP-сессию
if (!isAuthenticated()) {
    http_response_code(401);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => 'Unauthorized']);
    exit;
}

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$dataDir = __DIR__ . '/data';
$uploadsDir = __DIR__ . '/uploads';
$dataFile = $dataDir . '/rooms.json';

if (!is_dir($dataDir)) { @mkdir($dataDir, 0775, true); }
if (!is_dir($uploadsDir)) { @mkdir($uploadsDir, 0775, true); }

function respondJson($payload, $code = 200) {
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    exit;
}

function normalizeString($value) {
    if ($value === null) return '';
    if (is_numeric($value)) return (string)$value;
    return trim((string)$value);
}

function parseExcelToRooms(array $rows) {
    // Ожидается строка заголовков с колонкой "Объект недвижимости". Ищем её гибко
    $rooms = [];
    if (empty($rows)) { return $rooms; }

    // Поиск строки заголовков в первых 20 строках
    $headerRowIdx = null;
    $headers = [];
    $maxScan = min(20, count($rows));
    for ($r = 0; $r < $maxScan; $r++) {
        $candidate = array_map('normalizeString', $rows[$r] ?? []);
        foreach ($candidate as $c) {
            if ($c !== '' && mb_stripos($c, 'объект недвиж') !== false) {
                $headerRowIdx = $r;
                $headers = $candidate;
                break 2;
            }
        }
    }
    if ($headerRowIdx === null) {
        // Фолбэк: предположим 4‑ю строку как в старой таблице
        $headerRowIdx = 3;
        $headers = array_map('normalizeString', $rows[3] ?? []);
    }

    $objectIndex   = array_search('Объект недвижимости', $headers);
    $tenantIndex   = array_search('Контрагент', $headers);
    $contractIndex = array_search('Договор', $headers);
    $rentIndex     = array_search('Сумма', $headers);
    $statusIndex   = array_search('Статус', $headers);
    // Новые поля: Площадь и Площадь по договору
    $areaIndex           = array_search('Площадь', $headers);
    $contractAreaIndex   = array_search('Площадь по договору', $headers);

    // Частичные совпадения, если точных заголовков нет
    if ($objectIndex === false) {
        foreach ($headers as $idx => $h) {
            if ($h !== '' && mb_stripos($h, 'объект') !== false) { $objectIndex = $idx; break; }
        }
    }
    if ($tenantIndex === false) {
        foreach ($headers as $idx => $h) {
            if ($h !== '' && (mb_stripos($h, 'контраг') !== false || mb_stripos($h, 'арендатор') !== false)) { $tenantIndex = $idx; break; }
        }
    }
    if ($rentIndex === false) {
        foreach ($headers as $idx => $h) {
            if ($h !== '' && (mb_stripos($h, 'сумм') !== false || mb_stripos($h, 'плата') !== false)) { $rentIndex = $idx; break; }
        }
    }
    if ($statusIndex === false) {
        foreach ($headers as $idx => $h) {
            if ($h !== '' && mb_stripos($h, 'статус') !== false) { $statusIndex = $idx; break; }
        }
    }
    // Эвристики для поиска колонок площадей, если точных заголовков нет
    if ($areaIndex === false || $contractAreaIndex === false) {
        foreach ($headers as $idx => $h) {
            $hl = $h !== '' ? mb_strtolower($h, 'UTF-8') : '';
            if ($hl === '') continue;
            if (mb_stripos($hl, 'площад') !== false) {
                // Если указание на договор присутствует — это договорная площадь
                if (mb_stripos($hl, 'догов') !== false || mb_stripos($hl, 'по дог') !== false) {
                    if ($contractAreaIndex === false) { $contractAreaIndex = $idx; }
                } else {
                    if ($areaIndex === false) { $areaIndex = $idx; }
                }
            }
        }
    }

    // Начинаем со строки, следующей за заголовком
    $startRow = $headerRowIdx + 1;
    for ($i = $startRow; $i < count($rows); $i++) {
        $row = $rows[$i];
        if (!is_array($row)) continue;

        $obj = $objectIndex !== false && isset($row[$objectIndex]) ? normalizeString($row[$objectIndex]) : '';
        if ($obj === '') continue;

        // Пропускаем заголовки этажей и итоги
        $objLower = mb_strtolower($obj, 'UTF-8');
        if (mb_strpos($objLower, 'этаж') !== false || mb_strpos($objLower, 'итого') !== false || mb_strpos($objLower, '№') === false) {
            continue;
        }

        // Извлекаем номер помещения: "№\s*(\d+[А-Яа-я]?)"
        $roomNumber = null;
        if (preg_match('/№\s*(\d+[А-Яа-я]?)/u', $obj, $m)) {
            $roomNumber = $m[1];
        } else {
            continue;
        }

        // Извлекаем номер строения: "строение X[/Y]" -> "X" или "X-Y"
        $buildingNumber = '19';
        if (preg_match('/строение\s+(\d+)(?:\/(\d+))?/iu', $obj, $bm)) {
            if (!empty($bm[2])) {
                $buildingNumber = $bm[1] . '-' . $bm[2];
            } else {
                $buildingNumber = $bm[1];
            }
        }

        // Определяем этаж
        $floor = 'floor-1';
        if (mb_strpos($objLower, 'подвал') !== false || mb_strpos($objLower, 'цоколь') !== false || preg_match('/№\s*\d+[А-Яа-я]?\s+подв/ui', $obj)) {
            $floor = 'floor-0';
        } else {
            // Сканируем назад заголовки этажей
            for ($j = $i - 1; $j >= 0; $j--) {
                $prev = isset($rows[$j][$objectIndex]) ? normalizeString($rows[$j][$objectIndex]) : '';
                if ($prev === '') continue;
                $prevLower = mb_strtolower($prev, 'UTF-8');
                if (mb_strpos($prevLower, 'подвал') !== false) { $floor = 'floor-0'; break; }
                if (mb_strpos($prevLower, 'этаж') !== false) {
                    if (preg_match('/(^|[^\d])(0)\s*этаж/u', $prevLower)) { $floor = 'floor-0'; break; }
                    if (preg_match('/(^|[^\d])(1)\s*этаж/u', $prevLower)) { $floor = 'floor-1'; break; }
                    if (preg_match('/(^|[^\d])(2)\s*этаж/u', $prevLower)) { $floor = 'floor-2'; break; }
                    if (preg_match('/(^|[^\d])(3)\s*этаж/u', $prevLower)) { $floor = 'floor-3'; break; }
                    if (preg_match('/(^|[^\d])(4)\s*этаж/u', $prevLower)) { $floor = 'floor-4'; break; }
                }
            }
        }

        // Значения
        $tenant        = ($tenantIndex !== false && isset($row[$tenantIndex]))             ? normalizeString($row[$tenantIndex])           : '';
        $contract      = ($contractIndex !== false && isset($row[$contractIndex]))         ? normalizeString($row[$contractIndex])         : '';
        $rent          = ($rentIndex !== false && isset($row[$rentIndex]))                 ? normalizeString($row[$rentIndex])             : '';
        $status        = ($statusIndex !== false && isset($row[$statusIndex]))             ? normalizeString($row[$statusIndex])           : '';
        $area          = ($areaIndex !== false && isset($row[$areaIndex]))                 ? normalizeString($row[$areaIndex])             : '';
        $contractArea  = ($contractAreaIndex !== false && isset($row[$contractAreaIndex])) ? normalizeString($row[$contractAreaIndex])     : '';

        // Статус занятости: по статусу или факту наличия контрагента
        $isOccupied = false;
        if ($status !== '') {
            $isOccupied = (bool)preg_match('/аренд|занят/iu', $status);
        }
        if (!$isOccupied && $tenant !== '') {
            $isOccupied = true;
        }

        $rooms[] = [
            'number'   => $roomNumber,
            'building' => $buildingNumber,
            'floor'    => $floor,
            'tenant'   => $isOccupied ? ($tenant ?: null) : null,
            'contract' => $isOccupied ? ($contract ?: null) : null,
            'rent'     => $isOccupied ? ($rent ?: null) : null,
            // Площади передаем как есть (могут содержать единицы измерения), независимо от статуса
            'area'          => ($area !== '') ? $area : null,
            'contractArea'  => ($contractArea !== '') ? $contractArea : null,
        ];
    }

    return $rooms;
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    // Отдаём сохранённый JSON
    if (file_exists($dataFile)) {
        $content = file_get_contents($dataFile);
        $json = json_decode($content, true);
        if (json_last_error() === JSON_ERROR_NONE) {
            respondJson($json);
        } else {
            respondJson([], 200);
        }
    } else {
        respondJson([], 200);
    }
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!isset($_FILES['file'])) {
        respondJson(['error' => 'No file uploaded'], 400);
    }

    $file = $_FILES['file'];
    if ($file['error'] !== UPLOAD_ERR_OK) {
        respondJson(['error' => 'Upload error: ' . $file['error']], 400);
    }

    $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
    if (!in_array($ext, ['xls', 'xlsx'])) {
        respondJson(['error' => 'Unsupported file type'], 415);
    }

    $target = $uploadsDir . '/' . date('Ymd_His') . '_' . preg_replace('/[^A-Za-z0-9_.-]/', '_', $file['name']);
    if (!move_uploaded_file($file['tmp_name'], $target)) {
        respondJson(['error' => 'Failed to move uploaded file (permissions?)'], 500);
    }

    // Читаем Excel
    $rows = [];
    try {
        if ($ext === 'xlsx') {
            require_once __DIR__ . '/libs/SimpleXLSX.php';
            if ($xlsx = \Shuchkin\SimpleXLSX::parse($target)) {
                $rows = $xlsx->rows();
            } else {
                respondJson(['error' => \Shuchkin\SimpleXLSX::parseError()], 400);
            }
        } else {
            require_once __DIR__ . '/libs/SimpleXLS.php';
            if ($xls = \Shuchkin\SimpleXLS::parse($target)) {
                $rows = $xls->rows();
            } else {
                respondJson(['error' => \Shuchkin\SimpleXLS::parseError()], 400);
            }
        }
    } catch (Throwable $e) {
        respondJson(['error' => 'Parse error: ' . $e->getMessage()], 500);
    }

    // Парсим в структуру помещений
    $rooms = parseExcelToRooms($rows);

    // Сохраняем
    $payload = $rooms;
    if (!is_dir($dataDir)) { @mkdir($dataDir, 0775, true); }
    if (false === @file_put_contents($dataFile, json_encode($payload, JSON_UNESCAPED_UNICODE))) {
        // Не критично: возвращаем данные, даже если сохранить не удалось
        respondJson(['warning' => 'Cannot write rooms.json (permissions)', 'data' => $payload], 200);
    }

    respondJson($payload, 200);
}

// Если метод не поддерживается
respondJson(['error' => 'Method not allowed'], 405);


