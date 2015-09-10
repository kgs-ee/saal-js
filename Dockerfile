FROM node:0.12-slim

ADD ./ /usr/src/saal
RUN apt-get update && apt-get install -y python
RUN cd /usr/src/saal && npm install

CMD ["node", "/usr/src/saal/master.js"]
