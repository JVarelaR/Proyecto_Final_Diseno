FROM python:3.12-slim

WORKDIR /app

COPY requirements-common.txt .
COPY ms-auth/requirements.txt ./requirements-auth.txt
RUN pip install --no-cache-dir -r requirements-auth.txt

COPY shared ./shared
COPY alembic.ini ./alembic.ini
COPY migrations ./migrations
COPY ms-auth/app ./app

ENV PYTHONPATH=/app

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
