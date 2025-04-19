/**
 * Интерактивная схема зданий - Google Apps Script
 * 
 * Этот скрипт предназначен для обработки запросов от веб-приложения и 
 * возвращает данные о помещениях в формате JSON из Google Таблицы.
 * 
 * Инструкция по настройке:
 * 1. Откройте Google Таблицу с данными о помещениях
 * 2. Выберите Расширения > Apps Script
 * 3. Вставьте этот код в редактор
 * 4. Сохраните проект (Ctrl+S или Файл > Сохранить)
 * 5. Разверните приложение (Развертывание > Новое развертывание)
 * 6. Выберите тип "Веб-приложение"
 * 7. Установите доступ: "Все, даже анонимные" 
 *    (или другой вариант, в зависимости от требований)
 * 8. Нажмите "Развернуть" и скопируйте URL приложения
 * 9. Вставьте полученный URL в переменную API_URL в файле script.js веб-приложения
 */

/**
 * Функция doGet вызывается при GET-запросе к приложению.
 * Возвращает данные о помещениях в формате JSON.
 * 
 * @return {Object} ContentService объект с JSON данными
 */
function doGet() {
  try {
    // ID Google Таблицы
    const spreadsheetId = '1PPwQnjiy_UcsF0N9UDgpKkl_4wGb_eH-ixy-p4I1s-M';
    
    // Открываем таблицу и получаем первый лист
    const sheet = SpreadsheetApp.openById(spreadsheetId).getSheets()[0];
    
    // Получаем все данные с листа
    const data = sheet.getDataRange().getValues();
    
    // Первая строка содержит заголовки (строка 4 в таблице)
    const headers = data[3]; // Индекс 3 соответствует строке 4
    
    // Индексы нужных нам столбцов
    const objectIndex = headers.indexOf('Объект недвижимости');
    const tenantIndex = headers.indexOf('Контрагент');
    const contractIndex = headers.indexOf('Договор');
    const rentIndex = headers.indexOf('Сумма');
    const statusIndex = headers.indexOf('Статус');
    
    // Проверяем, что необходимые столбцы существуют
    if (objectIndex === -1) {
      throw new Error('Столбец "Объект недвижимости" не найден в таблице');
    }
    
    // Формируем массив объектов с данными о помещениях
    const rooms = [];
    
    for (let i = 4; i < data.length; i++) { // Начинаем с индекса 4 (строка 5)
      const row = data[i];
      
      // Пропускаем строки с заголовками этажей и пустые строки
      if (!row[objectIndex] || 
          row[objectIndex].includes('этаж') || 
          row[objectIndex].includes('Итого') || 
          !row[objectIndex].includes('№')) continue;
      
      // Извлекаем номер помещения из полного названия
      const objectName = row[objectIndex].toString();
      const numberMatch = objectName.match(/№\s*(\d+[А-Яа-я]?)/);
      
      if (!numberMatch) continue; // Если номер не найден, пропускаем
      
      // Получаем номер помещения
      const roomNumber = numberMatch[1]; // Сохраняем букву, если она есть
      
      // Извлекаем номер здания из строки
      let buildingNumber = '19'; // По умолчанию здание 19
      const buildingMatch = objectName.match(/строение\s+(\d+)(?:\/(\d+))?/i);
      if (buildingMatch) {
        if (buildingMatch[2]) { // Если есть второй номер после слеша
          buildingNumber = `${buildingMatch[1]}-${buildingMatch[2]}`;
        } else {
          buildingNumber = buildingMatch[1];
        }
      }
      
      // Определяем этаж
      let floor = 'floor-1'; // По умолчанию 1 этаж
      // Ищем прямое указание на этаж в текущей строке
      if (objectName.toLowerCase().includes('подвал')) {
        floor = 'floor-0';
      } else {
        // Проверяем, не является ли помещение подвальным по своему расположению в таблице
        let inBasementSection = false;
        
        // Ищем номер этажа в предыдущих строках
        for (let j = i - 1; j >= 0; j--) {
          const prevRow = data[j];
          if (!prevRow[objectIndex]) continue;
          
          const prevText = prevRow[objectIndex].toString().toLowerCase();
          
          // Если встретили заголовок "Подвал", помечаем все последующие помещения как подвальные
          if (prevText.includes('подвал')) {
            inBasementSection = true;
            floor = 'floor-0';
            break;
          }
          
          // Если встретили любой другой заголовок этажа, прекращаем поиск
          if (prevText.includes('этаж')) {
            const floorText = prevText;
            if (floorText.includes('1')) floor = 'floor-1';
            else if (floorText.includes('2')) floor = 'floor-2';
            else if (floorText.includes('3')) floor = 'floor-3';
            else if (floorText.includes('4')) floor = 'floor-4';
            break;
          }
        }
      }
      
      // Если есть конкретное указание на подвал в номере помещения, применяем его
      if (objectName.toLowerCase().includes('подвал') || 
          objectName.toLowerCase().includes('цоколь') ||
          objectName.match(/№\s*\d+[А-Яа-я]?\s+подв/i)) {
        floor = 'floor-0';
      }
      
      // Более гибкая проверка статуса помещения
      const isOccupied = statusIndex !== -1 && 
        (String(row[statusIndex]).trim() === 'В аренде' || 
         String(row[statusIndex]).trim() === 'Занято');
      
      rooms.push({
        number: roomNumber,
        building: buildingNumber,
        floor: floor,
        tenant: isOccupied && tenantIndex !== -1 ? row[tenantIndex] : null,
        contract: isOccupied && contractIndex !== -1 ? row[contractIndex] : null,
        rent: isOccupied && rentIndex !== -1 ? row[rentIndex] : null
      });
    }
    
    // Возвращаем данные в формате JSON (без setHeader, так как он не поддерживается)
    return ContentService.createTextOutput(JSON.stringify(rooms))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    // В случае ошибки возвращаем сообщение об ошибке
    return ContentService.createTextOutput(JSON.stringify({ 
      error: error.message, 
      status: 'error' 
    }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Дополнительная функция для тестирования.
 * Позволяет проверить, правильно ли настроен скрипт
 * и получить тестовые данные из таблицы.
 */
function test() {
  try {
    const sheet = SpreadsheetApp.openById('1PPwQnjiy_UcsF0N9UDgpKkl_4wGb_eH-ixy-p4I1s-M').getSheets()[0];
    const data = sheet.getDataRange().getValues();
    
    // Заголовки находятся в строке 4
    const headers = data[3];
    Logger.log('Заголовки таблицы:');
    Logger.log(headers);
    
    // Проверяем извлечение номера помещения
    const testRow = data[8]; // Строка 9 (индекс 8)
    Logger.log('Пример строки:');
    Logger.log(testRow);
    
    const objectName = testRow[0].toString();
    const numberMatch = objectName.match(/№\s*(\d+[А-Яа-я]?)/);
    
    if (numberMatch) {
      const roomNumber = numberMatch[1].replace(/[^0-9]/g, ''); // Только цифры
      Logger.log('Извлеченный номер помещения (только цифры):');
      Logger.log(roomNumber);
    } else {
      Logger.log('Номер помещения не найден');
    }
    
    // Тестируем обработку всех данных
    let roomCount = 0;
    for (let i = 4; i < data.length; i++) {
      const row = data[i];
      if (!row[0] || 
          row[0].includes('этаж') || 
          row[0].includes('Итого') || 
          !row[0].toString().includes('№')) continue;
      
      const objectName = row[0].toString();
      const numberMatch = objectName.match(/№\s*(\d+[А-Яа-я]?)/);
      
      if (numberMatch) {
        const roomNumber = numberMatch[1].replace(/[^0-9]/g, ''); // Только цифры
        roomCount++;
        if (roomCount <= 5) {
          const statusIndex = headers.indexOf('Статус');
          const status = statusIndex !== -1 ? row[statusIndex] : 'Нет статуса';
          Logger.log(`Помещение ${roomNumber}: ${row[1] || 'Нет арендатора'}, Статус: ${status}`);
        }
      }
    }
    
    Logger.log(`Всего найдено помещений: ${roomCount}`);
    
    return 'Тест выполнен успешно. Результаты в журнале.';
  } catch (error) {
    Logger.log('Ошибка: ' + error.message);
    return 'Ошибка: ' + error.message;
  }
}

/**
 * Дополнительная функция для тестирования извлечения номеров зданий и этажей
 */
function testBuildingAndFloorExtraction() {
  try {
    const sheet = SpreadsheetApp.openById('1PPwQnjiy_UcsF0N9UDgpKkl_4wGb_eH-ixy-p4I1s-M').getSheets()[0];
    const data = sheet.getDataRange().getValues();
    
    Logger.log('Тестирование извлечения номеров зданий и этажей:');
    
    for (let i = 4; i < data.length; i++) {
      const row = data[i];
      if (!row[0]) continue;
      
      const objectName = row[0].toString();
      
      // Тестируем извлечение номера здания
      let buildingNumber = '19'; // По умолчанию
      const buildingMatch = objectName.match(/строение\s+(\d+)(?:\/(\d+))?/i);
      if (buildingMatch) {
        if (buildingMatch[2]) {
          buildingNumber = `${buildingMatch[1]}-${buildingMatch[2]}`;
        } else {
          buildingNumber = buildingMatch[1];
        }
      }
      
      // Проверяем, содержит ли строка информацию об этаже
      if (objectName.toLowerCase().includes('этаж') || objectName.toLowerCase().includes('подвал')) {
        Logger.log(`${objectName} -> Здание: ${buildingNumber}`);
      }
      
      // Проверяем первые 5 помещений для демонстрации
      const numberMatch = objectName.match(/№\s*(\d+[А-Яа-я]?)/);
      if (numberMatch && i < 10) {
        Logger.log(`Помещение ${numberMatch[1]} -> Здание: ${buildingNumber}`);
      }
    }
    
    return 'Тест извлечения номеров зданий и этажей выполнен. Результаты в журнале.';
  } catch (error) {
    Logger.log('Ошибка: ' + error.message);
    return 'Ошибка: ' + error.message;
  }
} 