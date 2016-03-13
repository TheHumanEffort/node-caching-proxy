FROM node:5

ENV PROXY_BASE http://www.apple.com
ENV LIFETIME_SECS 86400
ENV PORT 8080

EXPOSE 8080
RUN mkdir /aplication
WORKDIR /application

CMD node /application/server.js

ADD package.json /application/package.json
RUN npm install

ADD . /application
