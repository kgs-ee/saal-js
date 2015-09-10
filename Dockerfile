FROM node:4.0-slim

ADD ./ /usr/src/saal
RUN cd /usr/src/saal && npm install

CMD ["node", "/usr/src/saal/master.js"]
