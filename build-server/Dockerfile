FROM ubuntu:focal

RUN apt-get update

RUN apt-get install -y \
    curl \
    git

RUN curl -sL https://deb.nodesource.com/setup_20.x | bash -

RUN apt-get update

RUN apt-get install -y nodejs

RUN apt-get upgrade -y

RUN apt-get clean && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /home/app

COPY main.sh main.sh

ENTRYPOINT [ "/home/app/main.sh" ]
