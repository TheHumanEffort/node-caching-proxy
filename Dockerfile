FROM node:5

ENV PROXY_BASE http://www.apple.com
ENV LIFETIME_SECS 86400
ENV PORT 8080

EXPOSE 8080

CMD node /application/server.js

ADD . /application
