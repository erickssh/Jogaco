FROM node:24-alpine
WORKDIR /app
COPY gruta-do-ocaso/ ./gruta-do-ocaso/
COPY public/ocaso/ ./public/ocaso/
ENV OCASO_HOST=0.0.0.0
ENV PORT=4286
EXPOSE 4286
USER node
CMD ["node", "gruta-do-ocaso/server/ocaso/run.mjs"]
