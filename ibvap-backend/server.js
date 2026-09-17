const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { Pool } = require('pg'); // Replaced sqlite3 with pg
const cors = require('cors');
const rateLimit = require('express-rate-limit');
require('dotenv').config(); // Ensure dotenv is installed for local testing

// 1. SETUP & INITIALIZATION
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" }
});

app.use(cors());
app.use(express.json({ limit: '50mb' })); 
app.use(express.static('public'));

// 2. DATABASE SETUP (PostgreSQL)
// This connects to the Render DB using the environment variable
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false // Required for Render and other cloud databases
    }
});

// Auto-create table on startup if it doesn't exist
pool.connect((err, client, release) => {
    if (err) {
        return console.error('❌ Database connection error:', err.stack);
    }
    console.log('✅ Connected to PostgreSQL database.');
    
    // PostgreSQL uses SERIAL instead of AUTOINCREMENT
    const createTableQuery = `
        CREATE TABLE IF NOT EXISTS incidents (
            id SERIAL PRIMARY KEY,
            object_type TEXT,
            zone_type TEXT,
            risk_level TEXT,
            confidence REAL,
            explanation TEXT,
            image_data TEXT, 
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    `;

    client.query(createTableQuery, (err, res) => {
        if (err) {
            console.error('❌ Error creating incidents table:', err.stack);
        } else {
            console.log('✅ "incidents" Table is ready to use!');
        }
        release(); 
    });
});

// 3. CYBERSECURITY MVP (Zero-Trust Lockdown)
const securityLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, 
    max: 50, 
    handler: (req, res) => {
        console.warn(`🚨 THREAT DETECTED: Brute Force Attempt from IP: ${req.ip}`);
        io.emit('system_lockdown', { message: 'BRUTE FORCE DETECTED - ZERO-TRUST LOCKDOWN INITIATED' });
        res.status(429).json({ error: "System Isolated." });
        
        setTimeout(() => {
            console.error("🔒 Server Locked Down. Exiting process.");
            process.exit(1); 
        }, 3000);
    }
});

app.use('/api/', securityLimiter);

// 4. API ROUTES (Incident Logging)
app.post('/api/events', async (req, res) => {
    const { object_type, zone_type, risk_level, confidence, explanation, snapshot } = req.body;
    
    // PostgreSQL syntax for inserting and returning the generated ID
    const sql = `
        INSERT INTO incidents (object_type, zone_type, risk_level, confidence, explanation, image_data) 
        VALUES ($1, $2, $3, $4, $5, $6) RETURNING id;
    `;
    
    try {
        const result = await pool.query(sql, [object_type, zone_type, risk_level, confidence, explanation, snapshot]);
        const newId = result.rows[0].id;
        
        console.log(`🚨 Incident with EVIDENCE logged! ID: ${newId}`);
        
        const newIncident = { 
            id: newId, 
            object_type, 
            zone_type, 
            risk_level, 
            confidence, 
            explanation, 
            image_data: snapshot, 
            timestamp: new Date() 
        };
        io.emit('new_alert', newIncident);
        
        res.status(200).json({ success: true, id: newId });
    } catch (err) {
        console.error("DB Insert Error:", err.message);
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/incidents', async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM incidents ORDER BY timestamp DESC");
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/incidents', async (req, res) => {
    try {
        // In PostgreSQL, TRUNCATE is the fastest way to clear a table and reset the identity sequence
        await pool.query("TRUNCATE TABLE incidents RESTART IDENTITY");
        
        console.log("🧹 Database cleared! System reset for demo.");
        io.emit('clear_ui'); 
        
        res.status(200).json({ success: true, message: "All history cleared." });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 5. WEBSOCKETS (Real-Time Comm)
io.on('connection', (socket) => {
    console.log(`🟢 New Client Connected: ${socket.id}`);

    socket.on('new_zone_coordinates', (data) => {
        socket.broadcast.emit('new_zone_coordinates', data);
    });

    socket.on('change_camera_source', (data) => {
        socket.broadcast.emit('change_camera_source', data);
    });

    socket.on('send_frame', (frame) => {
        socket.broadcast.emit('receive_frame', frame);
    });

    socket.on('disconnect', () => {
        console.log(`🔴 Client Disconnected: ${socket.id}`);
    });
});

// 6. START SERVER
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 IBVAP Command Center running on port ${PORT}`);
    console.log(`🛡️  Zero-Trust Security Engine: ACTIVE`);
});