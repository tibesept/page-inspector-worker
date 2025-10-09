Описать установку через make

COMPOSE_BASE_FILE = docker-compose.yml
COMPOSE_OVERRIDE_FILE = docker-compose.override.yml
COMPOSE_PROD_FILE = docker-compose.prod.yml

DEV_FILES = -f $(COMPOSE_BASE_FILE) -f $(COMPOSE_OVERRIDE_FILE)
PROD_FILES = -f $(COMPOSE_BASE_FILE) -f $(COMPOSE_PROD_FILE)


ARM_FLAG :=

# Если arm64,
# то добавляем файл-переопределение
ifeq ($(shell uname -m), arm64)
	ARM_FLAG := -f docker-compose.arm64.yml
endif

# --- Команды ---

.DEFAULT_GOAL := help

# Группа: Запуск окружения
# --------------------------------------------------
dev:
	docker compose $(DEV_FILES) $(ARM_FLAG) up --build -d
up: dev ## Запустить dev-окружение в фоновом режиме (синоним: dev)

prod: ## Запустить prod-окружение в фоновом режиме
	docker compose $(PROD_FILES) $(ARM_FLAG) up --build -d

# ... (остальные команды остаются без изменений) ...

# Группа: Управление контейнерами
# --------------------------------------------------
stop: ## Остановить контейнеры, не удаляя их
	docker compose $(DEV_FILES) stop

down: ## Остановить и удалить все контейнеры и сети
	docker compose $(DEV_FILES) down -v

logs: ## Показать логи всех сервисов в реальном времени
	docker compose $(DEV_FILES) logs -f --tail=100

ps: ## Показать статус контейнеров
	docker compose $(DEV_FILES) ps

# Группа: Сборка и очистка
# --------------------------------------------------
build: ## Принудительно пересобрать образы без запуска контейнеров
	docker compose $(DEV_FILES) $(ARM_FLAG) build

clean: ## Полная очистка: остановить, удалить контейнеры, сети, тома и образы
	docker compose $(DEV_FILES) down -v --rmi all --remove-orphans

# Группа: Справка
# --------------------------------------------------
help: ## Показать эту справку
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

.PHONY: up dev prod stop down logs ps build clean help


Описать установку руками через docker