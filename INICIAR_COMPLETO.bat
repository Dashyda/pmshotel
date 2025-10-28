@echo off
echo ============================================
echo    🏨 PMS Sistema Completo - Inicio
echo ============================================
echo.

echo Verificando Node.js...
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Error: Node.js no esta instalado
    pause
    exit /b 1
)

echo ✅ Node.js detectado
echo.

echo 🔧 Iniciando Backend (Puerto 3001)...
cd /d "%~dp0backend"
start "PMS Backend" cmd /c "echo Iniciando Backend... & node simple-demo-server.js & pause"

echo ⏳ Esperando 3 segundos para que el backend inicie...
timeout /t 3 /nobreak >nul

echo.
echo 🌐 Iniciando Frontend (Puerto 3000)...
cd /d "%~dp0frontend"

echo Verificando dependencias del frontend...
if not exist "node_modules" (
    echo 📦 Instalando dependencias...
    npm install
)

echo.
echo ================================================
echo   🚀 Sistema PMS Iniciado Completamente
echo   📱 Frontend: http://localhost:3000
echo   🔧 Backend:  http://localhost:3001
echo   
echo   📧 Credenciales de prueba:
echo      Super Admin -> Email: admin@pms.com   Password: admin123
echo      Costa Dorada -> Usuario: admin        Password: moonpalace
echo ================================================
echo.

npm start