@echo off
echo 🎉 Instalando Aplicacion de Revelacion de Sexo...
echo.

echo Instalando dependencias del servidor...
call npm install
if %errorlevel% neq 0 (
    echo ❌ Error instalando dependencias del servidor
    pause
    exit /b %errorlevel%
)

echo.
echo Instalando dependencias del cliente...
cd client
call npm install
if %errorlevel% neq 0 (
    echo ❌ Error instalando dependencias del cliente
    pause
    exit /b %errorlevel%
)

cd ..
echo.
echo ✅ Instalacion completada!
echo.
echo Para iniciar la aplicacion, ejecuta: npm start
echo.
echo URLs importantes:
echo - Invitados: http://localhost:3001/
echo - Admin: http://localhost:3001/admin  
echo - Proyeccion: http://localhost:3001/projection
echo.
pause