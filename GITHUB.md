# Памятка по работе с GitHub для проекта plan-Universal

## Данные для аутентификации

- **Имя пользователя**: andreyvalerr@gmail.com
- **Репозиторий**: plan-Universal
- **URL репозитория**: https://github.com/andreyvalerr/plan-Universal
- **Токен доступа**: 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

## Базовые команды для работы с репозиторием

### Клонирование репозитория

```bash
git clone https://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@github.com/andreyvalerr/plan-Universal.git
```

### Проверка статуса

```bash
cd plan-Universal
git status
```

### Добавление изменений

```bash
# Добавить конкретный файл
git add index.html

# Добавить все измененные файлы
git add .
```

### Создание коммита

```bash
git commit -m "Описание внесенных изменений"
```

### Отправка изменений на GitHub

```bash
git push origin main
```

### Получение изменений с GitHub

```bash
git pull origin main
```

## Рекомендации по работе с репозиторием

1. **Всегда делайте резервные копии** перед крупными изменениями.
2. **Используйте информативные комментарии** при создании коммитов, чтобы позже было понятно, какие изменения были внесены.
3. **Регулярно обновляйте локальный репозиторий** с помощью `git pull`, особенно если над проектом работает несколько человек.
4. **Проверяйте изменения перед отправкой** на GitHub с помощью `git diff` или `git status`.
5. **Используйте ветки** для разработки новых функций, чтобы не нарушать работу основной версии проекта.

## Установка проекта на сервер

1. Клонируйте репозиторий:
   ```bash
   git clone https://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@github.com/andreyvalerr/plan-Universal.git
   ```

2. Скопируйте файлы в директорию веб-сервера:
   ```bash
   cp -r plan-Universal/* /var/www/html/
   cp -r plan-Universal/.htaccess /var/www/html/
   ```

3. Настройте права доступа:
   ```bash
   chown -R www-data:www-data /var/www/html/
   ```

4. Убедитесь, что включен модуль rewrite для Apache:
   ```bash
   a2enmod rewrite
   systemctl restart apache2
   ```

## Учетные данные для веб-приложения

- **Логин**: admin
- **Пароль**: Pbey*n

Эти данные указаны в файле `login.php` и могут быть изменены при необходимости.

## Контакты для технической поддержки

При возникновении проблем с репозиторием или вопросов по проекту обращайтесь к администратору:

- **Email**: andreyvalerr@gmail.com
- **GitHub**: [andreyvalerr](https://github.com/andreyvalerr)