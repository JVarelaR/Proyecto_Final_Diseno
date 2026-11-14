import os
from datetime import datetime, timedelta, timezone
import jwt
from roble import (
    RobleAuthError,
    RobleClient,
    RobleError,
    RobleHttpError,
    User,
)
from sqlalchemy import Column, String, Text, create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

ROBLE_BASE_URL = os.getenv("ROBLE_BASE_URL", "https://roble-api.openlab.uninorte.edu.co").rstrip("/")
ROBLE_CONTRACT_ID = os.getenv("ROBLE_CONTRACT_ID", "").strip()
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "clave_secreta")
JWT_ALGORITHM = "HS256"

# Conexión síncrona para persistir el TokenStorage de cada usuario en PostgreSQL
SYNC_DATABASE_URL = os.getenv(
    "DATABASE_URL", "postgresql://admin:admin123@postgres-db:5432/gestion_personas"
).replace("+asyncpg", "")

engine = create_engine(SYNC_DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine)
Base = declarative_base()


class RobleTokenRecord(Base):
    __tablename__ = "roble_token_storage"

    storage_key = Column(String(255), primary_key=True)
    storage_value = Column(Text, nullable=False)


Base.metadata.create_all(bind=engine)


class PostgresTokenStorage:
    """Implementa el protocolo TokenStorage de la librería roble por usuario."""

    def __init__(self, namespace: str):
        self.namespace = namespace

    def _full_key(self, key: str) -> str:
        return f"{self.namespace}:{key}"

    def get_item(self, key: str) -> str | None:
        with SessionLocal() as db:
            row = db.get(RobleTokenRecord, self._full_key(key))
            return row.storage_value if row else None

    def set_item(self, key: str, value: str) -> None:
        with SessionLocal() as db:
            full_key = self._full_key(key)
            row = db.get(RobleTokenRecord, full_key)
            if row:
                row.storage_value = value
            else:
                db.add(RobleTokenRecord(storage_key=full_key, storage_value=value))
            db.commit()

    def remove_item(self, key: str) -> None:
        with SessionLocal() as db:
            row = db.get(RobleTokenRecord, self._full_key(key))
            if row:
                db.delete(row)
                db.commit()


def _get_client(namespace: str) -> RobleClient:
    if not ROBLE_CONTRACT_ID:
        raise ValueError("ROBLE_CONTRACT_ID no está configurado")
    return RobleClient(
        base_url=ROBLE_BASE_URL,
        contract_id=ROBLE_CONTRACT_ID,
        storage=PostgresTokenStorage(namespace),
        timeout=15.0,
    )


def _create_session_jwt(user: User) -> str:
    payload = {
        "sub": user.user_id,
        "email": user.email,
        "name": user.name,
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
    }
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


def decode_session_jwt(token: str) -> dict:
    return jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])


def signup_user(email: str, password: str, name: str) -> dict:
    # Para registro sin auto-login basta un cliente en memoria
    with RobleClient(base_url=ROBLE_BASE_URL, contract_id=ROBLE_CONTRACT_ID) as client:
        return client.register(
            email=email,
            password=password,
            name=name,
            auto_login=False,
        )


def login_user(email: str, password: str) -> dict:
    # Usamos el email normalizado como namespace para guardar la sesión de este usuario
    namespace = email.lower().strip()
    with _get_client(namespace) as client:
        user = client.login(email=email, password=password, persist_session=True)
        # Re-indexamos el storage bajo user.user_id para consultas futuras por JWT
        user_client = _get_client(user.user_id)
        for k in ("access_token", "refresh_token", "session"):
            val = client._storage.get_item(k) if hasattr(client, "_storage") else None
            if val:
                user_client._storage.set_item(k, val)
        user_client.close()

        session_token = _create_session_jwt(user)
        return {
            "access_token": session_token,
            "token_type": "bearer",
            "user": {
                "user_id": user.user_id,
                "email": user.email,
                "name": user.name,
                "extra": user.extra,
            },
        }


def verify_user_session(session_token: str) -> dict:
    claims = decode_session_jwt(session_token)
    user_id = claims["sub"]
    namespace = claims["email"].lower().strip()

    with _get_client(namespace) as client:
        # restore_session(verify=True) renueva el access token contra ROBLE si expiró
        if not client.restore_session(verify=True):
            raise RobleAuthError("La sesión en ROBLE ha caducado")

        user = client.current_user()
        return {
            "user_id": user.user_id or user_id,
            "email": user.email,
            "name": user.name,
            "extra": user.extra,
        }


def logout_user(session_token: str) -> None:
    claims = decode_session_jwt(session_token)
    namespace = claims["email"].lower().strip()

    with _get_client(namespace) as client:
        client.restore_session(verify=False)
        client.logout()