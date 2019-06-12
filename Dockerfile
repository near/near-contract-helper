FROM phusion/baseimage:0.11

RUN curl -o /tmp/node_setup.sh "https://deb.nodesource.com/setup_11.x"
RUN bash /tmp/node_setup.sh
RUN curl -sL https://dl.yarnpkg.com/debian/pubkey.gpg | apt-key add -
RUN echo 'deb https://dl.yarnpkg.com/debian/ stable main' | tee /etc/apt/sources.list.d/yarn.list
RUN apt-get update -qq && apt-get install -y \
    jq \
    nodejs


# contract-helper
COPY . /near-contract-helper/
WORKDIR /near-contract-helper
RUN npm install
RUN mkdir /etc/service/contract-helper
COPY /scripts/run.sh /etc/service/contract-helper/run
