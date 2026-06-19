FROM node:20-slim

# Install CF CLI
RUN apt-get update && apt-get install -y wget gnupg2 && \
    wget -q -O - https://packages.cloudfoundry.org/debian/cli.cloudfoundry.org.key | apt-key add - && \
    echo "deb https://packages.cloudfoundry.org/debian stable main" | tee /etc/apt/sources.list.d/cloudfoundry-cli.list && \
    apt-get update && apt-get install -y cf8-cli && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json .
RUN npm install --production
COPY watchdog.js .

EXPOSE 3000
CMD ["node", "watchdog.js"]
