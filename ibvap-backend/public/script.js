// ==========================================
// 1. INITIALIZATION & SOCKET CONNECTION
// ==========================================
const socket = io("https://ibvap-1-xmfb.onrender.com");

socket.on('connect', () => {
    console.log('✅ Connected to IBVAP Backend successfully.');
});

// ==========================================
// 2. ALERT TIMELINE LOGIC & DATABASE FETCH
// ==========================================
let alertCounter = 0;
const alertsContainer = document.getElementById('alertsContainer');
const noAlertsMsg = document.getElementById('noAlerts');
const alertCountBadge = document.getElementById('alertCount');
const criticalBanner = document.getElementById('criticalBanner');
let bannerTimeout;

function renderAlertCard(incident) {
    if (noAlertsMsg) noAlertsMsg.style.display = 'none';
    alertCounter++;
    if (alertCountBadge) alertCountBadge.innerText = alertCounter;
    
    const timeString = new Date(incident.timestamp || new Date()).toLocaleTimeString();
    
    // Check if image data is a full URL (Demo mode) or Base64 (Local AI)
    let imageSrc = incident.image_data;
    if (imageSrc && !imageSrc.startsWith('http') && !imageSrc.startsWith('data:')) {
        imageSrc = 'data:image/jpeg;base64,' + incident.image_data;
    }

    const evidenceImage = imageSrc 
        ? `<img src="${imageSrc}" class="w-full h-32 object-cover rounded mt-2 border border-red-500/50" alt="Evidence Snapshot">` 
        : '';

    const alertHtml = `
        <div class="glass-panel alert-card p-3 bg-red-900/10 border-l-4 border-red-500 mb-2">
            <div class="flex justify-between items-start">
                <span class="text-red-400 font-bold uppercase text-sm">${incident.risk_level} ALERT</span>
                <span class="text-xs text-gray-400">${timeString}</span>
            </div>
            <p class="text-sm mt-1">Detected <strong class="text-white">${incident.object_type}</strong> in <strong class="text-white">${incident.zone_type}</strong> zone.</p>
            <p class="text-sm mt-2 text-yellow-300 italic">"${incident.explanation}"</p>
            ${evidenceImage}
            <div class="mt-3 text-xs flex justify-between items-center text-gray-400 border-t border-gray-700 pt-2">
                <span>Confidence: ${(incident.confidence * 100).toFixed(1)}%</span>
                <button class="bg-blue-600 hover:bg-blue-500 text-white px-2 py-1 rounded transition">Verify</button>
            </div>
        </div>
    `;
    alertsContainer.insertAdjacentHTML('afterbegin', alertHtml);
}

async function loadIncidentHistory() {
    try {
        const response = await fetch('https://ibvap-1-xmfb.onrender.com/api/incidents');
        const pastIncidents = await response.json();
        
        pastIncidents.reverse().forEach(incident => {
            renderAlertCard(incident);
        });
        console.log(`📥 Loaded ${pastIncidents.length} past incidents from Database.`);
    } catch (error) {
        console.error("Error loading history:", error);
    }
}
loadIncidentHistory();

socket.on('new_alert', (incident) => {
    if (criticalBanner) {
        criticalBanner.style.display = 'block';
        clearTimeout(bannerTimeout);
        bannerTimeout = setTimeout(() => { criticalBanner.style.display = 'none'; }, 5000);
    }
    renderAlertCard(incident);
});

// ==========================================
// 3. MULTI-ZONE VIRTUAL FENCING (CANVAS)
// ==========================================
const zoneCanvas = document.getElementById('zoneCanvas');
const zCtx = zoneCanvas.getContext('2d');

let allZones = [];         
let currentPoints = [];    

zoneCanvas.addEventListener('click', (e) => {
    const rect = zoneCanvas.getBoundingClientRect();
    const scaleX = zoneCanvas.width / rect.width;
    const scaleY = zoneCanvas.height / rect.height;

    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    
    currentPoints.push([Math.round(x), Math.round(y)]);
    drawAll();
});

function drawPolygon(points, fillColor, strokeColor) {
    if (points.length === 0) return;
    zCtx.beginPath();
    zCtx.moveTo(points[0][0], points[0][1]);
    
    for (let i = 1; i < points.length; i++) {
        zCtx.lineTo(points[i][0], points[i][1]);
    }
    
    if (points.length > 2) {
        zCtx.closePath();
        zCtx.fillStyle = fillColor;
        zCtx.fill();
    }
    
    zCtx.strokeStyle = strokeColor;
    zCtx.lineWidth = 2;
    zCtx.stroke();

    points.forEach(p => {
        zCtx.beginPath();
        zCtx.arc(p[0], p[1], 4, 0, Math.PI * 2);
        zCtx.fillStyle = 'white';
        zCtx.fill();
    });
}

function drawAll() {
    zCtx.clearRect(0, 0, zoneCanvas.width, zoneCanvas.height);
    allZones.forEach(zone => {
        drawPolygon(zone, 'rgba(239, 68, 68, 0.2)', '#ef4444');
    });
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
    if (currentPoints.length >= 3) payload.push(currentPoints);

    if (payload.length > 0) {
        socket.emit('new_zone_coordinates', payload); 
        const btn = document.getElementById('setZoneBtn');
        btn.innerText = "Zones Deployed!";
        btn.classList.replace('bg-blue-600', 'bg-green-600');
        setTimeout(() => {
            btn.innerText = "Deploy Zones to AI";
            btn.classList.replace('bg-green-600', 'bg-blue-600');
        }, 2000);
    } else {
        alert("Draw atleast one polygon!");
    }
});

const clearHistoryBtn = document.getElementById('clearHistoryBtn');
if (clearHistoryBtn) {
    clearHistoryBtn.addEventListener('click', async () => {
        if (confirm("Are you sure you want to delete all incident history?")) {
            try {
                const response = await fetch('https://ibvap-1-xmfb.onrender.com/api/incidents', { method: 'DELETE' });
                const result = await response.json();
                if (result.success) {
                    console.log("🗑️ History deleted from Database.");
                    if (window.resetAITracking) window.resetAITracking(); // 🔄 Reset AI IDs
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
    if (window.resetAITracking) window.resetAITracking(); // 🔄 Reset AI IDs
});

// ==========================================
// 4. REAL IN-BROWSER AI (ALL OBJECTS + TRACKING + RE-ENTRY)
// ==========================================
const video = document.getElementById('webcam');
const outputCanvas = document.getElementById('output_canvas');
const ctx = outputCanvas.getContext('2d');
let mySession;
let isDetecting = false;

// Tracking State
let trackers = [];
let nextTrackId = 1;

// Global Reset Function for Testing
window.resetAITracking = () => {
    trackers = [];
    nextTrackId = 1;
    console.log("🔄 Tracking state & IDs reset for testing!");
};

const PERMANENT_ZONE = [
    [40, 40],   // Top-Left
    [600, 40],  // Top-Right
    [600, 440], // Bottom-Right
    [40, 440]   // Bottom-Left
];
// YOLOv8 COCO 80 Classes
const YOLO_CLASSES = [
    'person', 'bicycle', 'car', 'motorcycle', 'airplane', 'bus', 'train', 'truck', 'boat',
    'traffic light', 'fire hydrant', 'stop sign', 'parking meter', 'bench', 'bird', 'cat', 'dog', 'horse',
    'sheep', 'cow', 'elephant', 'bear', 'zebra', 'giraffe', 'backpack', 'umbrella', 'handbag', 'tie',
    'suitcase', 'frisbee', 'skis', 'snowboard', 'sports ball', 'kite', 'baseball bat', 'baseball glove',
    'skateboard', 'surfboard', 'tennis racket', 'bottle', 'wine glass', 'cup', 'fork', 'knife', 'spoon',
    'bowl', 'banana', 'apple', 'sandwich', 'orange', 'broccoli', 'carrot', 'hot dog', 'pizza', 'donut',
    'cake', 'chair', 'couch', 'potted plant', 'bed', 'dining table', 'toilet', 'tv', 'laptop', 'mouse',
    'remote', 'keyboard', 'cell phone', 'microwave', 'oven', 'toaster', 'sink', 'refrigerator', 'book',
    'clock', 'vase', 'scissors', 'teddy bear', 'hair drier', 'toothbrush'
];

function isPointInPolygon(point, polygon) {
    let x = point[0], y = point[1];
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        let xi = polygon[i][0], yi = polygon[i][1];
        let xj = polygon[j][0], yj = polygon[j][1];
        let intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}

async function loadAIModel() {
    console.log("⏳ Loading YOLOv8 Model...");
    try {
        mySession = await ort.InferenceSession.create('/yolov8n.onnx', { executionProviders: ['wasm'] });
        console.log("✅ AI Model Loaded Successfully!");
        startWebcam();
    } catch (e) {
        console.error("❌ Model Load Error:", e);
    }
}

async function startWebcam() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
        video.srcObject = stream;
        video.play();
        video.addEventListener('loadeddata', () => {
            console.log("🎥 Webcam Started! AI Inference Active...");
            detectFrame();
        });
    } catch (err) {
        console.error("❌ Webcam Access Denied", err);
    }
}

async function detectFrame() {
    if (!mySession || isDetecting) {
        requestAnimationFrame(detectFrame);
        return;
    }
    isDetecting = true;

    const offCanvas = document.createElement('canvas');
    offCanvas.width = 640; offCanvas.height = 640;
    const offCtx = offCanvas.getContext('2d', { willReadFrequently: true });
    offCtx.drawImage(video, 0, 0, 640, 640); 
    
    const imgData = offCtx.getImageData(0, 0, 640, 640).data;
    const float32Data = new Float32Array(3 * 640 * 640);
    
    for (let i = 0; i < imgData.length / 4; i++) {
        float32Data[i] = imgData[i * 4] / 255.0;                     
        float32Data[640 * 640 + i] = imgData[i * 4 + 1] / 255.0;     
        float32Data[2 * 640 * 640 + i] = imgData[i * 4 + 2] / 255.0; 
    }
    const tensor = new ort.Tensor('float32', float32Data, [1, 3, 640, 640]);

    try {
        const inputName = mySession.inputNames[0];
        const outputName = mySession.outputNames[0];
        const results = await mySession.run({ [inputName]: tensor });
        const output = results[outputName].data; 
        
        let rawDetections = [];
        
        for (let i = 0; i < 8400; i++) {
            let maxProb = 0; let classId = -1;
            for (let c = 0; c < 80; c++) {
                let prob = output[(c + 4) * 8400 + i];
                if (prob > maxProb) { maxProb = prob; classId = c; }
            }
            
            // 🔄 Yahan filter hataya gaya hai taaki saari 80 classes detect ho sakein
            if (maxProb > 0.30) { 
                let cx = output[0 * 8400 + i]; let cy = output[1 * 8400 + i];
                let w = output[2 * 8400 + i];  let h = output[3 * 8400 + i];
                let detectedName = YOLO_CLASSES[classId].toUpperCase();
                
                rawDetections.push({ 
                    x: cx - (w / 2), y: (cy - (h / 2)) * (480 / 640), 
                    w: w, h: h * (480 / 640), 
                    prob: maxProb, 
                    className: detectedName 
                });
            }
        }

        if (rawDetections.length > 1) rawDetections.sort((a, b) => b.prob - a.prob);
        // Abhi hum performance ke liye sirf sabse confident 1 object track kar rahe hain
        let activeDetections = rawDetections.length > 0 ? [rawDetections[0]] : [];

        // --- CENTROID TRACKING LOGIC ---
        let currentTracks = [];
        for (let det of activeDetections) {
            let cx = det.x + (det.w / 2);
            let cy = det.y + (det.h / 2);
            
            let matchedTrack = null;
            let minDist = 150;

            for (let t of trackers) {
                let dist = Math.hypot(cx - t.cx, cy - t.cy);
                // Class bhi same honi chahiye (person vs phone)
                if (dist < minDist && t.box.className === det.className) { 
                    minDist = dist; matchedTrack = t; 
                }
            }

            if (matchedTrack) {
                matchedTrack.cx = cx; matchedTrack.cy = cy; matchedTrack.box = det;
                matchedTrack.missedFrames = 0;
                trackers = trackers.filter(t => t.id !== matchedTrack.id);
                currentTracks.push(matchedTrack);
            } else {
                currentTracks.push({
                    id: nextTrackId++,
                    cx: cx, cy: cy, box: det,
                    missedFrames: 0, zoneEnterTime: null, alertSent: false
                });
            }
        }

        for (let t of trackers) {
            t.missedFrames++;
            if (t.missedFrames < 15) currentTracks.push(t); 
        }
        trackers = currentTracks;

        // --- DRAWING & ALERT LOGIC ---
        ctx.clearRect(0, 0, outputCanvas.width, outputCanvas.height);
        ctx.drawImage(video, 0, 0, outputCanvas.width, outputCanvas.height);
        
        ctx.strokeStyle = "rgba(255, 165, 0, 0.8)"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(PERMANENT_ZONE[0][0], PERMANENT_ZONE[0][1]);
        for(let i=1; i<PERMANENT_ZONE.length; i++) ctx.lineTo(PERMANENT_ZONE[i][0], PERMANENT_ZONE[i][1]);
        ctx.closePath(); ctx.stroke();
        ctx.fillStyle = "rgba(255, 165, 0, 0.2)"; ctx.fill();
        ctx.fillStyle = "orange"; ctx.font = "bold 14px Arial"; ctx.fillText("RESTRICTED AREA", 125, 95);

        for (let t of trackers) {
            if (t.missedFrames > 0) continue; 
            
            let isInZone = isPointInPolygon([t.cx, t.cy], PERMANENT_ZONE);
            let labelText = `${t.box.className} ID:${t.id}`;

            if (isInZone) {
                if (!t.zoneEnterTime) t.zoneEnterTime = Date.now();
                let dwellTime = Date.now() - t.zoneEnterTime;

                if (dwellTime >= 3000) {
                    ctx.strokeStyle = "#ef4444"; ctx.lineWidth = 4;
                    ctx.strokeRect(t.box.x, t.box.y, t.box.w, t.box.h);
                    ctx.fillStyle = "#ef4444"; ctx.font = "bold 16px Arial";
                    ctx.fillText(`🚨 ${labelText} ALERT!`, t.box.x, t.box.y - 10);
                    
                    if (!t.alertSent) {
                        t.alertSent = true;
                        sendRealAlert(t.box.prob, t.id, t.box.className);
                    }
                } else {
                    let timeLeft = (3 - (dwellTime/1000)).toFixed(1);
                    ctx.strokeStyle = "#eab308"; ctx.lineWidth = 3;
                    ctx.strokeRect(t.box.x, t.box.y, t.box.w, t.box.h);
                    ctx.fillStyle = "#eab308"; ctx.font = "bold 16px Arial";
                    ctx.fillText(`⚠️ ${labelText} TIME: ${timeLeft}s`, t.box.x, t.box.y - 10);
                }
            } else {
                t.zoneEnterTime = null; 
                t.alertSent = false; 
                
                ctx.strokeStyle = "#22c55e"; ctx.lineWidth = 2;
                ctx.strokeRect(t.box.x, t.box.y, t.box.w, t.box.h);
                ctx.fillStyle = "#22c55e"; ctx.font = "bold 16px Arial";
                ctx.fillText(`✅ ${labelText} SAFE`, t.box.x, t.box.y - 10);
            }
        }
    } catch (e) {
        console.error("AI Error: ", e);
    }

    isDetecting = false;
    requestAnimationFrame(detectFrame); 
}

async function sendRealAlert(confidence, trackId, objectName) {
    const snapBase64 = outputCanvas.toDataURL('image/jpeg', 0.6).split(',')[1];
    
    const payload = {
        object_type: `${objectName} (ID: ${trackId})`,
        zone_type: "Permanent Restricted Zone",
        risk_level: "CRITICAL",
        confidence: confidence,
        explanation: `Target ${objectName} (ID:${trackId}) lingered in the restricted zone for over 3 seconds.`,
        snapshot: snapBase64
    };
    
    try {
        await fetch('https://ibvap-1-xmfb.onrender.com/api/events', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        console.log(`📸 Alert Sent for ${objectName} ID: ${trackId}`);
    } catch (err) {
        console.error("Alert failed:", err);
    }
}

loadAIModel();