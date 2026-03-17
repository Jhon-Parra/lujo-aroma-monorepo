# Guía de Despliegue - Perfumissimo

Este paquete contiene los archivos necesarios para desplegar la aplicación en Hostinger.

## 1. Frontend (Sitio Web)
1. Entra a tu hPanel de Hostinger.
2. Ve al **Administrador de Archivos** de tu dominio.
3. Entra a la carpeta `public_html`.
4. Sube el contenido del archivo `frontend_deploy.zip` directamente en `public_html`.
   * El archivo `.htaccess` es muy importante para que las rutas de Angular funcionen correctamente.

## 2. Backend (API)
1. En el hPanel, busca la sección de **Node.js**.
2. Crea una nueva aplicación Node.js.
3. Sube el contenido de `backend_deploy.zip` a la carpeta de la aplicación (ej. `/domains/tu-dominio.com/backend`).
4. Configura las variables de entorno en Hostinger basadas en el archivo `.env.example`.
5. Ejecuta `npm install` desde el terminal de Hostinger o el panel de Node.js.
6. Asegúrate de que el puerto coincida con la configuración de Hostinger.

## 3. Base de Datos
1. Si no lo has hecho, importa el archivo `mysql_schema.sql` en tu base de datos MySQL de Hostinger.
2. Actualiza las credenciales DB en las variables de entorno del Backend.
