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
        alert("Kam se kam ek polygon draw karein!");
    }
});

const clearHistoryBtn = document.getElementById('clearHistoryBtn');
if (clearHistoryBtn) {
    clearHistoryBtn.addEventListener('click', async () => {
        if (confirm("Are you sure you want to delete all incident history?")) {
            try {
                const response = await fetch('https://ibvap-1-xmfb.onrender.com/api/incidents', { method: 'DELETE' });
                const result = await response.json();
                if (result.success) console.log("🗑️ History deleted from Database.");
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

// ==========================================
// 4. REAL IN-BROWSER AI (YOLOv8 ONNX TENSOR PROCESSING)
// ==========================================
const video = document.getElementById('webcam');
const outputCanvas = document.getElementById('output_canvas');
const ctx = outputCanvas.getContext('2d');
let mySession;
let isDetecting = false;
let lastAlertTime = 0; // Spam rokne ke liye timer

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
        alert("Live Demo dekhne ke liye Webcam access allow karein.");
    }
}

async function detectFrame() {
    if (!mySession || isDetecting) {
        requestAnimationFrame(detectFrame);
        return;
    }
    isDetecting = true;

    // 1. Prepare 640x640 Image Array for YOLOv8
    const offCanvas = document.createElement('canvas');
    offCanvas.width = 640;
    offCanvas.height = 640;
    const offCtx = offCanvas.getContext('2d', { willReadFrequently: true });
    offCtx.drawImage(video, 0, 0, 640, 640); // YOLO needs exact 640x640
    
    const imgData = offCtx.getImageData(0, 0, 640, 640).data;
    const float32Data = new Float32Array(3 * 640 * 640);
    
    // Convert to RGB & Normalize (0.0 to 1.0)
    for (let i = 0; i < imgData.length / 4; i++) {
        float32Data[i] = imgData[i * 4] / 255.0;                     // R
        float32Data[640 * 640 + i] = imgData[i * 4 + 1] / 255.0;     // G
        float32Data[2 * 640 * 640 + i] = imgData[i * 4 + 2] / 255.0; // B
    }
    const tensor = new ort.Tensor('float32', float32Data, [1, 3, 640, 640]);

    try {
        // 2. Run Inference
        const inputName = mySession.inputNames[0];
        const outputName = mySession.outputNames[0];
        const results = await mySession.run({ [inputName]: tensor });
        const output = results[outputName].data; // Matrix Shape: [1, 84, 8400]
        
        let detections = [];
        
        // 3. Parse Tensors (Scan 8400 bounding boxes)
        for (let i = 0; i < 8400; i++) {
            let maxProb = 0;
            let classId = -1;
            
            
            for (let c = 0; c < 80; c++) {
                let prob = output[(c + 4) * 8400 + i];
                if (prob > maxProb) { maxProb = prob; classId = c; }
            }
            
            // Class 0 = Person. 
            if (maxProb > 0.60 && classId === 0) { 
                let cx = output[0 * 8400 + i];
                let cy = output[1 * 8400 + i];
                let w = output[2 * 8400 + i];
                let h = output[3 * 8400 + i];
                
                // Scale back mapping 
                detections.push({ 
                    x: cx - (w / 2), 
                    y: (cy - (h / 2)) * (480 / 640), 
                    w: w, 
                    h: h * (480 / 640), 
                    prob: maxProb 
                });
            }
        }

        // 4. Draw to Screen
        ctx.clearRect(0, 0, outputCanvas.width, outputCanvas.height);
        ctx.drawImage(video, 0, 0, outputCanvas.width, outputCanvas.height);
        
        if (detections.length > 0) {
            // Sirf best/highest confidence wala box lo (NMS bypass)
            detections.sort((a, b) => b.prob - a.prob);
            let best = detections[0];
            
            // Draw Red Target Box
            ctx.strokeStyle = "#ef4444"; // Tailwind Red
            ctx.lineWidth = 3;
            ctx.strokeRect(best.x, best.y, best.w, best.h);
            
            // Draw Label
            ctx.fillStyle = "#ef4444";
            ctx.font = "bold 18px Arial";
            ctx.fillText(`INTRUDER ${(best.prob*100).toFixed(0)}%`, best.x, best.y - 10);
            
            // 5. Send Alert to Backend Database! (Ek alert har 10 seconds mein)
            if (Date.now() - lastAlertTime > 10000) {
                lastAlertTime = Date.now();
                sendRealAlert(best.prob);
            }
        } else {
            // Scanning Mode Indicator
            ctx.fillStyle = "rgba(0, 255, 0, 0.9)";
            ctx.font = "14px Arial";
            ctx.fillText("🟢 Scanning for threats...", 15, 30);
        }
    } catch (e) {
        console.error("AI Error: ", e);
    }

    isDetecting = false;
    requestAnimationFrame(detectFrame); // Continuous Loop
}

// Ye function Live frame ka screenshot nikal kar Render API ko bhejegai
async function sendRealAlert(confidence) {
    const snapBase64 = outputCanvas.toDataURL('image/jpeg', 0.6).split(',')[1];
    
    const payload = {
        object_type: "PERSON",
        zone_type: "Virtual Edge Zone",
        risk_level: "CRITICAL",
        confidence: confidence,
        explanation: "In-Browser Edge AI detected unauthorized human movement.",
        snapshot: snapBase64
    };
    
    try {
        await fetch('https://ibvap-1-xmfb.onrender.com/api/events', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        console.log("🚨 Real Alert Sent to Backend and Broadcasted!");
    } catch (err) {
        console.error("Alert failed:", err);
    }
}

// Start Process
loadAIModel();