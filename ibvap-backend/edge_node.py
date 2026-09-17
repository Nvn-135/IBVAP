import cv2
import numpy as np
import requests
import socketio
import base64
import time
from ultralytics import YOLO


# 1. SETUP & GLOBAL VARIABLES

sio = socketio.Client()

# Globals
active_zones = [] 
track_history = {}
alerted_tracks = set() 

# Camera Switcher Variables
camera_source = 0  
camera_changed = False


# 2. SOCKET.IO EVENT LISTENERS

@sio.event
def connect():
    print("✅ Python Edge Node connected to Node.js Server!")

@sio.event
def disconnect():
    print("❌ Disconnected from server!")

@sio.on('new_zone_coordinates')
def on_new_zone(data):
    global active_zones
    active_zones = [np.array(zone, np.int32) for zone in data]
    print(f"✅ Multi-Zone Updated! Active Zones: {len(active_zones)}")

@sio.on('change_camera_source')
def on_change_camera(data):
    global camera_source, camera_changed
    camera_source = data
    camera_changed = True
    print(f"🔄 Switching Camera Source to: {camera_source}")


# 3. CONNECT TO BACKEND & INIT AI

try:
    sio.connect('ibvap-production.up.railway.app')
except Exception as e:
    print("❌ Server se connect nahi ho paya. Kya Node.js server chal raha hai?")

print("Loading YOLO model...")
model = YOLO('yolov8n.pt') 
API_URL = "ibvap-production.up.railway.app/api/events"

print(f"Starting Camera with source: {camera_source}...")
cap = cv2.VideoCapture(camera_source)


# 4. MAIN PROCESSING LOOP

while True:
    # --- CAMERA SWITCHING LOGIC ---
    if camera_changed:
        print("Camera source changed. Restarting video capture...")
        cap.release() 
        cap = cv2.VideoCapture(camera_source)
        camera_changed = False
        continue

    success, frame = cap.read()
    if not success:
        continue

    # 1. YOLO INFERENCE (Tracking Enabled)
  
    results = model.track(frame, persist=True, classes=[0, 2, 3, 5, 7], verbose=False)

    for r in results:
        boxes = r.boxes
        
        for box in boxes:
            # Bounding box coordinates
            x1, y1, x2, y2 = map(int, box.xyxy[0])
            conf = float(box.conf[0])
            cls_id = int(box.cls[0])
            object_name = model.names[cls_id] 
            
            # Tracking ID nikalna
            track_id = int(box.id[0]) if box.id is not None else -1

            # Object ka bottom-center point 
            cx = (x1 + x2) // 2
            cy = (y1 + y2)//2 

            in_zone = False
            zone_name = "None"

            # 2. ZONE CHECKING LOGIC
            if len(active_zones) > 0:
                for idx, zone in enumerate(active_zones):
                    if cv2.pointPolygonTest(zone, (cx, cy), False) >= 0:
                        in_zone = True
                        zone_name = f"Zone {idx + 1}"
                        break
            
            # 3. ALERT LOGIC (3-Second Dwell Time)
            if in_zone:
                box_color = (0, 0, 255) # RED Box 🔴
                
               
                if track_id not in track_history:
                    track_history[track_id] = time.time()
                
                
                dwell_time = time.time() - track_history[track_id]
                
                
                if dwell_time >= 3.0 and track_id not in alerted_tracks:
                    
                   
                    _, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 60]) 
                    snapshot_b64 = base64.b64encode(buffer).decode('utf-8')
                    
                   
                    _, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 60]) # Size kam karne ke liye 60% quality
                    snapshot_b64 = base64.b64encode(buffer).decode('utf-8')
                    
                    payload = {
                        "object_type": object_name.upper(),
                        "zone_type": zone_name,
                        "risk_level": "CRITICAL",
                        "confidence": float(f"{conf:.2f}"),
                        "explanation": f"{object_name.capitalize()} breached {zone_name} and stayed for over 3 seconds.",
                        "snapshot": snapshot_b64  
                    }
                    
                    try:
                        response = requests.post(API_URL, json=payload)
                        print(f"🚨 ALERT SENT WITH EVIDENCE! Node replied: {response.status_code}")
                        alerted_tracks.add(track_id) 
                    except Exception as e:
                        print(f"❌ API Error: {e}")
                        
            else:
                box_color = (0, 255, 0) # GREEN Box 🟢
                
              
                if track_id in track_history:
                    del track_history[track_id]
                if track_id in alerted_tracks:
                    alerted_tracks.remove(track_id)

            # 4. DRAWING BOUNDING BOXES & LABELS
            cv2.rectangle(frame, (x1, y1), (x2, y2), box_color, 2)
            label_text = f"{object_name.upper()} ID:{track_id} {conf*100:.0f}%"
            cv2.putText(frame, label_text, (x1, y1 - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.6, box_color, 2)

    # 5. ZONES DRAW KARNA 
    for zone in active_zones:
        cv2.polylines(frame, [zone], isClosed=True, color=(255, 0, 0), thickness=2)

    # 6. SEND FRAME TO NODE.JS
    frame = cv2.resize(frame, (800, 450))
    _, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 70])
    frame_base64 = base64.b64encode(buffer).decode('utf-8')
    
    sio.emit('send_frame', frame_base64)
    time.sleep(0.03)