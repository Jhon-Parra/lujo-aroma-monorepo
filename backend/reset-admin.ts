import bcrypt from 'bcrypt';
import mysql from 'mysql2/promise';

const createAdmin = async () => {
    try {
        const connection = await mysql.createConnection({
            host: 'localhost',
            user: 'root',
            password: 'Jh@n52828378',
            database: 'lujo_aroma_db'
        });

        const email = 'admin@lujo_aroma.com';
        const password = 'Admin123$';
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        console.log('Clearing old admin...');
        await connection.query('DELETE FROM Usuarios WHERE email = ?', [email]);

        console.log('Creating new admin...');
        await connection.query(`
            INSERT INTO Usuarios (id, nombre, apellido, email, password_hash, rol) 
            VALUES (UUID_TO_BIN(UUID()), 'Administrador', 'Root', ?, ?, 'ADMIN')
        `, [email, hashedPassword]);

        console.log('✅ Admin user created successfully!');
        console.log(`Email: ${email}`);
        console.log(`Password: ${password}`);

        await connection.end();
    } catch (error) {
        console.error('Error:', error);
    }
};

createAdmin();
