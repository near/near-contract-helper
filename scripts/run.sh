#!/bin/bash
set -e

if [[ -z ${NODE_ENV} ]]
then
    export NODE_ENV=production
fi

cd /near-contract-helper

node app.js >> /var/log/contract-helper.log 2>&1
