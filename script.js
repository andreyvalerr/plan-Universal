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
// Новый API на нашем сервере для загрузки и получения данных из Excel
const API_URL = 'api.php';
let roomsData = []; // Данные о помещениях из Google Sheets
let currentBuilding = 'building-19';
let currentFloor = 'floor-1';

// Список особых помещений (формат: {building: 'building-19', floor: 'floor-0', room: '1'})
const specialRooms = [
    {building: 'building-19', floor: 'floor-0', room: '1'},
    {building: 'building-19-2', floor: 'floor-0', room: '3'},
    {building: 'building-19-2', floor: 'floor-2', room: '27'}
];

// Помещения, которые должны быть отображены синим цветом
let blueRooms = [];

// Флаг, показывающий, включено ли отображение особых помещений
let showSpecialRooms = true;

// DOM-элементы
const mapContainer = document.querySelector('.map-container');
const mapWrapper = document.querySelector('.map-wrapper');
const roomDetails = document.getElementById('room-details');
const buildingButtons = document.querySelectorAll('.building-switcher button');
const floorGroups = document.querySelectorAll('.floors-group');

// Инициализация приложения
// document.addEventListener('DOMContentLoaded', init);

// Получить резервные данные о синих помещениях (если конфигурационный файл не загружен)
function getDefaultBlueRooms() {
    return [
        // Базовая конфигурация с несколькими синими помещениями
        {
            building: "building-19",
            floor: "floor-0",
            rooms: ["1"]
        },
        {
            building: "building-19-2",
            floor: "floor-2",
            rooms: ["27"]
        },
        {
            building: "building-19-2", 
            floor: "floor-0",
            rooms: ["3", "6"]
        }
    ];
}

// Загружаем конфигурацию синих помещений
async function loadBlueRoomsConfig() {
    try {
        console.log('Загрузка конфигурации синих помещений...');
        // Добавляем случайный параметр для предотвращения кэширования
        const response = await fetch('blue-rooms-config.json?nocache=' + Math.random());
        
        // Если файл не найден, просто используем резервную конфигурацию без ошибки
        if (response.status === 404) {
            console.warn('Файл конфигурации не найден. Используем резервную конфигурацию.');
            blueRooms = getDefaultBlueRooms();
            return;
        }
        
        // Для других ошибок
        if (!response.ok) {
            console.warn(`Ошибка HTTP при загрузке конфигурации: ${response.status}. Используем резервную конфигурацию.`);
            blueRooms = getDefaultBlueRooms();
            return;
        }
        
        // Пробуем разобрать JSON
        try {
            const config = await response.json();
            console.log('Конфигурация синих помещений загружена:', config);
            
            if (config && config.blueRooms) {
                blueRooms = config.blueRooms;
            } else {
                console.warn('В конфигурационном файле отсутствует раздел blueRooms. Используем резервную конфигурацию.');
                blueRooms = getDefaultBlueRooms();
            }
        } catch (jsonError) {
            console.error('Ошибка при разборе JSON:', jsonError);
            blueRooms = getDefaultBlueRooms();
        }
    } catch (error) {
        console.error('Ошибка при загрузке конфигурации синих помещений:', error);
        console.warn('Используем резервную конфигурацию синих помещений.');
        // Если не удалось загрузить конфигурацию, используем базовую настройку
        blueRooms = getDefaultBlueRooms();
    }
}

async function init() {
    try {
        // Показываем соответствующую группу этажей для начального здания
        showFloorGroupForBuilding(currentBuilding);
        
        // Инициализируем синие помещения с резервной конфигурацией на случай ошибок
        blueRooms = getDefaultBlueRooms();
        
        // Пытаемся загрузить конфигурацию синих помещений, но не блокируем инициализацию
        try {
            loadBlueRoomsConfig().catch(error => {
                console.warn("Не удалось загрузить конфигурацию синих помещений, используется резервная:", error);
            });
        } catch (configError) {
            console.warn("Ошибка при попытке загрузить конфигурацию синих помещений:", configError);
        }
        
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
            
            // Загружаем данные с нашего сервера (последние импортированные из Excel)
            await fetchDataFromServer();
            
            // Обновляем статусы помещений
            updateRoomStatus();
            
            // Инициализируем выделение особых помещений
            updateSpecialRoomsHighlight();
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
    
    // Обработчик для переключателя особых помещений
    const specialRoomsToggle = document.getElementById('special-rooms-toggle');
    if (specialRoomsToggle) {
        specialRoomsToggle.addEventListener('change', function() {
            // Обновляем флаг отображения особых помещений
            showSpecialRooms = this.checked;
            
            // Обновляем отображение особых помещений на всех схемах
            updateSpecialRoomsHighlight();
        });
    }
    
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
            setTimeout(() => {
                updateRoomStatus();
                // Выделяем особые помещения после обновления статусов
                updateSpecialRoomsHighlight();
            }, 100);
        }
    }
}

// Загрузка данных с нашего сервера (последний импортированный набор)
async function fetchDataFromServer() {
    try {
        if (!API_URL) {
            console.warn('URL API не указан');
            // Используем тестовые данные для демонстрации
            roomsData = getMockData();
            updateRoomStatus(); // Обновляем после загрузки тестовых данных
            return;
        }
        
        console.log('Загрузка данных с сервера...');
        const response = await fetch(API_URL);
        
        if (!response.ok) {
            throw new Error(`Ошибка HTTP: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Полученные данные:', data);
        roomsData = Array.isArray(data) ? data : (Array.isArray(data.data) ? data.data : []);
        
        // Обновляем статусы помещений на схеме
        updateRoomStatus();
        
        // Выделяем особые помещения
        updateSpecialRoomsHighlight();
        
        // Добавляем повторную попытку окрашивания
        setTimeout(() => {
            updateRoomStatus();
            updateSpecialRoomsHighlight();
        }, 300);
    } catch (error) {
        console.error('Ошибка при получении данных с сервера:', error);
        // Используем тестовые данные при ошибке
        roomsData = getMockData();
        updateRoomStatus();
        updateSpecialRoomsHighlight();
        setTimeout(() => {
            updateRoomStatus();
            updateSpecialRoomsHighlight();
        }, 300);
    }
}

// Обработчик загрузки Excel
document.addEventListener('DOMContentLoaded', () => {
    const uploadForm = document.getElementById('upload-form');
    const fileInput = document.getElementById('excel-file');
    const statusEl = document.getElementById('upload-status');

    if (uploadForm && fileInput) {
        uploadForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!fileInput.files || fileInput.files.length === 0) return;

            const formData = new FormData();
            formData.append('file', fileInput.files[0]);

            statusEl.textContent = 'Загрузка...';
            try {
                const resp = await fetch(API_URL, { method: 'POST', body: formData });
                const data = await resp.json();
                if (!resp.ok) {
                    throw new Error(data && data.error ? data.error : 'Ошибка загрузки');
                }
                roomsData = Array.isArray(data) ? data : (Array.isArray(data.data) ? data.data : []);
                statusEl.textContent = 'Готово. Данные обновлены.';
                updateRoomStatus();
                updateSpecialRoomsHighlight();
            } catch (err) {
                console.error(err);
                statusEl.textContent = 'Ошибка: ' + err.message;
            }
        });
    }
});

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

// Функция для проверки, находится ли помещение в списке тех, что должны быть отображены синим цветом
function shouldBeBlue(roomNumber, building, floor) {
    // Проверяем наличие конфигурации
    if (!blueRooms || !Array.isArray(blueRooms) || blueRooms.length === 0) {
        return false;
    }
    
    // Приводим параметры к формату, который используется в конфигурации
    const normalizedRoomNumber = normalizeRoomNumber(roomNumber);
    const buildingKey = building.startsWith('building-') ? building : `building-${building}`;
    const floorKey = floor.startsWith('floor-') ? floor : `floor-${floor}`;
    
    // Ищем в массиве blueRooms с обработкой возможных ошибок
    try {
        const foundConfig = blueRooms.find(config => {
            if (!config || typeof config !== 'object') return false;
            if (config.building !== buildingKey || config.floor !== floorKey) return false;
            if (!Array.isArray(config.rooms)) return false;
            
            return config.rooms.some(room => {
                try {
                    return normalizeRoomNumber(room) === normalizedRoomNumber;
                } catch (e) {
                    console.warn(`Ошибка при нормализации номера комнаты: ${room}`, e);
                    return false;
                }
            });
        });
        
        return !!foundConfig; // Возвращаем true, если нашли соответствие
    } catch (error) {
        console.warn('Ошибка при проверке синих помещений:', error);
        return false;
    }
}

// Обновление статусов помещений на схеме
function updateRoomStatus() {
    try {
        const roomElements = document.querySelectorAll('[id^="room-"]');
        console.log('Данные о помещениях:', roomsData);
        console.log('Найдено элементов на схеме:', roomElements.length);
        console.log('Текущий этаж:', currentFloor);
        console.log('Конфигурация синих помещений:', blueRooms);
        
        // Если элементов схемы нет, ничего не делаем
        if (!roomElements || !roomElements.length) {
            console.warn('Нет элементов на схеме');
            return;
        }
        
        // Убедимся, что blueRooms инициализирован
        if (!blueRooms || !Array.isArray(blueRooms)) {
            console.warn('Конфигурация синих помещений не инициализирована, используем пустой массив');
            blueRooms = [];
        }
        
        // Сначала создадим индексированную карту данных для быстрого доступа (если есть данные)
        const roomDataMap = {};
        
        if (roomsData && Array.isArray(roomsData) && roomsData.length > 0) {
            // Создаем уникальный ключ для каждого помещения на основе номера, этажа и здания
            roomsData.forEach(room => {
                try {
                    if (!room || !room.number) return; // skip
                    
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
                } catch (e) {
                    console.warn('Ошибка при индексации данных помещения:', e);
                }
            });
            
            console.log('Индексированные данные:', roomDataMap);
        } else {
            console.warn('Нет данных о помещениях для индексации');
        }

        roomElements.forEach(roomElement => {
            try {
                if (!roomElement || !roomElement.id) return; // пропускаем некорректные элементы
                if (roomElement.id === 'corridor' || roomElement.id.startsWith('corridor_')) return;
        
        // Получаем номер помещения из id и нормализуем
        const roomNumber = roomElement.id.split('-')[1];
        const normalizedRoomNumber = normalizeRoomNumber(roomNumber);
        
        // Получаем текущее здание и этаж из активной схемы
        const activeBuilding = currentBuilding.replace('building-', '');
        
        // Проверяем, должно ли помещение быть синим согласно конфигурации
        const isBlueRoom = shouldBeBlue(roomNumber, currentBuilding, currentFloor);
        
        if (isBlueRoom) {
            // Если помещение должно быть синим, удаляем классы free/occupied и добавляем blue-room
            roomElement.classList.remove('free', 'occupied');
            roomElement.classList.add('blue-room');
            
            // Универсально перекрашиваем все SVG-фигуры внутри помещения в синий
            const svgShapes = roomElement.querySelectorAll('rect, path, polygon, polyline, circle, ellipse');
            svgShapes.forEach(shape => {
                // Только если fill не none/black или явно задан
                const currentFill = shape.getAttribute('fill');
                if (currentFill === null || currentFill === 'none' || currentFill === '#000' || currentFill === '#000000') return;
                shape.style.fill = '#0000FF'; // Синий цвет
                shape.setAttribute('fill', '#0000FF');
            });
            
            // Для масок: перекрашиваем все элементы с fill внутри группы
            if (roomElement.querySelector('[mask]')) {
                const allWithFill = roomElement.querySelectorAll('[fill]');
                allWithFill.forEach(el => {
                    const fill = el.getAttribute('fill');
                    if (fill && fill !== 'none' && fill !== 'black' && fill !== '#000000') {
                        el.setAttribute('fill', '#0000FF');
                    }
                });
            }
            
            console.log(`Помещение ${roomNumber} отображено синим цветом согласно конфигурации`);
        } else if (roomsData.length) {
            // Если помещение НЕ должно быть синим, использовать обычную логику занято/свободно
            // Используем тот же алгоритм поиска, что и в displayRoomInfo
            // Сначала ищем точное совпадение (здание + этаж + номер)
            const roomData = roomsData.find(room => {
                const normalizedRoomNum = normalizeRoomNumber(room.number);
                const buildingMatch = (room.building === activeBuilding || room.building === `building-${activeBuilding}` || !room.building);
                const floorMatch = room.floor === currentFloor || room.floor === currentFloor.replace(/^floor-?/, 'floor-');
                return normalizedRoomNum === normalizedRoomNumber && floorMatch && buildingMatch;
            });
            
            // Определяем цвет и статус помещения
            const isOccupied = roomData && roomData.tenant;
            const fillColor = isOccupied ? '#F08080' : '#A8D299';
            const statusClass = isOccupied ? 'occupied' : 'free';
            
            console.log(`Помещение ${roomNumber}, занято: ${isOccupied}, цвет: ${fillColor}`);
            
            roomElement.classList.remove('blue-room');
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
                console.warn(`Нет данных о помещении для SVG id: ${roomElement.id} (нормализовано: ${normalizedRoomNumber})`);
            }
        } else {
            // Если нет данных из Google Sheets, по умолчанию делаем помещение зеленым
            if (!roomElement.classList.contains('blue-room')) {
                roomElement.classList.remove('occupied');
                roomElement.classList.add('free');
                
                // Универсально перекрашиваем все SVG-фигуры внутри помещения
                const svgShapes = roomElement.querySelectorAll('rect, path, polygon, polyline, circle, ellipse');
                svgShapes.forEach(shape => {
                    // Только если fill не none/black или явно задан
                    const currentFill = shape.getAttribute('fill');
                    if (currentFill === null || currentFill === 'none' || currentFill === '#000' || currentFill === '#000000') return;
                    shape.style.fill = '#A8D299'; // Зеленый цвет
                    shape.setAttribute('fill', '#A8D299');
                });
                    }
                }
            } catch (roomError) {
                console.warn('Ошибка при обработке помещения:', roomError);
            }
        });
        
        // После обновления статусов помещений, обновим выделение особых помещений
        updateSpecialRoomsHighlight();
    } catch (error) {
        console.error('Ошибка при обновлении статусов помещений:', error);
    }
}

// Отображение информации о выбранном помещении
function displayRoomInfo(roomId) {
    try {
        if (!roomId || !roomDetails) {
            console.warn('Недостаточно данных для отображения информации о помещении');
            return;
        }
        
        // Получаем номер помещения из id (например, из "room-103" получаем "103")
        const roomIdParts = roomId.split('-');
        if (roomIdParts.length < 2) {
            console.warn('Некорректный ID помещения:', roomId);
            return;
        }
        
        const roomNumber = roomIdParts[1];
        
        // Нормализуем номер помещения
        const normalizedRoomNumber = normalizeRoomNumber(roomNumber);
        
        // Получаем текущее здание и этаж
        const activeBuilding = currentBuilding.replace('building-', '');
        console.log(`Запрос информации для помещения: ${roomNumber}, здание: ${activeBuilding}, этаж: ${currentFloor}`);
        
        // Проверяем, является ли помещение синим из конфигурации
        const isBlueRoom = shouldBeBlue(roomNumber, currentBuilding, currentFloor);
        
        // Если помещение из конфигурации (синее), показываем соответствующую информацию
        if (isBlueRoom) {
            // Попробуем найти запись в данных, чтобы показать площади, если они есть
            const blueData = roomsData.find(room => {
                const normalizedNumber = normalizeRoomNumber(room.number);
                const buildingMatch = (room.building === activeBuilding || room.building === `building-${activeBuilding}` || !room.building);
                const floorMatch = room.floor === currentFloor || room.floor === currentFloor.replace(/^floor-?/, 'floor-');
                return normalizedNumber === normalizedRoomNumber && floorMatch && buildingMatch;
            });

            let html = `
                <p><strong>Номер помещения:</strong> ${roomNumber}</p>
                <p><strong>Здание:</strong> ${activeBuilding}</p>
                <p><strong>Этаж:</strong> ${currentFloor.replace('floor-', '') === '0' ? 'Подвал' : currentFloor.replace('floor-', '') + ' этаж'}</p>
                <p><strong>Статус:</strong> <span style="color: #0000FF; font-weight: bold;">Помещение Унивесала</span></p>
            `;
            if (blueData) {
                if (blueData.area) {
                    html += `<p><strong>Площадь:</strong> ${blueData.area}</p>`;
                }
                if (blueData.contractArea) {
                    html += `<p><strong>Площадь по договору:</strong> ${blueData.contractArea}</p>`;
                }
            }
            roomDetails.innerHTML = html;
            return;
        }
    
    // Создаем составные ключи для поиска
    const fullKey = `${normalizedRoomNumber}_${currentFloor}_${activeBuilding}`;
    const floorNumberKey = `${normalizedRoomNumber}_${currentFloor}`;
    const simpleKey = `${normalizedRoomNumber}`;
    
    console.log(`Ключи поиска: ${fullKey}, ${floorNumberKey}, ${simpleKey}`);
    
    // Сначала ищем точное совпадение (более надежный способ)
    const exactMatch = roomsData.find(room => {
        const normalizedNumber = normalizeRoomNumber(room.number);
        const buildingMatch = (room.building === activeBuilding || room.building === `building-${activeBuilding}` || !room.building);
        const floorMatch = room.floor === currentFloor || room.floor === currentFloor.replace(/^floor-?/, 'floor-');
        return normalizedNumber === normalizedRoomNumber && floorMatch && buildingMatch;
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
    } catch (error) {
        console.error('Ошибка при отображении информации о помещении:', error);
        if (roomDetails) {
            roomDetails.innerHTML = `<p>Произошла ошибка при получении информации о помещении.</p>`;
        }
    }
}

// Отображение данных о помещении (выделено в отдельную функцию)
function displayRoomInfoData(roomNumber, roomData, activeBuilding) {
    try {
        if (!roomDetails) return;
        
        let html = `<p><strong>Номер помещения:</strong> ${roomNumber}</p>`;
        
        // Добавляем информацию о здании, если есть
        if (roomData && roomData.building) {
            html += `<p><strong>Здание:</strong> ${roomData.building}</p>`;
        } else {
            html += `<p><strong>Здание:</strong> ${activeBuilding}</p>`;
        }
        
        // Добавляем информацию об этаже, если есть
        if (roomData && roomData.floor) {
            const floorNumber = roomData.floor.replace('floor-', '');
            const floorName = floorNumber === '0' ? 'Подвал' : `${floorNumber} этаж`;
            html += `<p><strong>Этаж:</strong> ${floorName}</p>`;
        } else {
            const floorNumber = currentFloor.replace('floor-', '');
            const floorName = floorNumber === '0' ? 'Подвал' : `${floorNumber} этаж`;
            html += `<p><strong>Этаж:</strong> ${floorName}</p>`;
        }
        
        html += `<p><strong>Статус:</strong> ${roomData && roomData.tenant ? 'Занято' : 'Свободно'}</p>`;
        
        if (roomData && roomData.tenant) {
            // Если помещение занято, отображаем информацию об арендаторе
            html += `<p><strong>Арендатор:</strong> ${roomData.tenant}</p>`;
            html += `<p><strong>Договор:</strong> ${roomData.contract || 'Нет данных'}</p>`;
            html += `<p><strong>Арендная плата:</strong> ${roomData.rent || 'Нет данных'} руб./мес.</p>`;
        }

        // Площадь и Площадь по договору (показываем, если присутствуют в данных)
        if (roomData && (roomData.area || roomData.contractArea)) {
            if (roomData.area) {
                html += `<p><strong>Площадь:</strong> ${roomData.area}</p>`;
            }
            if (roomData.contractArea) {
                html += `<p><strong>Площадь по договору:</strong> ${roomData.contractArea}</p>`;
            }
        }
        
        roomDetails.innerHTML = html;
    } catch (error) {
        console.error('Ошибка при отображении данных о помещении:', error);
        if (roomDetails) {
            roomDetails.innerHTML = `<p><strong>Номер помещения:</strong> ${roomNumber}</p><p>Ошибка при отображении данных</p>`;
        }
    }
}

// Отображение информации о пустом помещении
function displayEmptyRoomInfo(roomNumber, activeBuilding) {
    try {
        if (!roomDetails) return;
        
        const floorNumber = currentFloor ? currentFloor.replace('floor-', '') : '1';
        const floorName = floorNumber === '0' ? 'Подвал' : `${floorNumber} этаж`;
        
        roomDetails.innerHTML = `
            <p><strong>Номер помещения:</strong> ${roomNumber}</p>
            <p><strong>Здание:</strong> ${activeBuilding}</p>
            <p><strong>Этаж:</strong> ${floorName}</p>
            <p><strong>Статус:</strong> Свободно</p>
            <p>Нет дополнительных данных</p>
        `;
    } catch (error) {
        console.error('Ошибка при отображении информации о пустом помещении:', error);
        if (roomDetails) {
            roomDetails.innerHTML = `<p><strong>Номер помещения:</strong> ${roomNumber}</p><p>Ошибка при отображении данных</p>`;
        }
    }
}

// Функция для выделения особых помещений
function updateSpecialRoomsHighlight() {
    try {
        // Если отображение особых помещений отключено, удаляем классы, 
        // кроме помещения 1 в здании 19, в подвале
        if (!showSpecialRooms) {
            document.querySelectorAll('.special-room').forEach(room => {
                try {
                    // Проверяем, не является ли это помещение номер 1 в здании 19, этаж 0
                    const isRoom1Building19 = room.id === "room-1" && 
                        room.closest('.map-wrapper') && 
                        room.closest('.map-wrapper').dataset.building === "building-19" && 
                        room.closest('.map-wrapper').dataset.floor === "floor-0";
                    
                    // Если это НЕ помещение 1 в здании 19, подвал - удаляем класс
                    if (!isRoom1Building19) {
                        room.classList.remove('special-room');
                    }
                } catch (e) {
                    console.warn('Ошибка при обработке особого помещения:', e);
                }
            });
            
            // Специально добавляем класс для помещения 1 в здании 19, подвал
            const building19Floor0 = document.querySelector('.map-wrapper[data-building="building-19"][data-floor="floor-0"]');
            if (building19Floor0) {
                const room1 = building19Floor0.querySelector('#room-1');
                if (room1) {
                    room1.classList.add('special-room');
                    console.log('Помещение 1 в здании 19, подвал всегда будет выделено синим.');
                }
            }
            
            // Возвращаемся, чтобы не применять дальнейшую логику
            return;
        }
    
        // Убедимся, что specialRooms инициализирован
        if (!specialRooms || !Array.isArray(specialRooms)) {
            console.warn('specialRooms не инициализирован или не является массивом');
            return;
        }
    
        // Для каждого помещения из списка особых
        specialRooms.forEach(specialRoom => {
            try {
                // Проверка корректности объекта specialRoom
                if (!specialRoom || !specialRoom.building || !specialRoom.floor || !specialRoom.room) {
                    console.warn('Некорректные данные особого помещения:', specialRoom);
                    return; // continue для forEach
                }
                
                // Находим схему для здания и этажа
                const wrapper = document.querySelector(`.map-wrapper[data-building="${specialRoom.building}"][data-floor="${specialRoom.floor}"]`);
                
                if (wrapper) {
                    // Находим элемент помещения
                    const roomElement = wrapper.querySelector(`#room-${specialRoom.room}`);
                    
                    if (roomElement) {
                        // Проверяем, не является ли это помещение уже синим (из списка blue-rooms)
                        if (!roomElement.classList.contains('blue-room')) {
                            // Добавляем класс особого помещения только если оно не в списке blue-rooms
                            roomElement.classList.add('special-room');
                            console.log(`Выделено особое помещение: ${specialRoom.room} в ${specialRoom.building}, ${specialRoom.floor}`);
                        }
                    } else {
                        console.warn(`Не найден элемент для особого помещения: ${specialRoom.room} в ${specialRoom.building}, ${specialRoom.floor}`);
                    }
                }
            } catch (error) {
                console.warn(`Ошибка при обработке особого помещения ${specialRoom?.room}:`, error);
            }
        });
        
        // Отдельно проверим текущую активную схему для немедленного применения стилей
        if (currentBuilding && currentFloor) {
            try {
                const currentSpecialRooms = specialRooms.filter(
                    r => r && r.building === currentBuilding && r.floor === currentFloor
                );
                
                if (currentSpecialRooms.length > 0) {
                    const activeWrapper = document.querySelector('.map-wrapper.active');
                    if (activeWrapper) {
                        currentSpecialRooms.forEach(specialRoom => {
                            try {
                                if (!specialRoom || !specialRoom.room) return; // skip
                                
                                const roomElement = activeWrapper.querySelector(`#room-${specialRoom.room}`);
                                if (roomElement && !roomElement.classList.contains('blue-room')) {
                                    roomElement.classList.add('special-room');
                                }
                            } catch (e) {
                                console.warn(`Ошибка при обработке текущего особого помещения ${specialRoom?.room}:`, e);
                            }
                        });
                    }
                }
            } catch (error) {
                console.warn('Ошибка при обработке особых помещений для текущего этажа:', error);
            }
        }
    } catch (error) {
        console.error('Ошибка при обновлении выделения особых помещений:', error);
    }
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