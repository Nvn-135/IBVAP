
// 1. INITIALIZATION & SOCKET CONNECTION

const socket = io("https://ibvap-1-xmfb.onrender.com");

socket.on('connect', () => {
    console.log('✅ Connected to IBVAP Backend successfully.');
});


// 2. LIVE VIDEO STREAMING LOGIC

const videoFeed = document.getElementById('videoFeed');


socket.on('receive_frame', (frameData) => {
    videoFeed.src = 'data:image/jpeg;base64,' + frameData;
});


// 3. ALERT TIMELINE LOGIC & SQLITE FETCH

let alertCounter = 0;
const alertsContainer = document.getElementById('alertsContainer');
const noAlertsMsg = document.getElementById('noAlerts');
const alertCountBadge = document.getElementById('alertCount');
const criticalBanner = document.getElementById('criticalBanner');
let bannerTimeout;


// Function to render a single alert card on UI
function renderAlertCard(incident) {
    if (noAlertsMsg) noAlertsMsg.style.display = 'none';
    alertCounter++;
    if (alertCountBadge) alertCountBadge.innerText = alertCounter;
    
    const timeString = new Date(incident.timestamp || new Date()).toLocaleTimeString();
    
    //  YAHAN PHOTO DISPLAY KARNE KA HTML CODE HAI

    const evidenceImage = incident.image_data 
        ? `<img src="data:image/jpeg;base64,${incident.image_data}" class="w-full h-32 object-cover rounded mt-2 border border-red-500/50" alt="Evidence Snapshot">` 
        : '';

    const alertHtml = `
        <div class="glass-panel alert-card p-3 bg-red-900/10 border-l-4 border-red-500 mb-2">
            <div class="flex justify-between items-start">
                <span class="text-red-400 font-bold uppercase text-sm">${incident.risk_level} ALERT</span>
                <span class="text-xs text-gray-400">${timeString}</span>
            </div>
            <p class="text-sm mt-1">Detected <strong class="text-white">${incident.object_type}</strong> in <strong class="text-white">${incident.zone_type}</strong> zone.</p>
            <p class="text-sm mt-2 text-yellow-300 italic">"${incident.explanation}"</p>
            
            ${evidenceImage} <!-- 📸 PHOTO KO YAHAN BIND KAR DIYA -->

            <div class="mt-3 text-xs flex justify-between items-center text-gray-400 border-t border-gray-700 pt-2">
                <span>Confidence: ${(incident.confidence * 100).toFixed(1)}%</span>
                <button class="bg-blue-600 hover:bg-blue-500 text-white px-2 py-1 rounded transition">Verify</button>
            </div>
        </div>
    `;
    alertsContainer.insertAdjacentHTML('afterbegin', alertHtml);
}

// NEW: Page load hote hi SQLite database se purane alerts fetch karna
async function loadIncidentHistory() {
    try {
        const response = await fetch('https://ibvap-1-xmfb.onrender.com/api/incidents');
        const pastIncidents = await response.json();
        
        // Reverse loop taaki sabse naya alert top par aaye
        pastIncidents.reverse().forEach(incident => {
            renderAlertCard(incident);
        });
        console.log(`📥 Loaded ${pastIncidents.length} past incidents from Database.`);
    } catch (error) {
        console.error("Error loading history:", error);
    }
}
// Call the function on startup
loadIncidentHistory();

// CHANGED: 'high_risk_alert' se 'new_alert' kar diya
socket.on('new_alert', (incident) => {
    // Show Critical Banner only for live incoming alerts
    if (criticalBanner) {
        criticalBanner.style.display = 'block';
        clearTimeout(bannerTimeout);
        bannerTimeout = setTimeout(() => { criticalBanner.style.display = 'none'; }, 5000);
    }
    
    // Render the new card
    renderAlertCard(incident);
});


// 4. MULTI-ZONE VIRTUAL FENCING (HTML5 CANVAS)

const canvas = document.getElementById('zoneCanvas');
const ctx = canvas.getContext('2d');

let allZones = [];         
let currentPoints = [];    

canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    
    currentPoints.push([Math.round(x), Math.round(y)]);
    drawAll();
});

function drawPolygon(points, fillColor, strokeColor) {
    if (points.length === 0) return;
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    
    for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i][0], points[i][1]);
    }
    
    if (points.length > 2) {
        ctx.closePath();
        ctx.fillStyle = fillColor;
        ctx.fill();
    }
    
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 2;
    ctx.stroke();

    points.forEach(p => {
        ctx.beginPath();
        ctx.arc(p[0], p[1], 4, 0, Math.PI * 2);
        ctx.fillStyle = 'white';
        ctx.fill();
    });
}

function drawAll() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Locked Zones
    allZones.forEach(zone => {
        drawPolygon(zone, 'rgba(239, 68, 68, 0.2)', '#ef4444');
    });
    
    // Current drawing zone
    if (currentPoints.length > 0) {
        drawPolygon(currentPoints, 'rgba(59, 130, 246, 0.2)', '#3b82f6');
    }
}

document.getElementById('lockZoneBtn').addEventListener('click', () => {
    if (currentPoints.length >= 3) {
        allZones.push(currentPoints);
        currentPoints = [];
        drawAll();
    }
});

document.getElementById('clearZoneBtn').addEventListener('click', () => {
    allZones = [];
    currentPoints = [];
    drawAll();
});

document.getElementById('setZoneBtn').addEventListener('click', () => {
    let payload = [...allZones];
    if (currentPoints.length >= 3) {
        payload.push(currentPoints);
    }

    if (payload.length > 0) {
        // CHANGED: 'update_zone' se 'new_zone_coordinates' kar diya
        socket.emit('new_zone_coordinates', payload); 
        
        const btn = document.getElementById('setZoneBtn');
        btn.innerText = "Zones Deployed!";
        btn.classList.replace('bg-blue-600', 'bg-green-600');
        
        setTimeout(() => {
            btn.innerText = "Deploy Zones to AI";
            btn.classList.replace('bg-green-600', 'bg-blue-600');
        }, 2000);
    } else {
        alert("Kam se kam ek polygon draw karein!");
    }
});


// 5. CAMERA SWITCHING LOGIC

let usingLaptopCam = true;
const phoneCameraURL = "http://192.0.0.4:8080/video"; 

document.getElementById('cameraToggleBtn').addEventListener('click', () => {
    usingLaptopCam = !usingLaptopCam;
    const newSource = usingLaptopCam ? 0 : phoneCameraURL;
    
   
    socket.emit('change_camera_source', newSource); 
    
    const btn = document.getElementById('cameraToggleBtn');
    btn.innerText = usingLaptopCam ? "Switch to Phone CCTV" : "Switch to Laptop Cam";
    btn.classList.toggle('bg-indigo-600');
    btn.classList.toggle('bg-orange-600');
});

// 6. CLEAR HISTORY LOGIC

const clearHistoryBtn = document.getElementById('clearHistoryBtn');

if (clearHistoryBtn) {
    clearHistoryBtn.addEventListener('click', async () => {
       
        if (confirm("Are you sure you want to delete all incident history?")) {
            try {
                
                const response = await fetch('/api/incidents', { method: 'DELETE' });
                const result = await response.json();
                
                if (result.success) {
                    console.log("🗑️ History deleted from Database.");
                }
            } catch (error) {
                console.error("Error clearing history:", error);
            }
        }
    });
}


socket.on('clear_ui', () => {
    alertsContainer.innerHTML = ''; 
    alertCounter = 0; 
    if (alertCountBadge) alertCountBadge.innerText = '0';
    if (noAlertsMsg) noAlertsMsg.style.display = 'block'; 
});