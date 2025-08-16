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
        body { 
            margin: 0; 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
            min-height: 100vh;
        }
        
        .wrap { 
            padding: 20px;
            max-width: 1400px;
            margin: 0 auto;
        }
        
        .note { 
            color: #2c3e50; 
            margin: 15px 0;
            background: rgba(255, 255, 255, 0.9);
            padding: 15px;
            border-radius: 8px;
            border-left: 4px solid #3498db;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
            font-size: 14px;
            font-weight: 500;
        }
        
        .table-scroll { 
            border-radius: 12px;
            box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
            background: white;
            border: none;
            overflow: visible;
        }
        
        table.excel { 
            border-collapse: collapse; 
            width: 100%; 
            font-size: 13px;
            background: white;
            margin: 0;
        }
        
        table.excel th { 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 15px 12px;
            text-align: left;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            font-size: 12px;
            border: none;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }
        
        table.excel td { 
            padding: 12px;
            border: none;
            border-bottom: 1px solid #ecf0f1;
            text-align: left;
            transition: all 0.3s ease;
            vertical-align: top;
            line-height: 1.4;
        }
        
        /* Чередующиеся цвета строк */
        table.excel tr:nth-child(even) {
            background-color: #f8f9fa;
        }
        
        table.excel tr:nth-child(odd) {
            background-color: white;
        }
        
        /* Hover эффект для строк */
        table.excel tr:hover {
            background-color: #e3f2fd !important;
            transform: scale(1.001);
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }
        
        /* Стили для различных типов данных */
        table.excel td[align="right"] {
            font-weight: 600;
            color: #27ae60;
        }
        
        /* Подсветка важных данных */
        table.excel td:first-child {
            font-weight: 600;
            color: #2c3e50;
            border-left: 3px solid transparent;
        }
        
        table.excel tr:hover td:first-child {
            border-left-color: #3498db;
        }
        
        /* Адаптивность для мобильных устройств */
        @media (max-width: 768px) {
            .wrap {
                padding: 10px;
            }
            
            .table-scroll {
                border-radius: 8px;
            }
            
            table.excel {
                font-size: 12px;
            }
            
            table.excel th {
                padding: 10px 8px;
                font-size: 11px;
            }
            
            table.excel td {
                padding: 8px 6px;
            }
            
            .note {
                padding: 10px;
                margin: 10px 0;
                font-size: 13px;
            }
        }
        
        @media (max-width: 480px) {
            table.excel {
                font-size: 11px;
            }
            
            table.excel th, 
            table.excel td {
                padding: 6px 4px;
            }
        }
        
        /* Анимация загрузки */
        .table-scroll {
            animation: fadeIn 0.5s ease-in;
        }
        
        @keyframes fadeIn {
            from {
                opacity: 0;
                transform: translateY(20px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
        
        /* Улучшенные стили для пустых ячеек */
        table.excel td:empty::after {
            content: '—';
            color: #bdc3c7;
            font-style: italic;
        }
    </style>
</head>
<body>
<div class="wrap">
    <!-- Поисковая строка -->
    <div id="search-container" style="margin-bottom: 20px; display: none;">
        <div style="position: relative; max-width: 400px;">
            <input type="text" id="table-search" placeholder="Поиск по таблице..." style="
                width: 100%;
                padding: 12px 40px 12px 15px;
                border: 2px solid #3498db;
                border-radius: 25px;
                font-size: 14px;
                outline: none;
                transition: all 0.3s ease;
                box-shadow: 0 2px 10px rgba(52, 152, 219, 0.2);
            " />
            <span style="
                position: absolute;
                right: 15px;
                top: 50%;
                transform: translateY(-50%);
                color: #3498db;
                font-size: 16px;
            ">🔍</span>
        </div>
        <div id="search-results" style="margin-top: 10px; font-size: 13px; color: #666;"></div>
    </div>
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

<script>
document.addEventListener('DOMContentLoaded', function() {
    const searchContainer = document.getElementById('search-container');
    const searchInput = document.getElementById('table-search');
    const searchResults = document.getElementById('search-results');
    const table = document.querySelector('table.excel');
    
    if (table) {
        // Показать поиск только если есть таблица
        searchContainer.style.display = 'block';
        
        let allRows = Array.from(table.querySelectorAll('tbody tr, tr:not(:first-child)'));
        let visibleRowsCount = allRows.length;
        
        // Функция поиска
        function performSearch(searchTerm) {
            const term = searchTerm.toLowerCase().trim();
            let matchedRows = 0;
            
            allRows.forEach(row => {
                const text = row.textContent.toLowerCase();
                const isMatch = term === '' || text.includes(term);
                
                if (isMatch) {
                    row.style.display = '';
                    matchedRows++;
                    
                    // Подсветка найденного текста
                    if (term && term.length > 0) {
                        highlightText(row, term);
                    } else {
                        removeHighlight(row);
                    }
                } else {
                    row.style.display = 'none';
                    removeHighlight(row);
                }
            });
            
            // Обновить счетчик результатов
            if (term) {
                searchResults.textContent = `Найдено: ${matchedRows} из ${visibleRowsCount} строк`;
                searchResults.style.color = matchedRows > 0 ? '#27ae60' : '#e74c3c';
            } else {
                searchResults.textContent = '';
            }
        }
        
        // Подсветка текста
        function highlightText(row, term) {
            const cells = row.querySelectorAll('td');
            cells.forEach(cell => {
                const originalText = cell.getAttribute('data-original-text') || cell.innerHTML;
                if (!cell.getAttribute('data-original-text')) {
                    cell.setAttribute('data-original-text', originalText);
                }
                
                const regex = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
                const highlightedText = originalText.replace(regex, '<mark style="background-color: #fff3cd; color: #856404; padding: 1px 3px; border-radius: 2px;">$1</mark>');
                cell.innerHTML = highlightedText;
            });
        }
        
        // Удаление подсветки
        function removeHighlight(row) {
            const cells = row.querySelectorAll('td');
            cells.forEach(cell => {
                const originalText = cell.getAttribute('data-original-text');
                if (originalText) {
                    cell.innerHTML = originalText;
                }
            });
        }
        
        // Обработка ввода в поиск с задержкой
        let searchTimeout;
        searchInput.addEventListener('input', function() {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                performSearch(this.value);
            }, 300);
        });
        
        // Эффект фокуса для поискового поля
        searchInput.addEventListener('focus', function() {
            this.style.borderColor = '#2980b9';
            this.style.boxShadow = '0 4px 15px rgba(52, 152, 219, 0.3)';
        });
        
        searchInput.addEventListener('blur', function() {
            this.style.borderColor = '#3498db';
            this.style.boxShadow = '0 2px 10px rgba(52, 152, 219, 0.2)';
        });
        
        // Быстрое очищение поиска по Escape
        searchInput.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                this.value = '';
                performSearch('');
                this.blur();
            }
        });
    }
    
    // Добавить плавную прокрутку к заголовкам
    const headers = document.querySelectorAll('table.excel th');
    headers.forEach(header => {
        header.style.cursor = 'pointer';
        header.title = 'Нажмите для прокрутки к началу';
        
        header.addEventListener('click', function() {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        });
    });
    
    // Показать количество строк
    if (table) {
        const totalRows = table.querySelectorAll('tbody tr, tr:not(:first-child)').length;
        if (totalRows > 0) {
            const tableContainer = document.querySelector('.table-scroll');
            if (tableContainer) {
                const info = document.createElement('div');
                info.style.cssText = `
                    text-align: right; 
                    margin-top: 10px; 
                    font-size: 12px; 
                    color: #666; 
                    padding: 5px 10px;
                    background: rgba(255, 255, 255, 0.8);
                    border-radius: 4px;
                `;
                info.textContent = `Всего записей: ${totalRows}`;
                tableContainer.parentNode.appendChild(info);
            }
        }
    }
});
</script>

</body>
</html>


