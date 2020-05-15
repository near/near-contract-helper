FROM phusion/baseimage:0.11

RUN curl -o /tmp/node_setup.sh "https://deb.nodesource.com/setup_12.x"
RUN bash /tmp/node_setup.sh
RUN apt-get update -qq && apt-get install -y \
    jq \
    nodejs \
    postgresql
RUN npm install -g yarn

COPY /scripts/postgresql.conf /etc/postgresql/10/main/postgresql.conf
COPY /scripts/init_postgres.sh /etc/my_init.d/

# contract-helper
COPY . /near-contract-helper/
WORKDIR /near-contract-helper
RUN yarn
RUN mkdir -p /etc/service/contract-helper
COPY /scripts/run.sh /etc/service/contract-helper/run
