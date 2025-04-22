# ====================================
# Build the frontend
# ====================================
FROM node:20 AS frontend

WORKDIR /app/frontend

COPY .frontend /app/frontend

RUN npm install && npm run build


# ====================================
# Backend
# ====================================
FROM python:3.11 AS release

WORKDIR /app

ENV PYTHONPATH=/app

# Install Astral uv
# Download the latest installer
ADD https://astral.sh/uv/install.sh /uv-installer.sh

RUN sh /uv-installer.sh && rm /uv-installer.sh

ENV PATH="/root/.local/bin/:$PATH"


COPY --from=frontend /app/frontend/out /app/static

COPY . .

# Install dependencies
RUN uv sync

# Remove frontend code
RUN rm -rf .frontend

EXPOSE 8000

CMD ["uv", "run", "fastapi", "run"]