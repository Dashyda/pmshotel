-- ====================================================================
-- SISTEMA DE GESTIÓN DE PROPIEDADES (PMS) - ESQUEMA DE BASE DE DATOS
-- ====================================================================
-- Diseño relacional optimizado con índices y relaciones para el PMS
-- Versión: 1.0
-- Fecha: Octubre 2025
-- ====================================================================

-- Configuración inicial
SET foreign_key_checks = 0;
DROP DATABASE IF EXISTS pms_system;
CREATE DATABASE pms_system CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE pms_system;

-- ====================================================================
-- MÓDULO ADMINISTRADOR - USUARIOS, ROLES Y ORGANIZACIÓN
-- ====================================================================

-- Tabla: Organizaciones (Empresas/Grupos hoteleros)
CREATE TABLE organizaciones (
    id INT PRIMARY KEY AUTO_INCREMENT,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    direccion TEXT,
    telefono VARCHAR(20),
    email VARCHAR(100),
    logo_url VARCHAR(255),
    configuracion JSON, -- Configuraciones específicas de la organización
    activo BOOLEAN DEFAULT TRUE,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_organizacion_activo (activo),
    INDEX idx_organizacion_nombre (nombre)
);

-- Tabla: Departamentos
CREATE TABLE departamentos (
    id INT PRIMARY KEY AUTO_INCREMENT,
    organizacion_id INT NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    responsable_id INT,
    activo BOOLEAN DEFAULT TRUE,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_departamento_organizacion (organizacion_id),
    INDEX idx_departamento_activo (activo)
);

-- Tabla: Roles del sistema
CREATE TABLE roles (
    id INT PRIMARY KEY AUTO_INCREMENT,
    nombre VARCHAR(50) NOT NULL UNIQUE,
    descripcion TEXT,
    permisos JSON, -- Array de permisos específicos
    nivel_acceso ENUM('SUPER_ADMIN', 'ADMIN', 'MANAGER', 'EMPLEADO', 'GUEST') DEFAULT 'EMPLEADO',
    activo BOOLEAN DEFAULT TRUE,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_rol_nivel (nivel_acceso),
    INDEX idx_rol_activo (activo)
);

-- Tabla: Usuarios del sistema
CREATE TABLE usuarios (
    id INT PRIMARY KEY AUTO_INCREMENT,
    organizacion_id INT NOT NULL,
    departamento_id INT,
    rol_id INT NOT NULL,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    apellidos VARCHAR(100),
    telefono VARCHAR(20),
    avatar_url VARCHAR(255),
    ultimo_acceso TIMESTAMP NULL,
    activo BOOLEAN DEFAULT TRUE,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_usuario_username (username),
    INDEX idx_usuario_email (email),
    INDEX idx_usuario_organizacion (organizacion_id),
    INDEX idx_usuario_rol (rol_id),
    INDEX idx_usuario_activo (activo),
    
    FOREIGN KEY (organizacion_id) REFERENCES organizaciones(id),
    FOREIGN KEY (departamento_id) REFERENCES departamentos(id),
    FOREIGN KEY (rol_id) REFERENCES roles(id)
);

-- Vincular responsables de departamentos con usuarios existentes
ALTER TABLE departamentos
    ADD CONSTRAINT fk_departamento_responsable_usuario
    FOREIGN KEY (responsable_id) REFERENCES usuarios(id)
    ON DELETE SET NULL;

-- Tabla: Turnos de trabajo
CREATE TABLE turnos (
    id INT PRIMARY KEY AUTO_INCREMENT,
    nombre VARCHAR(50) NOT NULL,
    hora_inicio TIME NOT NULL,
    hora_fin TIME NOT NULL,
    descripcion TEXT,
    activo BOOLEAN DEFAULT TRUE,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_turno_activo (activo)
);

-- ====================================================================
-- MÓDULO ALOJAMIENTOS - COMPLEJOS, UNIDADES Y RECURSOS
-- ====================================================================

-- Tabla: Tipos de Viviendas (Maestro)
CREATE TABLE tipos_viviendas (
    id INT PRIMARY KEY AUTO_INCREMENT,
    nombre VARCHAR(50) NOT NULL UNIQUE,
    descripcion TEXT,
    activo BOOLEAN DEFAULT TRUE,
    
    INDEX idx_tipo_vivienda_activo (activo)
);

-- Tabla: Tipos de Unidades (Maestro)
CREATE TABLE tipos_unidades (
    id INT PRIMARY KEY AUTO_INCREMENT,
    nombre VARCHAR(50) NOT NULL UNIQUE,
    descripcion TEXT,
    capacidad_maxima INT DEFAULT 1,
    activo BOOLEAN DEFAULT TRUE,
    
    INDEX idx_tipo_unidad_activo (activo)
);

-- Tabla: Complejos Hoteleros
CREATE TABLE complejos (
    id INT PRIMARY KEY AUTO_INCREMENT,
    organizacion_id INT NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    direccion TEXT,
    ciudad VARCHAR(100),
    pais VARCHAR(100),
    codigo_postal VARCHAR(20),
    telefono VARCHAR(20),
    email VARCHAR(100),
    coordenadas_gps POINT,
    numero_estrellas TINYINT DEFAULT 0,
    check_in_hora TIME DEFAULT '15:00:00',
    check_out_hora TIME DEFAULT '11:00:00',
    configuracion JSON, -- Configuraciones específicas del complejo
    activo BOOLEAN DEFAULT TRUE,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_complejo_organizacion (organizacion_id),
    INDEX idx_complejo_ciudad (ciudad),
    INDEX idx_complejo_activo (activo),
    
    FOREIGN KEY (organizacion_id) REFERENCES organizaciones(id)
);

-- Tabla: Unidades de Alojamiento
CREATE TABLE unidades (
    id INT PRIMARY KEY AUTO_INCREMENT,
    complejo_id INT NOT NULL,
    tipo_vivienda_id INT NOT NULL,
    tipo_unidad_id INT NOT NULL,
    numero_unidad VARCHAR(20) NOT NULL,
    piso VARCHAR(10),
    descripcion TEXT,
    capacidad_maxima INT NOT NULL DEFAULT 1,
    metros_cuadrados DECIMAL(6,2),
    precio_base DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    estado ENUM('DISPONIBLE', 'OCUPADA', 'MANTENIMIENTO', 'FUERA_SERVICIO') DEFAULT 'DISPONIBLE',
    caracteristicas JSON, -- WiFi, AC, TV, etc.
    notas_internas TEXT,
    activo BOOLEAN DEFAULT TRUE,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY uk_unidad_complejo (complejo_id, numero_unidad),
    INDEX idx_unidad_complejo (complejo_id),
    INDEX idx_unidad_tipo_vivienda (tipo_vivienda_id),
    INDEX idx_unidad_tipo_unidad (tipo_unidad_id),
    INDEX idx_unidad_estado (estado),
    INDEX idx_unidad_activo (activo),
    
    FOREIGN KEY (complejo_id) REFERENCES complejos(id),
    FOREIGN KEY (tipo_vivienda_id) REFERENCES tipos_viviendas(id),
    FOREIGN KEY (tipo_unidad_id) REFERENCES tipos_unidades(id)
);

-- Tabla: Recursos y Servicios
CREATE TABLE recursos (
    id INT PRIMARY KEY AUTO_INCREMENT,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    tipo ENUM('SERVICIO', 'EQUIPAMIENTO', 'AMENIDAD') DEFAULT 'EQUIPAMIENTO',
    activo BOOLEAN DEFAULT TRUE,
    
    INDEX idx_recurso_tipo (tipo),
    INDEX idx_recurso_activo (activo)
);

-- Tabla: Recursos por Unidad (Relación N:M)
CREATE TABLE unidad_recursos (
    id INT PRIMARY KEY AUTO_INCREMENT,
    unidad_id INT NOT NULL,
    recurso_id INT NOT NULL,
    cantidad INT DEFAULT 1,
    notas TEXT,
    
    UNIQUE KEY uk_unidad_recurso (unidad_id, recurso_id),
    INDEX idx_unidad_recurso_unidad (unidad_id),
    INDEX idx_unidad_recurso_recurso (recurso_id),
    
    FOREIGN KEY (unidad_id) REFERENCES unidades(id) ON DELETE CASCADE,
    FOREIGN KEY (recurso_id) REFERENCES recursos(id)
);

-- ====================================================================
-- MÓDULO OCUPACIÓN - RESERVAS, HUÉSPEDES E INSPECCIONES
-- ====================================================================

-- Tabla: Huéspedes/Clientes
CREATE TABLE huespedes (
    id INT PRIMARY KEY AUTO_INCREMENT,
    tipo_documento ENUM('DNI', 'PASAPORTE', 'CEDULA', 'OTRO') DEFAULT 'DNI',
    numero_documento VARCHAR(50) NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    apellidos VARCHAR(100),
    email VARCHAR(100),
    telefono VARCHAR(20),
    fecha_nacimiento DATE,
    nacionalidad VARCHAR(50),
    direccion TEXT,
    ciudad VARCHAR(100),
    codigo_postal VARCHAR(20),
    observaciones TEXT,
    vip BOOLEAN DEFAULT FALSE,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY uk_huesped_documento (tipo_documento, numero_documento),
    INDEX idx_huesped_email (email),
    INDEX idx_huesped_telefono (telefono),
    INDEX idx_huesped_vip (vip),
    INDEX idx_huesped_nombre (nombre, apellidos)
);

-- Tabla: Reservas
CREATE TABLE reservas (
    id INT PRIMARY KEY AUTO_INCREMENT,
    complejo_id INT NOT NULL,
    unidad_id INT NOT NULL,
    huesped_principal_id INT NOT NULL,
    numero_reserva VARCHAR(50) NOT NULL UNIQUE,
    fecha_checkin DATE NOT NULL,
    fecha_checkout DATE NOT NULL,
    hora_checkin TIME,
    hora_checkout TIME,
    numero_huespedes INT NOT NULL DEFAULT 1,
    numero_adultos INT NOT NULL DEFAULT 1,
    numero_ninos INT DEFAULT 0,
    precio_total DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    precio_por_noche DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    estado ENUM('PENDIENTE', 'CONFIRMADA', 'CHECK_IN', 'CHECK_OUT', 'CANCELADA', 'NO_SHOW') DEFAULT 'PENDIENTE',
    canal_reserva ENUM('DIRECTO', 'BOOKING', 'AIRBNB', 'EXPEDIA', 'AGENCIA', 'OTRO') DEFAULT 'DIRECTO',
    observaciones TEXT,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_reserva_complejo (complejo_id),
    INDEX idx_reserva_unidad (unidad_id),
    INDEX idx_reserva_huesped (huesped_principal_id),
    INDEX idx_reserva_numero (numero_reserva),
    INDEX idx_reserva_fechas (fecha_checkin, fecha_checkout),
    INDEX idx_reserva_estado (estado),
    INDEX idx_reserva_canal (canal_reserva),
    
    FOREIGN KEY (complejo_id) REFERENCES complejos(id),
    FOREIGN KEY (unidad_id) REFERENCES unidades(id),
    FOREIGN KEY (huesped_principal_id) REFERENCES huespedes(id)
);

-- Tabla: Huéspedes por Reserva (Para múltiples huéspedes)
CREATE TABLE reserva_huespedes (
    id INT PRIMARY KEY AUTO_INCREMENT,
    reserva_id INT NOT NULL,
    huesped_id INT NOT NULL,
    es_principal BOOLEAN DEFAULT FALSE,
    
    UNIQUE KEY uk_reserva_huesped (reserva_id, huesped_id),
    INDEX idx_reserva_huesped_reserva (reserva_id),
    INDEX idx_reserva_huesped_huesped (huesped_id),
    
    FOREIGN KEY (reserva_id) REFERENCES reservas(id) ON DELETE CASCADE,
    FOREIGN KEY (huesped_id) REFERENCES huespedes(id)
);

-- Tabla: Histórico de Ocupación
CREATE TABLE historico_ocupacion (
    id INT PRIMARY KEY AUTO_INCREMENT,
    reserva_id INT NOT NULL,
    unidad_id INT NOT NULL,
    fecha DATE NOT NULL,
    estado_ocupacion ENUM('OCUPADA', 'DISPONIBLE', 'MANTENIMIENTO', 'BLOQUEADA') NOT NULL,
    precio_noche DECIMAL(10,2) DEFAULT 0.00,
    observaciones TEXT,
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE KEY uk_historico_unidad_fecha (unidad_id, fecha),
    INDEX idx_historico_reserva (reserva_id),
    INDEX idx_historico_fecha (fecha),
    INDEX idx_historico_estado (estado_ocupacion),
    
    FOREIGN KEY (reserva_id) REFERENCES reservas(id),
    FOREIGN KEY (unidad_id) REFERENCES unidades(id)
);

-- Tabla: Tipos de Novedades (Maestro)
CREATE TABLE tipos_novedades (
    id INT PRIMARY KEY AUTO_INCREMENT,
    nombre VARCHAR(50) NOT NULL UNIQUE,
    descripcion TEXT,
    prioridad ENUM('BAJA', 'MEDIA', 'ALTA', 'CRITICA') DEFAULT 'MEDIA',
    color_hex VARCHAR(7) DEFAULT '#6c757d',
    activo BOOLEAN DEFAULT TRUE,
    
    INDEX idx_tipo_novedad_prioridad (prioridad),
    INDEX idx_tipo_novedad_activo (activo)
);

-- Tabla: Novedades y Incidencias
CREATE TABLE novedades (
    id INT PRIMARY KEY AUTO_INCREMENT,
    unidad_id INT NOT NULL,
    tipo_novedad_id INT NOT NULL,
    usuario_reporta_id INT NOT NULL,
    usuario_asignado_id INT,
    titulo VARCHAR(200) NOT NULL,
    descripcion TEXT NOT NULL,
    prioridad ENUM('BAJA', 'MEDIA', 'ALTA', 'CRITICA') DEFAULT 'MEDIA',
    estado ENUM('ABIERTA', 'EN_PROGRESO', 'PENDIENTE_REVISION', 'CERRADA') DEFAULT 'ABIERTA',
    fecha_reporte TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_vencimiento DATETIME,
    fecha_resolucion TIMESTAMP NULL,
    solucion TEXT,
    costo_estimado DECIMAL(10,2) DEFAULT 0.00,
    
    INDEX idx_novedad_unidad (unidad_id),
    INDEX idx_novedad_tipo (tipo_novedad_id),
    INDEX idx_novedad_reporta (usuario_reporta_id),
    INDEX idx_novedad_asignado (usuario_asignado_id),
    INDEX idx_novedad_estado (estado),
    INDEX idx_novedad_prioridad (prioridad),
    INDEX idx_novedad_fecha_reporte (fecha_reporte),
    
    FOREIGN KEY (unidad_id) REFERENCES unidades(id),
    FOREIGN KEY (tipo_novedad_id) REFERENCES tipos_novedades(id),
    FOREIGN KEY (usuario_reporta_id) REFERENCES usuarios(id),
    FOREIGN KEY (usuario_asignado_id) REFERENCES usuarios(id)
);

-- Tabla: Inspecciones de Unidades
CREATE TABLE inspecciones (
    id INT PRIMARY KEY AUTO_INCREMENT,
    unidad_id INT NOT NULL,
    usuario_id INT NOT NULL,
    tipo_inspeccion ENUM('CHECK_IN', 'CHECK_OUT', 'MANTENIMIENTO', 'RUTINARIA') NOT NULL,
    estado ENUM('PENDIENTE', 'EN_PROGRESO', 'COMPLETADA', 'RECHAZADA') DEFAULT 'PENDIENTE',
    fecha_programada DATETIME NOT NULL,
    fecha_inicio TIMESTAMP NULL,
    fecha_completada TIMESTAMP NULL,
    calificacion TINYINT, -- 1-5
    observaciones TEXT,
    checklist JSON, -- Lista de verificación en formato JSON
    fotos JSON, -- URLs de fotos de la inspección
    
    INDEX idx_inspeccion_unidad (unidad_id),
    INDEX idx_inspeccion_usuario (usuario_id),
    INDEX idx_inspeccion_tipo (tipo_inspeccion),
    INDEX idx_inspeccion_estado (estado),
    INDEX idx_inspeccion_fecha_programada (fecha_programada),
    
    FOREIGN KEY (unidad_id) REFERENCES unidades(id),
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);

-- ====================================================================
-- MÓDULO COLABORADORES - PERSONAL Y TURNOS
-- ====================================================================

-- Tabla: Tipos de Colaborador (Maestro)
CREATE TABLE tipos_colaborador (
    id INT PRIMARY KEY AUTO_INCREMENT,
    nombre VARCHAR(50) NOT NULL UNIQUE,
    descripcion TEXT,
    activo BOOLEAN DEFAULT TRUE,
    
    INDEX idx_tipo_colaborador_activo (activo)
);

-- Tabla: Cargos
CREATE TABLE cargos (
    id INT PRIMARY KEY AUTO_INCREMENT,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    departamento_id INT,
    salario_base DECIMAL(10,2) DEFAULT 0.00,
    activo BOOLEAN DEFAULT TRUE,
    
    INDEX idx_cargo_departamento (departamento_id),
    INDEX idx_cargo_activo (activo),
    
    FOREIGN KEY (departamento_id) REFERENCES departamentos(id)
);

-- Tabla: Colaboradores
CREATE TABLE colaboradores (
    id INT PRIMARY KEY AUTO_INCREMENT,
    organizacion_id INT NOT NULL,
    tipo_colaborador_id INT NOT NULL,
    cargo_id INT NOT NULL,
    usuario_id INT UNIQUE,
    numero_empleado VARCHAR(20) UNIQUE,
    tipo_documento ENUM('DNI', 'PASAPORTE', 'CEDULA', 'OTRO') DEFAULT 'DNI',
    numero_documento VARCHAR(50) NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    apellidos VARCHAR(100),
    email VARCHAR(100),
    telefono VARCHAR(20),
    fecha_nacimiento DATE,
    fecha_ingreso DATE NOT NULL,
    fecha_salida DATE NULL,
    direccion TEXT,
    salario_actual DECIMAL(10,2) DEFAULT 0.00,
    estado ENUM('ACTIVO', 'INACTIVO', 'VACACIONES', 'LICENCIA', 'DESPEDIDO') DEFAULT 'ACTIVO',
    observaciones TEXT,
    foto_url VARCHAR(255),
    contacto_emergencia JSON, -- Nombre, teléfono, relación
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY uk_colaborador_documento (tipo_documento, numero_documento),
    INDEX idx_colaborador_organizacion (organizacion_id),
    INDEX idx_colaborador_tipo (tipo_colaborador_id),
    INDEX idx_colaborador_cargo (cargo_id),
    INDEX idx_colaborador_numero (numero_empleado),
    INDEX idx_colaborador_estado (estado),
    INDEX idx_colaborador_nombre (nombre, apellidos),
    
    FOREIGN KEY (organizacion_id) REFERENCES organizaciones(id),
    FOREIGN KEY (tipo_colaborador_id) REFERENCES tipos_colaborador(id),
    FOREIGN KEY (cargo_id) REFERENCES cargos(id),
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
);

-- Tabla: Asignación de Turnos
CREATE TABLE colaborador_turnos (
    id INT PRIMARY KEY AUTO_INCREMENT,
    colaborador_id INT NOT NULL,
    turno_id INT NOT NULL,
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE,
    dias_semana JSON, -- [1,2,3,4,5] para Lun-Vie
    activo BOOLEAN DEFAULT TRUE,
    
    INDEX idx_colaborador_turno_colaborador (colaborador_id),
    INDEX idx_colaborador_turno_turno (turno_id),
    INDEX idx_colaborador_turno_fechas (fecha_inicio, fecha_fin),
    INDEX idx_colaborador_turno_activo (activo),
    
    FOREIGN KEY (colaborador_id) REFERENCES colaboradores(id) ON DELETE CASCADE,
    FOREIGN KEY (turno_id) REFERENCES turnos(id)
);

-- ====================================================================
-- TABLAS ADICIONALES PARA REPORTES Y CONFIGURACIÓN
-- ====================================================================

-- Tabla: Configuración del Sistema
CREATE TABLE configuracion_sistema (
    id INT PRIMARY KEY AUTO_INCREMENT,
    clave VARCHAR(100) NOT NULL UNIQUE,
    valor TEXT,
    descripcion TEXT,
    tipo ENUM('STRING', 'NUMBER', 'BOOLEAN', 'JSON') DEFAULT 'STRING',
    categoria VARCHAR(50) DEFAULT 'GENERAL',
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_config_categoria (categoria),
    INDEX idx_config_clave (clave)
);

-- Tabla: Log de Auditoría
CREATE TABLE auditoria (
    id INT PRIMARY KEY AUTO_INCREMENT,
    usuario_id INT,
    tabla VARCHAR(50) NOT NULL,
    registro_id INT NOT NULL,
    accion ENUM('INSERT', 'UPDATE', 'DELETE') NOT NULL,
    datos_anteriores JSON,
    datos_nuevos JSON,
    ip_address VARCHAR(45),
    user_agent TEXT,
    fecha_accion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_auditoria_usuario (usuario_id),
    INDEX idx_auditoria_tabla (tabla),
    INDEX idx_auditoria_fecha (fecha_accion),
    INDEX idx_auditoria_accion (accion),
    
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);

-- ====================================================================
-- VISTAS PARA REPORTES Y DASHBOARD
-- ====================================================================

-- Vista: Ocupación Actual por Complejo
CREATE VIEW vista_ocupacion_actual AS
SELECT 
    c.id as complejo_id,
    c.nombre as complejo_nombre,
    COUNT(u.id) as total_unidades,
    COUNT(CASE WHEN u.estado = 'OCUPADA' THEN 1 END) as unidades_ocupadas,
    COUNT(CASE WHEN u.estado = 'DISPONIBLE' THEN 1 END) as unidades_disponibles,
    COUNT(CASE WHEN u.estado = 'MANTENIMIENTO' THEN 1 END) as unidades_mantenimiento,
    ROUND((COUNT(CASE WHEN u.estado = 'OCUPADA' THEN 1 END) * 100.0 / COUNT(u.id)), 2) as porcentaje_ocupacion
FROM complejos c
LEFT JOIN unidades u ON c.id = u.complejo_id AND u.activo = TRUE
WHERE c.activo = TRUE
GROUP BY c.id, c.nombre;

-- Vista: Reservas del Día
CREATE VIEW vista_reservas_hoy AS
SELECT 
    r.id,
    r.numero_reserva,
    c.nombre as complejo_nombre,
    u.numero_unidad,
    h.nombre as huesped_nombre,
    h.apellidos as huesped_apellidos,
    r.fecha_checkin,
    r.fecha_checkout,
    r.estado,
    r.numero_huespedes,
    'CHECK_IN' as tipo_movimiento
FROM reservas r
JOIN complejos c ON r.complejo_id = c.id
JOIN unidades u ON r.unidad_id = u.id
JOIN huespedes h ON r.huesped_principal_id = h.id
WHERE r.fecha_checkin = CURDATE() AND r.estado IN ('CONFIRMADA', 'CHECK_IN')

UNION ALL

SELECT 
    r.id,
    r.numero_reserva,
    c.nombre as complejo_nombre,
    u.numero_unidad,
    h.nombre as huesped_nombre,
    h.apellidos as huesped_apellidos,
    r.fecha_checkin,
    r.fecha_checkout,
    r.estado,
    r.numero_huespedes,
    'CHECK_OUT' as tipo_movimiento
FROM reservas r
JOIN complejos c ON r.complejo_id = c.id
JOIN unidades u ON r.unidad_id = u.id
JOIN huespedes h ON r.huesped_principal_id = h.id
WHERE r.fecha_checkout = CURDATE() AND r.estado = 'CHECK_IN';

-- Vista: Novedades Pendientes
CREATE VIEW vista_novedades_pendientes AS
SELECT 
    n.id,
    c.nombre as complejo_nombre,
    u.numero_unidad,
    tn.nombre as tipo_novedad,
    n.titulo,
    n.prioridad,
    n.estado,
    n.fecha_reporte,
    n.fecha_vencimiento,
    ur.nombre as usuario_reporta,
    ua.nombre as usuario_asignado,
    CASE 
        WHEN n.fecha_vencimiento < NOW() THEN 'VENCIDA'
        WHEN n.fecha_vencimiento < DATE_ADD(NOW(), INTERVAL 24 HOUR) THEN 'PROXIMA_VENCER'
        ELSE 'EN_TIEMPO'
    END as estado_vencimiento
FROM novedades n
JOIN unidades u ON n.unidad_id = u.id
JOIN complejos c ON u.complejo_id = c.id
JOIN tipos_novedades tn ON n.tipo_novedad_id = tn.id
JOIN usuarios ur ON n.usuario_reporta_id = ur.id
LEFT JOIN usuarios ua ON n.usuario_asignado_id = ua.id
WHERE n.estado IN ('ABIERTA', 'EN_PROGRESO', 'PENDIENTE_REVISION');

-- ====================================================================
-- DATOS INICIALES
-- ====================================================================

-- Insertar roles básicos
INSERT INTO roles (nombre, descripcion, nivel_acceso, permisos) VALUES
('Super Administrador', 'Acceso completo al sistema', 'SUPER_ADMIN', '["*"]'),
('Administrador', 'Administrador de complejo', 'ADMIN', '["dashboard", "reservas", "huespedes", "unidades", "colaboradores", "reportes"]'),
('Gerente', 'Gerente operacional', 'MANAGER', '["dashboard", "reservas", "huespedes", "unidades", "inspecciones"]'),
('Recepcionista', 'Personal de recepción', 'EMPLEADO', '["dashboard", "reservas", "huespedes", "checkin", "checkout"]'),
('Mantenimiento', 'Personal de mantenimiento', 'EMPLEADO', '["dashboard", "unidades", "novedades", "inspecciones"]'),
('Limpieza', 'Personal de limpieza', 'EMPLEADO', '["dashboard", "unidades", "inspecciones"]');

-- Insertar turnos básicos
INSERT INTO turnos (nombre, hora_inicio, hora_fin, descripcion) VALUES
('Mañana', '07:00:00', '15:00:00', 'Turno matutino'),
('Tarde', '15:00:00', '23:00:00', 'Turno vespertino'),
('Noche', '23:00:00', '07:00:00', 'Turno nocturno'),
('Completo', '08:00:00', '17:00:00', 'Jornada completa diurna');

-- Insertar tipos de viviendas
INSERT INTO tipos_viviendas (nombre, descripcion) VALUES
('Apartamento', 'Unidad de alojamiento independiente'),
('Suite', 'Habitación de lujo con servicios premium'),
('Estudio', 'Espacio compacto con cocina integrada'),
('Penthouse', 'Apartamento de lujo en último piso'),
('Villa', 'Casa independiente con jardín');

-- Insertar tipos de unidades
INSERT INTO tipos_unidades (nombre, descripcion, capacidad_maxima) VALUES
('Individual', 'Para una persona', 1),
('Doble', 'Para dos personas', 2),
('Triple', 'Para tres personas', 3),
('Cuádruple', 'Para cuatro personas', 4),
('Familiar', 'Para familias grandes', 6),
('Grupo', 'Para grupos', 8);

-- Insertar tipos de colaboradores
INSERT INTO tipos_colaborador (nombre, descripcion) VALUES
('Administrativo', 'Personal administrativo y de oficina'),
('Operativo', 'Personal operativo y de servicio'),
('Mantenimiento', 'Personal de mantenimiento y reparaciones'),
('Seguridad', 'Personal de seguridad'),
('Limpieza', 'Personal de limpieza'),
('Gerencial', 'Personal gerencial y directivo');

-- Insertar tipos de novedades
INSERT INTO tipos_novedades (nombre, descripcion, prioridad, color_hex) VALUES
('Mantenimiento', 'Problemas de mantenimiento general', 'MEDIA', '#ffc107'),
('Limpieza', 'Problemas de limpieza', 'BAJA', '#28a745'),
('Electricidad', 'Problemas eléctricos', 'ALTA', '#dc3545'),
('Plomería', 'Problemas de fontanería', 'ALTA', '#007bff'),
('Climatización', 'Problemas de aire acondicionado/calefacción', 'MEDIA', '#6f42c1'),
('Seguridad', 'Problemas de seguridad', 'CRITICA', '#fd7e14'),
('Mobiliario', 'Problemas con muebles y equipamiento', 'BAJA', '#20c997'),
('Tecnología', 'Problemas con TV, WiFi, etc.', 'MEDIA', '#6c757d');

-- Insertar recursos básicos
INSERT INTO recursos (nombre, descripcion, tipo) VALUES
('WiFi', 'Acceso a internet inalámbrico', 'SERVICIO'),
('Aire Acondicionado', 'Sistema de climatización', 'EQUIPAMIENTO'),
('Televisión', 'Televisor con canales por cable', 'EQUIPAMIENTO'),
('Cocina', 'Cocina equipada', 'EQUIPAMIENTO'),
('Refrigerador', 'Nevera/Frigorífico', 'EQUIPAMIENTO'),
('Microondas', 'Horno microondas', 'EQUIPAMIENTO'),
('Lavadora', 'Máquina lavadora', 'EQUIPAMIENTO'),
('Balcón', 'Balcón o terraza', 'AMENIDAD'),
('Piscina', 'Acceso a piscina', 'AMENIDAD'),
('Gimnasio', 'Acceso a gimnasio', 'AMENIDAD'),
('Estacionamiento', 'Plaza de aparcamiento', 'SERVICIO'),
('Servicio Limpieza', 'Servicio de limpieza diario', 'SERVICIO');

-- Insertar configuración inicial del sistema
INSERT INTO configuracion_sistema (clave, valor, descripcion, tipo, categoria) VALUES
('app_name', 'PMS Hotel Management', 'Nombre de la aplicación', 'STRING', 'GENERAL'),
('check_in_time', '15:00', 'Hora estándar de check-in', 'STRING', 'OPERACIONES'),
('check_out_time', '11:00', 'Hora estándar de check-out', 'STRING', 'OPERACIONES'),
('currency', 'EUR', 'Moneda por defecto', 'STRING', 'FINANCIERO'),
('tax_rate', '10', 'Tasa de impuestos por defecto (%)', 'NUMBER', 'FINANCIERO'),
('max_advance_booking', '365', 'Días máximos de reserva anticipada', 'NUMBER', 'RESERVAS'),
('min_advance_booking', '1', 'Días mínimos de reserva anticipada', 'NUMBER', 'RESERVAS'),
('dashboard_refresh_interval', '30', 'Intervalo de actualización del dashboard (segundos)', 'NUMBER', 'DASHBOARD');

-- Activar las restricciones de clave foránea
SET foreign_key_checks = 1;

-- ====================================================================
-- COMENTARIOS FINALES
-- ====================================================================
-- Este esquema proporciona:
-- 1. Estructura modular completa según los requisitos
-- 2. Índices optimizados para consultas frecuentes
-- 3. Relaciones integrales entre todas las entidades
-- 4. Vistas preparadas para el dashboard dinámico
-- 5. Datos iniciales para comenzar a operar
-- 6. Campos JSON para flexibilidad futura
-- 7. Sistema de auditoría completo
-- 8. Configuración centralizada del sistema
-- ====================================================================