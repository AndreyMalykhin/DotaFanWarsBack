#!/usr/bin/env bash

envConfigFile="$1"

mv .env .env_
cp "${envConfigFile}" .env
vagrant up --no-provision --provider digital_ocean
vagrant provision
rm .env
mv .env_ .env
