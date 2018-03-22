#!/bin/bash

cd /opt/redash-brightcom/redash
echo "Pulling latest changes from git repository."
git pull
echo " deleting current deployment"
docker-compose --project-name master -f docker-compose.production.yml down
echo "removing redash/base image (causing errors while building docker image")
docker image remove redash/base
echo "bulding docker image redash-brightcom-latest"
docker build --no-cache -t redash-brightcom-latest .
echo "starting environment with new code"
docker-compose --project-name master -f docker-compose.production.yml up -d
echo "running containers:"
docker ps
