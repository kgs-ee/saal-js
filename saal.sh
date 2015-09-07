#!/bin/bash

mkdir -p /data/saal/code /data/saal/log /data/saal/ssl
cd /data/saal/code

git clone https://github.com/argoroots/saal.git ./
git checkout master
git pull

version=`date +"%y%m%d.%H%M%S"`

docker build -q -t saal:$version ./ && docker tag -f saal:$version saal:latest
docker kill saal
docker rm saal
docker run -d \
    --name="saal" \
    --restart="always" \
    --memory="512m" \
    --env="PORT=80" \
    --env="COOKIE_SECRET=" \
    --env="NEW_RELIC_APP_NAME=saal" \
    --env="NEW_RELIC_LICENSE_KEY=" \
    --env="NEW_RELIC_LOG=stdout" \
    --env="NEW_RELIC_LOG_LEVEL=error" \
    --env="NEW_RELIC_NO_CONFIG_FILE=true" \
    --env="ENTU_USER=" \
    --env="ENTU_KEY=" \
    --volume="/data/saal/log:/usr/src/saal/log" \
    saal:latest

/data/nginx.sh