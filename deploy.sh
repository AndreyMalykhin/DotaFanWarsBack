#!/usr/bin/env bash

envConfigFile="$1"

mv .env .env_
cp "${envConfigFile}" .env
vagrant up --provider digital_ocean
rm .env
mv .env_ .env
