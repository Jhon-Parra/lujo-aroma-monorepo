const axios = require('axios');
const bcrypt = require('bcrypt');
const mysql = require('mysql2/promise');

async function test() {
    // 1. Log in to get token
    const loginRes = await axios.post('http://localhost:3000/api/auth/login', {
        email: 'admin@perfumissimo.com',
        password: 'Admin123$'
    });
    const token = loginRes.data.token;
    console.log("Token obtained");

    // 2. Get users
    const usersRes = await axios.get('http://localhost:3000/api/users', {
        headers: { Authorization: `Bearer ${token}` }
    });
    console.log("Users:", usersRes.data);

    // 3. Update a user
    const targetUserId = usersRes.data.find(u => u.email !== 'admin@perfumissimo.com').id;
    console.log("Trying to update user:", targetUserId);

    try {
        const updateRes = await axios.put(`http://localhost:3000/api/users/${targetUserId}/role`, {
            rol: 'VENTAS'
        }, {
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log("Update response:", updateRes.data);
    } catch (e) {
        console.log("Update Error:", e.response ? e.response.data : e.message);
    }
}
test();
