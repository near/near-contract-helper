#!/bin/sh
psql -c "create user helper with encrypted password 'helper';"
psql -c "create database accounts_test;"
psql -c "grant all privileges on database accounts_test to helper"
psql -c "create database accounts_development;"
psql -c "grant all privileges on database accounts_development to helper"