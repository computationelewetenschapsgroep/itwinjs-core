FROM node:22
RUN corepack enable pnpm
RUN npm install -g @microsoft/rush
WORKDIR /app
COPY . .
RUN rush install --bypass-policy
RUN rush clean
RUN rush build
#RUN rush cover
RUN ./scripts/geojson2imodel.sh
WORKDIR /app/test-apps/display-test-app
EXPOSE 3001
CMD ["npm", "run","start:servers"]
