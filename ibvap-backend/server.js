const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const rateLimit = require('express-rate-limit');


// 1. SETUP & INITIALIZATION

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" }
});

app.use(cors());

app.use(express.json({ limit: '50mb' })); 
app.use(express.static('public'));


// 2. DATABASE SETUP (SQLite)


const db = new sqlite3.Database('./ibvap.db', (err) => {
    if (err) {
        console.error('❌ Database connection error:', err.message);
    } else {
        console.log('✅ Connected to SQLite database.');
        // Table with Evidence (image_data) column
        db.run(`CREATE TABLE IF NOT EXISTS incidents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            object_type TEXT,
            zone_type TEXT,
            risk_level TEXT,
            confidence REAL,
            explanation TEXT,
            image_data TEXT, 
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);
    }
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

app.post('/api/events', (req, res) => {
    const { object_type, zone_type, risk_level, confidence, explanation, snapshot } = req.body;
    
    const sql = `INSERT INTO incidents (object_type, zone_type, risk_level, confidence, explanation, image_data) VALUES (?, ?, ?, ?, ?, ?)`;
    
    db.run(sql, [object_type, zone_type, risk_level, confidence, explanation, snapshot], function(err) {
        if (err) {
            console.error("DB Insert Error:", err.message);
            return res.status(500).json({ error: err.message });
        }
        
        console.log(`🚨 Incident with EVIDENCE logged! ID: ${this.lastID}`);
        
        const newIncident = { 
            id: this.lastID, 
            object_type, 
            zone_type, 
            risk_level, 
            confidence, 
            explanation, 
            image_data: snapshot, 
            timestamp: new Date() 
        };
        io.emit('new_alert', newIncident);
        
        res.status(200).json({ success: true, id: this.lastID });
    });
});

app.get('/api/incidents', (req, res) => {
    db.all("SELECT * FROM incidents ORDER BY timestamp DESC", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});
app.delete('/api/incidents', (req, res) => {
   
    db.run("DELETE FROM incidents", [], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        
        
        db.run("DELETE FROM sqlite_sequence WHERE name='incidents'", [], (err2) => {
            console.log("🧹 Database cleared! System reset for demo.");
            
      
            io.emit('clear_ui'); 
            
            res.status(200).json({ success: true, message: "All history cleared." });
        });
    });
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
    console.log(`🚀 IBVAP Command Center running on http://localhost:${PORT}`);
    console.log(`🛡️  Zero-Trust Security Engine: ACTIVE`);
});