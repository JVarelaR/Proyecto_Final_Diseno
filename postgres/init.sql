-- Base de datos exclusiva para las credenciales y flujos de n8n
CREATE DATABASE n8n_db;

-- Activar pgvector en la base de datos de la aplicación
\c gestion_personas;
CREATE EXTENSION IF NOT EXISTS vector;