FROM node:slim

ADD ./ /usr/src/saal
RUN cd /usr/src/saal && npm install

EXPOSE  3000
CMD ["node", "/usr/src/saal/app.js"]
