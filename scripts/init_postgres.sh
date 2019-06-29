#!/bin/bash
set -e

mkdir -p /srv/near/postgresql && \
    chown -R postgres:postgres /srv/near/postgresql

if [[ ! -d '/srv/near/postgresql/10/main' ]]; then
su - postgres -c "
    /usr/lib/postgresql/10/bin/initdb -D /srv/near/postgresql/10/main &&
    /etc/init.d/postgresql start &&
    psql -c \"CREATE USER helper password 'helper'\" &&
    createdb -O helper accounts_production"
else
    /etc/init.d/postgresql start
fi
