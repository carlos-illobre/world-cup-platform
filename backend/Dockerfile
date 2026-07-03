FROM python:3.12-slim

# Crear usuario sin privilegios por seguridad (Least Privilege Principle)
RUN useradd -m -s /bin/bash appuser

WORKDIR /app

COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Cambiar propiedad de los archivos al nuevo usuario
RUN chown -R appuser:appuser /app

# Cambiar al usuario seguro
USER appuser

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--forwarded-allow-ips", "*"]
