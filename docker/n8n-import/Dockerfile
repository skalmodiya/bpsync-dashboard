FROM n8nio/n8n:latest

USER root

WORKDIR /workflows
COPY workflows/ /workflows/
COPY import.sh /import.sh
RUN chmod +x /import.sh

USER node
ENTRYPOINT ["/import.sh"]
