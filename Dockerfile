FROM node:slim

ADD ./ /usr/src/wwwentu
RUN cd /usr/src/wwwentu && npm install

CMD ["node", "/usr/src/wwwentu/app.js"]
