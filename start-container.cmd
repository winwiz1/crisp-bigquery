@echo OFF
rem Uncomment the next two lines if running this file from empty directory
rem git clone https://github.com/winwiz1/crisp-bigquery.git
rem cd crisp-bigquery
setlocal
set HOST_PORT=3000
set HOST_ADDRESS=127.0.0.1
docker rmi crisp-bigquery:localbuild 2>nul
docker build -t crisp-bigquery:localbuild .
if ERRORLEVEL 1 echo Failed to build image && exit /b 2
docker stop crisp-bigquery 2>nul
docker rm crisp-bigquery 2>nul
docker run -d --name=crisp-bigquery -p %HOST_PORT%:3000 crisp-bigquery:localbuild
if ERRORLEVEL 1 echo Failed to run container && exit /b 1
echo Finished && docker ps -f name=crisp-bigquery
rem Uncomment the next line if Chrome is installed
rem start chrome http://%HOST_ADDRESS%:%HOST_PORT%
