-- ====================================================================
-- SCRIPTS DE DATOS DE PRUEBA PARA EL PMS
-- ====================================================================
-- Inserta datos de ejemplo para probar todas las funcionalidades
-- ====================================================================

USE pms_system;

-- Reiniciar datos dependientes para mantener consistencia
SET foreign_key_checks = 0;

TRUNCATE TABLE reserva_huespedes;
TRUNCATE TABLE historico_ocupacion;
TRUNCATE TABLE inspecciones;
TRUNCATE TABLE novedades;
TRUNCATE TABLE unidad_recursos;
TRUNCATE TABLE colaborador_turnos;
TRUNCATE TABLE reservas;
TRUNCATE TABLE huespedes;
TRUNCATE TABLE colaboradores;
TRUNCATE TABLE unidades;
TRUNCATE TABLE cargos;
TRUNCATE TABLE complejos;
TRUNCATE TABLE usuarios;
TRUNCATE TABLE departamentos;
TRUNCATE TABLE organizaciones;

SET foreign_key_checks = 1;


-- ====================================================================
-- SIN DATOS DE PRUEBA
-- Este script solo limpia las tablas para dejar la base lista.
-- ====================================================================
SELECT 'La base de datos quedó sin datos de prueba.' AS mensaje,
       (SELECT COUNT(*) FROM usuarios) AS usuarios_creados,
       (SELECT COUNT(*) FROM complejos) AS complejos_creados,
       (SELECT COUNT(*) FROM unidades) AS unidades_creadas,
       (SELECT COUNT(*) FROM colaboradores) AS colaboradores_creados,
       (SELECT COUNT(*) FROM huespedes) AS huespedes_creados,
       (SELECT COUNT(*) FROM reservas) AS reservas_creadas,
       (SELECT COUNT(*) FROM novedades) AS novedades_creadas,
       (SELECT COUNT(*) FROM inspecciones) AS inspecciones_creadas;