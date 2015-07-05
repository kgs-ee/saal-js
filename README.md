# Kanuti Gildi Saal

### Run

docker build -t mitselek/saal
docker run -d -v ~/Documents/github/saal-js/:/usr/src/saal --name saaliweb mitselek/saal:latest
docker logs -f saaliweb



