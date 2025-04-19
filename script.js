// Проверка авторизации
document.addEventListener('DOMContentLoaded', checkAuth);

function checkAuth() {
    // Проверяем, авторизован ли пользователь
    if (localStorage.getItem('isAuthenticated') !== 'true') {
        // Если нет - перенаправляем на страницу входа
        window.location.href = 'login.html';
        return;
    }
    
    // Отображаем имя пользователя
    const usernameElement = document.getElementById('username');
    if (usernameElement) {
        usernameElement.textContent = localStorage.getItem('username') || 'admin';
    }
    
    // Добавляем обработчик для кнопки выхода
    const logoutButton = document.getElementById('logout-button');
    if (logoutButton) {
        logoutButton.addEventListener('click', function() {
            // Удаляем данные авторизации в localStorage
            localStorage.removeItem('isAuthenticated');
            localStorage.removeItem('username');
            
            // Перенаправляем на PHP-скрипт для уничтожения сессии
            window.location.href = 'logout.php';
        });
    }
    
    // Если авторизован - запускаем приложение
    init();
}

// Константы и переменные
const API_URL = 'https://script.google.com/macros/s/AKfycbxxspvJAMjDrbe85Z-A-cKUmkp0Z7JgicE27I_VOLKxUeazBqkSm5yBmGHRh18gR0ZfmQ/exec'; // URL Google Apps Script
let roomsData = []; // Данные о помещениях из Google Sheets
let currentBuilding = 'building-19';
let currentFloor = 'floor-1';

// DOM-элементы
const mapContainer = document.querySelector('.map-container');
const mapWrapper = document.querySelector('.map-wrapper');
const roomDetails = document.getElementById('room-details');
const buildingButtons = document.querySelectorAll('.building-switcher button');
const floorGroups = document.querySelectorAll('.floors-group');

// Инициализация приложения
// document.addEventListener('DOMContentLoaded', init);

async function init() {
    try {
        // Показываем соответствующую группу этажей для начального здания
        showFloorGroupForBuilding(currentBuilding);
        
        // Загрузка SVG схемы здания 19, этаж 1
        const svg = await loadSVG('building-19_floor-1.svg');
        
        // Проверяем, что SVG загрузился успешно
        if (svg) {
            const activeWrapper = document.querySelector('.map-wrapper.active');
            if (activeWrapper) {
                activeWrapper.innerHTML = svg;
            } else {
                mapWrapper.innerHTML = svg;
            }
            
            // Создаем дополнительные контейнеры для других зданий и этажей
            createMapWrappers();
            
            // Настраиваем обработчики событий
            setupEventListeners();
            
            // Загружаем данные из Google Sheets
            await fetchDataFromGoogleSheets();
            
            // Обновляем статусы помещений
            updateRoomStatus();
        } else {
            console.error('Не удалось загрузить SVG-схему');
        }
    } catch (error) {
        console.error('Ошибка при инициализации:', error);
    }
}

// Загрузка SVG-файла
async function loadSVG(filename) {
    try {
        // Добавляем путь к папке с SVG-файлами
        const filePath = `floor_plan_svg/${filename}`;
        console.log(`Загрузка SVG-файла: ${filePath}`);
        const response = await fetch(filePath);
        if (!response.ok) {
            throw new Error(`Не удалось загрузить SVG: ${response.status}`);
        }
        const svgText = await response.text();
        console.log('SVG успешно загружен');
        return svgText;
    } catch (error) {
        console.error('Ошибка при загрузке SVG:', error);
        return '';
    }
}

// Настройка обработчиков событий
function setupEventListeners() {
    // Обработчики кнопок переключения зданий
    buildingButtons.forEach(button => {
        button.addEventListener('click', function() {
            // Удаляем активный класс у всех кнопок зданий
            buildingButtons.forEach(btn => btn.classList.remove('active'));
            
            // Добавляем активный класс текущей кнопке
            this.classList.add('active');
            
            // Обновляем текущее здание
            currentBuilding = this.dataset.building;
            
            // Показываем соответствующую группу этажей
            showFloorGroupForBuilding(currentBuilding);
            
            // Выбираем первый этаж из доступных для этого здания
            selectDefaultFloorForBuilding(currentBuilding);
            
            // Обновляем отображаемую схему
            updateActiveMap();
        });
    });
    
    // Обработчики кнопок переключения этажей
    document.querySelectorAll('.floor-switcher button').forEach(button => {
        button.addEventListener('click', function() {
            // Удаляем активный класс у всех кнопок этажей
            document.querySelectorAll('.floor-switcher button').forEach(btn => btn.classList.remove('active'));
            
            // Добавляем активный класс текущей кнопке
            this.classList.add('active');
            
            // Обновляем текущий этаж
            currentFloor = this.dataset.floor;
            
            // Обновляем отображаемую схему
            updateActiveMap();
        });
    });
    
    // Добавляем обработчики для помещений
    setupRoomEventListeners();
}

// Показать группу этажей в зависимости от выбранного здания
function showFloorGroupForBuilding(building) {
    // Скрываем все группы этажей
    floorGroups.forEach(group => {
        group.classList.remove('active');
    });
    
    // Показываем группу этажей для выбранного здания
    const floorGroupClass = `floors-${building.replace('building-', '')}`;
    const floorGroup = document.querySelector(`.${floorGroupClass}`);
    
    if (floorGroup) {
        floorGroup.classList.add('active');
    }
}

// Выбрать первый доступный этаж для здания
function selectDefaultFloorForBuilding(building) {
    const buildingNumber = building.replace('building-', '');
    const floorGroup = document.querySelector(`.floors-${buildingNumber}`);
    
    if (floorGroup) {
        // Получаем первую кнопку этажа из группы для этого здания
        const firstFloorButton = floorGroup.querySelector('button');
        
        if (firstFloorButton) {
            // Удаляем активный класс у всех кнопок этажей
            document.querySelectorAll('.floor-switcher button').forEach(btn => {
                btn.classList.remove('active');
            });
            
            // Делаем первую кнопку активной
            firstFloorButton.classList.add('active');
            
            // Обновляем текущий этаж
            currentFloor = firstFloorButton.dataset.floor;
        }
    }
}

// Создание контейнеров для всех зданий и этажей
function createMapWrappers() {
    // Удаляем все существующие контейнеры
    mapContainer.innerHTML = '';
    
    // Создаем контейнеры для здания 19 (3 этажа: подвал, 1, 2)
    createBuildingFloorWrappers('building-19', ['floor-0', 'floor-1', 'floor-2']);
    
    // Создаем контейнеры для здания 19-1 (2 этажа: 1, 2)
    createBuildingFloorWrappers('building-19-1', ['floor-1', 'floor-2']);
    
    // Создаем контейнеры для здания 19-2 (4 этажа: подвал, 1, 2, 3)
    createBuildingFloorWrappers('building-19-2', ['floor-0', 'floor-1', 'floor-2', 'floor-3']);
    
    // Загружаем SVG схему для текущего здания и этажа
    loadCurrentMap();
    
    // Показываем соответствующую группу этажей
    showFloorGroupForBuilding(currentBuilding);
}

// Создание контейнеров для конкретного здания и его этажей
function createBuildingFloorWrappers(building, floors) {
    floors.forEach(floor => {
        const wrapper = document.createElement('div');
        wrapper.className = 'map-wrapper';
        wrapper.dataset.building = building;
        wrapper.dataset.floor = floor;
        
        // Делаем активным текущий этаж и здание
        if (building === currentBuilding && floor === currentFloor) {
            wrapper.classList.add('active');
        }
        
        mapContainer.appendChild(wrapper);
    });
}

// Загрузка схемы для текущего здания и этажа
async function loadCurrentMap() {
    const activeWrapper = document.querySelector(`.map-wrapper[data-building="${currentBuilding}"][data-floor="${currentFloor}"]`);
    
    if (!activeWrapper) return;
    
    // Формируем имя файла SVG
    // Проверяем, существует ли здание-19_этаж-1.svg, если нет используем building-19_floor-1.svg
    let svgFileName = '';
    
    if (currentBuilding === 'building-19' && currentFloor === 'floor-1') {
        svgFileName = 'building-19_floor-1.svg';
    } else {
        svgFileName = `${currentBuilding}_${currentFloor}.svg`;
    }
    
    try {
        // Загружаем SVG для текущего здания и этажа
        const svg = await loadSVG(svgFileName);
        
        if (svg) {
            // Очищаем предыдущее содержимое
            activeWrapper.innerHTML = svg;
            
            // Добавляем обработчики событий для помещений
            setupRoomEventListeners();
            
            // Обновляем статусы помещений
            updateRoomStatus();
            
            // Добавляем отложенное повторное окрашивание через 200мс после первой попытки
            // Это помогает в случаях, когда SVG может быть не полностью обработан браузером
            setTimeout(() => {
                console.log('Повторное окрашивание помещений...');
                updateRoomStatus();
                
                // И еще одна попытка через секунду для полной уверенности
                setTimeout(() => {
                    console.log('Финальное окрашивание помещений...');
                    updateRoomStatus();
                }, 1000);
            }, 200);
        } else {
            // Если SVG не найден, используем запасной вариант
            const backupSvg = await loadSVG('building-19_floor-1.svg');
            activeWrapper.innerHTML = backupSvg || '<p>Схема недоступна</p>';
            
            if (backupSvg) {
                // Добавляем обработчики событий для помещений
                setupRoomEventListeners();
                
                // Обновляем статусы помещений
                updateRoomStatus();
                
                // Добавляем отложенное повторное окрашивание
                setTimeout(() => {
                    updateRoomStatus();
                    setTimeout(updateRoomStatus, 1000);
                }, 200);
            }
        }
    } catch (error) {
        console.error('Ошибка при загрузке карты:', error);
        activeWrapper.innerHTML = '<p>Ошибка загрузки схемы</p>';
    }
}

// Обработчики событий для помещений на схеме
function setupRoomEventListeners() {
    // Находим все элементы с id, начинающимся с "room-"
    const rooms = document.querySelectorAll('[id^="room-"]');
    
    rooms.forEach(room => {
        // Проверяем, не является ли это коридором (corridor, corridor_2, corridor_3, corridor_4)
        if (room.id === 'corridor' || room.id.startsWith('corridor_')) return;
        
        room.addEventListener('click', function() {
            // Удаляем класс активного помещения у всех помещений
            document.querySelectorAll('.active-room').forEach(el => {
                el.classList.remove('active-room');
            });
            
            // Добавляем класс активного помещения текущему
            this.classList.add('active-room');
            
            // Отображаем информацию о помещении
            displayRoomInfo(this.id);
        });
    });
}

// Обновление активной схемы
function updateActiveMap() {
    // Скрываем все схемы
    document.querySelectorAll('.map-wrapper').forEach(wrapper => {
        wrapper.classList.remove('active');
    });
    
    // Показываем активную схему
    const activeWrapper = document.querySelector(`.map-wrapper[data-building="${currentBuilding}"][data-floor="${currentFloor}"]`);
    
    if (activeWrapper) {
        activeWrapper.classList.add('active');
        
        // Если схема еще не загружена, загружаем ее
        if (activeWrapper.innerHTML === '') {
            loadCurrentMap();
        } else {
            // Если схема уже загружена, просто обновляем статусы помещений
            updateRoomStatus();
            
            // Повторное окрашивание через небольшую задержку
            setTimeout(updateRoomStatus, 100);
        }
    }
}

// Загрузка данных из Google Sheets через Apps Script
async function fetchDataFromGoogleSheets() {
    try {
        if (!API_URL) {
            console.warn('URL Google Apps Script не указан');
            // Используем тестовые данные для демонстрации
            roomsData = getMockData();
            updateRoomStatus(); // Обновляем после загрузки тестовых данных
            return;
        }
        
        console.log('Загрузка данных из Google Sheets...');
        const response = await fetch(API_URL);
        
        if (!response.ok) {
            throw new Error(`Ошибка HTTP: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Полученные данные:', data);
        roomsData = data;
        
        // Обновляем статусы помещений на схеме
        updateRoomStatus();
        
        // Добавляем повторную попытку окрашивания
        setTimeout(updateRoomStatus, 300);
    } catch (error) {
        console.error('Ошибка при получении данных из Google Sheets:', error);
        // Используем тестовые данные при ошибке
        roomsData = getMockData();
        updateRoomStatus();
        setTimeout(updateRoomStatus, 300);
    }
}

// Универсальная функция для "очистки" номера помещения (оставляет только цифры и буквы)
function normalizeRoomNumber(str) {
    // Преобразуем к нижнему регистру и удаляем всё кроме цифр и букв
    const normalized = String(str).replace(/[^\dA-Za-zА-Яа-я]/g, '').toLowerCase();
    // Если содержит латинские символы a, b, c, конвертируем их в кириллические а, б, в
    return translateLatinToCyrillic(normalized);
}

// Функция для преобразования латинских a, b, c в кириллические а, б, в и наоборот
function translateLatinToCyrillic(text) {
    // Словарь для перевода между латиницей и кириллицей
    const latinToCyrillic = {
        'a': 'а', 
        'b': 'б', 
        'c': 'в',
        'd': 'д',
        'e': 'е',
        'o': 'о'
    };
    
    // Проходим по всем символам строки и заменяем латинские буквы на кириллические
    let result = '';
    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        if (latinToCyrillic[char]) {
            result += latinToCyrillic[char];
        } else {
            result += char;
        }
    }
    
    return result;
}

// Обновление статусов помещений на схеме
function updateRoomStatus() {
    const roomElements = document.querySelectorAll('[id^="room-"]');
    console.log('Данные о помещениях:', roomsData);
    console.log('Найдено элементов на схеме:', roomElements.length);
    console.log('Текущий этаж:', currentFloor);
    
    // Если данных или элементов схемы нет, ничего не делаем
    if (!roomsData.length || !roomElements.length) {
        console.warn('Нет данных о помещениях или элементов на схеме');
        return;
    }

    // Сначала создадим индексированную карту данных для быстрого доступа
    const roomDataMap = {};
    
    // Создаем уникальный ключ для каждого помещения на основе номера, этажа и здания
    roomsData.forEach(room => {
        const normalizedNumber = normalizeRoomNumber(room.number);
        // Создаем составной ключ, включающий информацию об этаже и здании
        const floorKey = room.floor || 'unknown';
        const buildingKey = room.building || 'unknown';
        const compositeKey = `${normalizedNumber}_${floorKey}_${buildingKey}`;
        
        // Также создаем ключ только по номеру и этажу (более важный)
        const floorNumberKey = `${normalizedNumber}_${floorKey}`;
        
        // И простой ключ только по номеру (наименее приоритетный)
        const simpleKey = `${normalizedNumber}`;
        
        // Сохраняем данные по всем ключам для разных уровней соответствия
        roomDataMap[compositeKey] = room;
        if (!roomDataMap[floorNumberKey]) roomDataMap[floorNumberKey] = room;
        if (!roomDataMap[simpleKey] && !room.tenant) roomDataMap[simpleKey] = room; // только для свободных
    });
    
    console.log('Индексированные данные:', roomDataMap);

    roomElements.forEach(roomElement => {
        if (roomElement.id === 'corridor' || roomElement.id.startsWith('corridor_')) return;
        
        // Получаем номер помещения из id и нормализуем
        const roomNumber = normalizeRoomNumber(roomElement.id.split('-')[1]);
        
        // Получаем текущее здание и этаж из активной схемы
        const activeBuilding = currentBuilding.replace('building-', '');
        
        // Используем тот же алгоритм поиска, что и в displayRoomInfo
        // Сначала ищем точное совпадение (здание + этаж + номер)
        const roomData = roomsData.find(room => {
            const normalizedRoomNum = normalizeRoomNumber(room.number);
            return normalizedRoomNum === roomNumber && 
                  room.floor === currentFloor && 
                  (room.building === activeBuilding || !room.building);
        });
        
        // Определяем цвет и статус помещения
        const isOccupied = roomData && roomData.tenant;
        const fillColor = isOccupied ? '#F08080' : '#A8D299';
        const statusClass = isOccupied ? 'occupied' : 'free';
        
        console.log(`Помещение ${roomNumber}, занято: ${isOccupied}, цвет: ${fillColor}`);
        
        roomElement.classList.add(statusClass);
        roomElement.classList.remove(statusClass === 'occupied' ? 'free' : 'occupied');

        // Универсально перекрашиваем все SVG-фигуры внутри помещения
        const svgShapes = roomElement.querySelectorAll('rect, path, polygon, polyline, circle, ellipse');
        svgShapes.forEach(shape => {
            // Только если fill не none/black или явно задан
            const currentFill = shape.getAttribute('fill');
            if (currentFill === null || currentFill === 'none' || currentFill === '#000' || currentFill === '#000000') return;
            shape.style.fill = fillColor;
            shape.setAttribute('fill', fillColor);
        });

        // Для масок: перекрашиваем все элементы с fill внутри группы
        if (roomElement.querySelector('[mask]')) {
            const allWithFill = roomElement.querySelectorAll('[fill]');
            allWithFill.forEach(el => {
                const fill = el.getAttribute('fill');
                if (fill && fill !== 'none' && fill !== 'black' && fill !== '#000000') {
                    el.setAttribute('fill', fillColor);
                }
            });
        }

        // Логируем несовпадения для отладки
        if (!roomData) {
            console.warn(`Нет данных о помещении для SVG id: ${roomElement.id} (нормализовано: ${roomNumber})`);
        }
    });
}

// Отображение информации о выбранном помещении
function displayRoomInfo(roomId) {
    // Получаем номер помещения из id (например, из "room-103" получаем "103")
    const roomNumber = roomId.split('-')[1];
    
    // Нормализуем номер помещения
    const normalizedRoomNumber = normalizeRoomNumber(roomNumber);
    
    // Получаем текущее здание и этаж
    const activeBuilding = currentBuilding.replace('building-', '');
    console.log(`Запрос информации для помещения: ${roomNumber}, здание: ${activeBuilding}, этаж: ${currentFloor}`);
    
    // Создаем составные ключи для поиска
    const fullKey = `${normalizedRoomNumber}_${currentFloor}_${activeBuilding}`;
    const floorNumberKey = `${normalizedRoomNumber}_${currentFloor}`;
    const simpleKey = `${normalizedRoomNumber}`;
    
    console.log(`Ключи поиска: ${fullKey}, ${floorNumberKey}, ${simpleKey}`);
    
    // Сначала ищем точное совпадение (более надежный способ)
    const exactMatch = roomsData.find(room => {
        const normalizedNumber = normalizeRoomNumber(room.number);
        // Проверяем точное совпадение номера, этажа и здания
        return normalizedNumber === normalizedRoomNumber && 
               room.floor === currentFloor && 
               (room.building === activeBuilding || !room.building);
    });
    
    // Если найдено точное совпадение, используем его
    if (exactMatch) {
        console.log('Найдено точное совпадение:', exactMatch);
        displayRoomInfoData(roomNumber, exactMatch, activeBuilding);
        return;
    }
    
    // Если точного совпадения нет и помещение с таким номером свободно,
    // можем показать общую информацию
    console.log('Точное совпадение не найдено, ищем свободное помещение');
    const freeRoomMatch = roomsData.find(room => {
        const normalizedNumber = normalizeRoomNumber(room.number);
        return normalizedNumber === normalizedRoomNumber && !room.tenant;
    });
    
    if (freeRoomMatch) {
        console.log('Найдено свободное помещение:', freeRoomMatch);
        displayRoomInfoData(roomNumber, freeRoomMatch, activeBuilding);
        return;
    }
    
    // Если ничего не найдено, показываем базовую информацию
    console.log('Данные о помещении не найдены, отображаем базовую информацию');
    displayEmptyRoomInfo(roomNumber, activeBuilding);
}

// Отображение данных о помещении (выделено в отдельную функцию)
function displayRoomInfoData(roomNumber, roomData, activeBuilding) {
    let html = `<p><strong>Номер помещения:</strong> ${roomNumber}</p>`;
    
    // Добавляем информацию о здании, если есть
    if (roomData.building) {
        html += `<p><strong>Здание:</strong> ${roomData.building}</p>`;
    } else {
        html += `<p><strong>Здание:</strong> ${activeBuilding}</p>`;
    }
    
    // Добавляем информацию об этаже, если есть
    if (roomData.floor) {
        const floorNumber = roomData.floor.replace('floor-', '');
        const floorName = floorNumber === '0' ? 'Подвал' : `${floorNumber} этаж`;
        html += `<p><strong>Этаж:</strong> ${floorName}</p>`;
    } else {
        const floorNumber = currentFloor.replace('floor-', '');
        const floorName = floorNumber === '0' ? 'Подвал' : `${floorNumber} этаж`;
        html += `<p><strong>Этаж:</strong> ${floorName}</p>`;
    }
    
    html += `<p><strong>Статус:</strong> ${roomData.tenant ? 'Занято' : 'Свободно'}</p>`;
    
    if (roomData.tenant) {
        // Если помещение занято, отображаем информацию об арендаторе
        html += `<p><strong>Арендатор:</strong> ${roomData.tenant}</p>`;
        html += `<p><strong>Договор:</strong> ${roomData.contract || 'Нет данных'}</p>`;
        html += `<p><strong>Арендная плата:</strong> ${roomData.rent || 'Нет данных'} руб./мес.</p>`;
    }
    
    roomDetails.innerHTML = html;
}

// Отображение информации о пустом помещении
function displayEmptyRoomInfo(roomNumber, activeBuilding) {
    const floorNumber = currentFloor.replace('floor-', '');
    const floorName = floorNumber === '0' ? 'Подвал' : `${floorNumber} этаж`;
    
    roomDetails.innerHTML = `
        <p><strong>Номер помещения:</strong> ${roomNumber}</p>
        <p><strong>Здание:</strong> ${activeBuilding}</p>
        <p><strong>Этаж:</strong> ${floorName}</p>
        <p><strong>Статус:</strong> Свободно</p>
        <p>Нет дополнительных данных</p>
    `;
}

// Тестовые данные для демонстрации (используются, если API не настроен)
function getMockData() {
    return [
        { number: '101', building: '19', floor: 'floor-1', tenant: null, contract: null, rent: null },
        { number: '102', building: '19', floor: 'floor-1', tenant: 'ООО "Рога и Копыта"', contract: '23/45 от 01.01.2023', rent: 50000 },
        { number: '103', building: '19', floor: 'floor-1', tenant: 'ИП Иванов', contract: '12/34 от 15.03.2023', rent: 35000 },
        { number: '106', building: '19', floor: 'floor-1', tenant: null, contract: null, rent: null },
        { number: '107', building: '19', floor: 'floor-1', tenant: 'ООО "Технологии Будущего"', contract: '56/78 от 10.05.2023', rent: 75000 },
        { number: '108', building: '19', floor: 'floor-1', tenant: null, contract: null, rent: null },
        { number: '110', building: '19', floor: 'floor-1', tenant: 'ЗАО "Стройматериалы"', contract: '98/76 от 22.02.2023', rent: 60000 },
        { number: '111', building: '19', floor: 'floor-1', tenant: 'ООО "IT Решения"', contract: '45/67 от 05.04.2023', rent: 80000 },
        { number: '112', building: '19', floor: 'floor-1', tenant: null, contract: null, rent: null },
        { number: '113', building: '19', floor: 'floor-1', tenant: null, contract: null, rent: null },
        { number: '116', building: '19', floor: 'floor-1', tenant: 'ООО "Логистика+"', contract: '34/56 от 18.06.2023', rent: 120000 },
        { number: '117', building: '19', floor: 'floor-1', tenant: null, contract: null, rent: null },
        { number: '202', building: '19', floor: 'floor-2', tenant: 'ИП Петров', contract: '67/89 от 20.01.2023', rent: 45000 },
        { number: '204', building: '19', floor: 'floor-2', tenant: null, contract: null, rent: null },
        { number: '206', building: '19-2', floor: 'floor-2', tenant: 'ООО "Медицина"', contract: '78/90 от 15.02.2023', rent: 95000 },
        { number: '12а', building: '19-1', floor: 'floor-1', tenant: 'ЗАО "Консалтинг"', contract: '89/01 от 10.03.2023', rent: 70000 }
    ];
}

// Функция для создания и настройки Google Apps Script
function setupGoogleAppsScript() {
    // Этот код не выполняется в браузере, он приведен как пример для настройки Apps Script
    /*
    // Код для Google Apps Script:
    
    function doGet() {
        try {
            // ID вашей Google Таблицы
            const spreadsheetId = 'ID_ВАШЕЙ_ТАБЛИЦЫ';
            
            // Открываем таблицу и получаем первый лист
            const sheet = SpreadsheetApp.openById(spreadsheetId).getSheets()[0];
            
            // Получаем все данные с листа
            const data = sheet.getDataRange().getValues();
            
            // Первая строка содержит заголовки
            const headers = data[0];
            
            // Индексы нужных нам столбцов
            const numberIndex = headers.indexOf('Номер помещения');
            const tenantIndex = headers.indexOf('Арендатор');
            const contractIndex = headers.indexOf('Договор');
            const rentIndex = headers.indexOf('Арендная плата');
            
            // Формируем массив объектов с данными о помещениях
            const rooms = [];
            
            for (let i = 1; i < data.length; i++) {
                const row = data[i];
                
                // Пропускаем пустые строки
                if (!row[numberIndex]) continue;
                
                rooms.push({
                    number: row[numberIndex].toString(),
                    tenant: row[tenantIndex] || null,
                    contract: row[contractIndex] || null,
                    rent: row[rentIndex] || null
                });
            }
            
            // Возвращаем данные в формате JSON
            return ContentService.createTextOutput(JSON.stringify(rooms))
                .setMimeType(ContentService.MimeType.JSON);
                
        } catch (error) {
            // В случае ошибки возвращаем сообщение об ошибке
            return ContentService.createTextOutput(JSON.stringify({ error: error.message }))
                .setMimeType(ContentService.MimeType.JSON);
        }
    }
    */
} 