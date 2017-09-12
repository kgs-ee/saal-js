FROM node:6-slim

ADD ./ /usr/src/saal
RUN cd /usr/src/saal && npm --silent --production install

CMD ["node", "/usr/src/saal/master.js"]
