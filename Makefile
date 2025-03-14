# Makefile pour l'application Transport Grenoble

# Variables
BACKEND_DIR = backend
FRONTEND_DIR = frontend
PYTHON = python3
PIP = pip3
NPM = npm

# Détection du système d'exploitation
ifeq ($(OS),Windows_NT)
    DETECTED_OS := Windows
    ACTIVATE_CMD := $(BACKEND_DIR)\venv\Scripts\activate
else
    DETECTED_OS := $(shell uname -s)
    ACTIVATE_CMD := source $(BACKEND_DIR)/venv/bin/activate
endif

.PHONY: all install install-backend install-frontend run run-backend run-frontend stop clean help venv

# Cible par défaut
all: install run

# Installation des dépendances
install: install-backend install-frontend

install-backend: venv
	@echo "Installation des dépendances backend..."
	cd $(BACKEND_DIR) && $(PIP) install -r requirements.txt

install-frontend:
	@echo "Installation des dépendances frontend..."
	cd $(FRONTEND_DIR) && $(NPM) install

# Création de l'environnement virtuel Python
venv:
	@echo "Création de l'environnement virtuel Python..."
	$(PYTHON) -m venv $(BACKEND_DIR)/venv
	@echo "Pour activer l'environnement virtuel, exécutez:"
	@echo "  $(ACTIVATE_CMD)"

# Lancement des services
run:
	@echo "Pour lancer l'application complète, ouvrez deux terminaux et exécutez:"
	@echo "Terminal 1: make run-backend"
	@echo "Terminal 2: make run-frontend"

run-backend:
	@echo "Démarrage du serveur backend..."
	cd $(BACKEND_DIR) && uvicorn app:app --reload --host 0.0.0.0 --port 8000

run-frontend:
	@echo "Démarrage du serveur frontend..."
	cd $(FRONTEND_DIR) && $(NPM) start

# Arrêt des services
stop:
	@echo "Arrêt des serveurs..."
ifeq ($(DETECTED_OS),Windows)
	@echo "Sur Windows, fermez manuellement les fenêtres de terminal ou utilisez Ctrl+C."
else
	-pkill -f "uvicorn app:app" || true
	-pkill -f "node.*react-scripts" || true
	@echo "Serveurs arrêtés"
endif

# Nettoyage
clean:
	@echo "Nettoyage des fichiers temporaires..."
	rm -rf $(BACKEND_DIR)/__pycache__ $(BACKEND_DIR)/*.pyc
	rm -rf $(FRONTEND_DIR)/build
	@echo "Pour nettoyer complètement (y compris les dépendances), exécutez: make clean-all"

clean-all: clean
	@echo "Suppression de l'environnement virtuel et des modules node..."
	rm -rf $(BACKEND_DIR)/venv
	rm -rf $(FRONTEND_DIR)/node_modules

# Aide
help:
	@echo "Grenoble Transport Map - Aide"
	@echo "============================="
	@echo "Cibles disponibles:"
	@echo "  all            : Installer et démarrer l'application"
	@echo "  install        : Installer toutes les dépendances"
	@echo "  install-backend: Installer les dépendances backend"
	@echo "  install-frontend: Installer les dépendances frontend"
	@echo "  venv           : Créer un environnement virtuel Python"
	@echo "  run            : Afficher les instructions pour lancer les serveurs"
	@echo "  run-backend    : Démarrer le serveur backend"
	@echo "  run-frontend   : Démarrer le serveur frontend"
	@echo "  stop           : Arrêter tous les serveurs en cours"
	@echo "  clean          : Nettoyer les fichiers temporaires"
	@echo "  clean-all      : Nettoyer tous les fichiers, y compris les dépendances"
	@echo "  help           : Afficher ce message d'aide"
	@echo ""
	@echo "Procédure de démarrage:"
	@echo "1. make install  (pour installer les dépendances)"
	@echo "2. make run-backend (dans un terminal)"
	@echo "3. make run-frontend (dans un autre terminal)"
	@echo ""
	@echo "L'application est accessible à:"
	@echo "  Backend: http://localhost:8000"
	@echo "  Frontend: http://localhost:3000"
