#!/bin/sh
psql -c "create user helper with encrypted password 'helper';" -U postgres
psql -c "create database accounts_test;" -U postgres
psql -c "grant all privileges on database accounts_test to helper" -U postgres
psql -c "create database accounts_development;" -U postgres
psql -c "grant all privileges on database accounts_development to helper" -U postgres