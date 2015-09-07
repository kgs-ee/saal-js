FROM node:0.12-slim

ADD ./ /usr/src/saal
RUN cd /usr/src/saal && npm install

CMD ["node", "/usr/src/saal/app.js"]
