#!/bin/bash

mkdir -p /data/saal/code /data/saal/log
cd /data/saal/code

git clone -q https://github.com/kgs-ee/saal-js.git ./
git checkout -q master
git pull

printf "\n\n"
version=`date +"%y%m%d.%H%M%S"`
docker build --quiet --pull --tag=saal:$version ./ && docker tag saal:$version saal:latest

printf "\n\n"
docker stop saal
docker rm saal
docker run -d \
    --net="entu" \
    --name="saal" \
    --restart="always" \
    --cpu-shares=256 \
    --memory="350m" \
    --env="NODE_ENV=production" \
    --env="VERSION=$version" \
    --env="PORT=80" \
    --env="COOKIE_SECRET=" \
    --env="DEPLOYMENT=debug" \
    --env="NEW_RELIC_APP_NAME=saal" \
    --env="NEW_RELIC_LICENSE_KEY=" \
    --env="NEW_RELIC_LOG=stdout" \
    --env="NEW_RELIC_LOG_LEVEL=error" \
    --env="NEW_RELIC_NO_CONFIG_FILE=true" \
    --env="ENTU_USER=" \
    --env="ENTU_KEY=" \
    --env="SENTRY_DSN=" \
    --volume="/data/saal/log:/usr/src/saal/log" \
    --volume="/data/saal/cache:/usr/src/saal/pagecache" \
    saal:latest

printf "\n\n"
docker exec nginx /etc/init.d/nginx reload
