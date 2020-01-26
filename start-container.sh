#!/bin/sh
# Uncomment the next two lines if running this script from empty directory
# git clone https://github.com/winwiz1/crisp-bigquery.git
# cd crisp-bigquery
HOST_PORT=3000
HOST_ADDRESS=127.0.0.1
docker rmi crisp-bigquery:localbuild 2>/dev/null
docker build -t crisp-bigquery:localbuild . || { echo 'Failed to build image' ; exit 2; }
docker stop crisp-bigquery 2>/dev/null
docker rm crisp-bigquery 2>/dev/null
docker run -d --name=crisp-bigquery -p ${HOST_PORT}:3000 --env-file ./server/.env crisp-bigquery:localbuild || { echo 'Failed to run container' ; exit 1; }
echo 'Finished' && docker ps -f name=crisp-bigquery
# xdg-open http://${HOST_ADDRESS}:${HOST_PORT} &
