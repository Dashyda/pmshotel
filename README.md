# Sistema de Gestión de Propiedades (PMS) 🏨

Un sistema modular completo para la gestión de propiedades hoteleras con dashboard dinámico y base de datos relacional optimizada.

## 🚀 Características Principales

### 🏗️ Arquitectura Modular
- **Backend**: API REST con Node.js y Express
- **Frontend**: Dashboard interactivo con React
- **Base de Datos**: Sistema relacional con MySQL/PostgreSQL
- **Tiempo Real**: Actualizaciones dinámicas de KPIs

### 📊 Módulos del Sistema

#### 1. **Administrador** 👤
- Gestión de usuarios y roles
- Control de permisos
- Configuración de organización
- Gestión de departamentos y turnos

#### 2. **Alojamientos** 🏠
- Gestión de complejos hoteleros
- Administración de unidades
- Tipos de alojamientos y recursos
- Inventario dinámico

#### 3. **Ocupación** 📅
- Check-In / Check-Out automatizado
- Gestión de reservas
- Historial de ocupación
- Inspecciones y novedades

#### 4. **Colaboradores** 👥
- Gestión de personal
- Control de turnos y horarios
- Tipos de colaboradores y cargos
- Reportes de personal

### 📈 Dashboard Dinámico

#### KPIs en Tiempo Real:
- **% Ocupación Actual** (Hoy y Semana)
- **Llegadas/Salidas del Día**
- **Ingresos Proyectados**
- **ADR (Tarifa Promedio Diaria)**
- **Unidades Pendientes de Inspección**
- **Novedades Abiertas**
- **Disponibilidad por Tipo de Unidad**

#### Características Interactivas:
- ✅ Gráficos clicables con drill-down
- ✅ Widgets personalizables
- ✅ Actualización casi en tiempo real
- ✅ Navegación contextual a módulos

## 🗄️ Base de Datos

### Estructura Principal:
```
📁 Administrador
├── Usuarios
├── Roles  
├── Organización
├── Departamentos
└── Turnos

📁 Alojamientos  
├── Complejos
├── Unidades
├── TiposUnidades
├── TiposViviendas
└── Recursos

📁 Ocupación
├── Reservas
├── Huéspedes
├── HistóricoOcupacion
├── Novedades
└── Inspecciones

📁 Colaboradores
├── Colaboradores
├── TiposColaborador
└── Cargos
```

### Optimizaciones:
- ✅ Normalización estricta
- ✅ Índices optimizados
- ✅ Tablas maestras para referencias
- ✅ Integridad referencial

## 🛠️ Tecnologías

### Backend:
- **Node.js** + **Express.js**
- **MySQL/PostgreSQL**
- **JWT** para autenticación
- **Socket.io** para tiempo real

### Frontend:
- **React** + **TypeScript**
- **Chart.js** para gráficos
- **Material-UI** para interfaz
- **Axios** para API calls

## 📁 Estructura del Proyecto

```
pms-system/
├── backend/
│   ├── src/
│   │   ├── controllers/
│   │   ├── models/
│   │   ├── routes/
│   │   ├── middleware/
│   │   └── app.js
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── modules/
│   │   ├── services/
│   │   └── App.js
│   └── package.json
├── database/
│   ├── schemas/
│   └── scripts/
└── README.md
```

## 🚀 Instalación y Uso

### 1. Backend:
```bash
cd backend
npm install
npm run dev
```

### 2. Frontend:
```bash
cd frontend
npm install
npm start
```

### 3. Base de Datos:
```bash
# Ejecutar scripts de la carpeta database/scripts/
mysql -u usuario -p < database/scripts/create_tables.sql
```

### 🔑 Credenciales de Demo

- **Super administrador:** `admin@pms.com` / `admin123`
- **Costa Dorada Premium (rol administrador):** `admin` / `moonpalace`

## 🔐 Autenticación y Seguridad

- **JWT Tokens** para sesiones seguras
- **Control de Roles** granular
- **Middleware de Autorización**
- **Validación de Datos** en todas las capas

## 📊 Reportes y Análisis

- Reportes financieros automatizados
- Análisis de ocupación histórica  
- Métricas de rendimiento del personal
- Exportación a Excel/PDF

---

**Desarrollado con ❤️ para la gestión hotelera moderna**