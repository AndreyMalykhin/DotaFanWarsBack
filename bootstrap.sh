#!/usr/bin/env bash

projectDir="$1"
source "${projectDir}/.env"

sudo cat > /etc/default/locale <<EOL
LANGUAGE="en_US.UTF-8"
LANG="en_US.UTF-8"
LC_ALL="en_US.UTF-8"
EOL

curl -sL https://deb.nodesource.com/setup_4.x \
| sudo -E bash - \
&& sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv EA312927 \
&& echo "deb http://repo.mongodb.org/apt/ubuntu trusty/mongodb-org/3.2 multiverse" \
| sudo tee /etc/apt/sources.list.d/mongodb-org-3.2.list \
&& sudo apt-get update \
&& sudo apt-get -y install build-essential nodejs git mongodb-org

if [ $DFWB_DEV = "1" ]; then
    initCmd="npm run typings init"
else
    initCmd="npm install -g pm2 && npm run build"
fi

sudo service mongod restart

cd "${projectDir}" \
&& npm install --no-bin-links \
&& ${initCmd}
