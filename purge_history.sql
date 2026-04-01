-- SQL Script para purgar el historial (Uncapped Mode)
-- Ajusta los nombres de las tablas si utilizas otras variables de entorno para la BB.DD.

TRUNCATE TABLE posts_pablo RESTART IDENTITY CASCADE;
TRUNCATE TABLE schedule_executions_pablo RESTART IDENTITY CASCADE;
TRUNCATE TABLE creators_pablo RESTART IDENTITY CASCADE;
-- Nota: Asegúrate de NO truncar la tabla profiles_pablo para mantener a los usuarios configurados, a no ser que quieras empezar completamente de cero.
