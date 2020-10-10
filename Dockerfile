FROM node:12.18.4-slim as build
RUN apt-get update -qq && apt-get upgrade -qq \
  && apt-get clean autoclean && apt-get autoremove -y \
  && rm -rf \
    /var/lib/cache \
    /var/lib/log

WORKDIR /crisp-bigquery/server
COPY --chown=node:node ./server/ .
RUN yarn
WORKDIR /crisp-bigquery/client
COPY --chown=node:node ./client/ .
COPY --chown=node:node ./.env .
RUN yarn && yarn build:prod

FROM build as prod

WORKDIR /crisp-bigquery
COPY --chown=node:node ./key.json .
WORKDIR /crisp-bigquery/server
COPY --chown=node:node ./server/ .
COPY --from=build --chown=node:node /crisp-bigquery/client/config/ /crisp-bigquery/server/config/
RUN yarn && yarn compile

COPY --from=build --chown=node:node /crisp-bigquery/client/dist/ /crisp-bigquery/server/build/client/static/

EXPOSE 3000
ENV NODE_ENV=production
STOPSIGNAL SIGTERM

USER node
CMD ["node", "./build/srv/main.js"]
