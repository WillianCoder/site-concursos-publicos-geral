@echo off
rem ==========================================================================
rem  Backup Automatico - de dois cliques aqui para abrir o painel.
rem  Dica: arraste uma pasta para cima deste arquivo para criar o backup dela.
rem ==========================================================================
setlocal
set "PASTA=%~1"
if not defined PASTA goto :semPasta
if "%PASTA:~-1%"=="\" set "PASTA=%PASTA%."
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0app\Iniciar.ps1" -Pasta "%PASTA%"
goto :verificar

:semPasta
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0app\Iniciar.ps1"

:verificar
if errorlevel 1 goto :erro
exit /b 0

:erro
echo.
echo Nao foi possivel abrir o Backup Automatico. Veja a mensagem acima.
echo Se precisar de ajuda, leia o arquivo LEIA-ME.
pause
exit /b 1
