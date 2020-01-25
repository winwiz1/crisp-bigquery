FROM node:12.8.1-slim as build
RUN apt-get update -y && apt-get upgrade -y

WORKDIR /crisp-bigquery/server
COPY --chown=node:node ./server/ .
WORKDIR /crisp-bigquery/client
COPY --chown=node:node ./client/ .
RUN yarn && yarn build:prod

FROM build as prod

WORKDIR /crisp-bigquery/server
COPY --chown=node:node ./server/ .
COPY --from=build --chown=node:node /crisp-bigquery/client/config/ /crisp-bigquery/server/config/
RUN yarn && yarn compile

COPY --from=build --chown=node:node /crisp-bigquery/client/dist/ /crisp-bigquery/server/build/client/static/

EXPOSE 3000
ENV NODE_ENV=production

USER node
CMD ["node", "./build/srv/main.js"]
