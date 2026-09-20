# 🛡️ Intelligent Border Video Analytics Platform (IBVAP)

**Intelligent Border Video Analytics Platform (IBVAP)** is a highly scalable, real-time edge-AI surveillance dashboard . 

Traditional video analytics systems transmit heavy RTSP video streams to central cloud servers, leading to high bandwidth costs, latency, and data privacy risks. **IBVAP solves this by pushing the AI inference directly to the edge (the operator's web browser)** using WebAssembly (WASM) and ONNX Runtime Web. The cloud server is only contacted when a verified threat is detected, making the system incredibly fast, privacy-compliant, and cost-effective.

---

## 🚀 Core Technical Features

### 1. 100% In-Browser Edge ML Pipeline
*   **Zero-Latency AI:** Executes a YOLOv8-Nano model directly within the client's browser using **ONNX Runtime Web**.
*   **WebAssembly (WASM) Acceleration:** Bypasses JavaScript bottlenecks by utilizing WASM for heavy mathematical tensor computations.
*   **Privacy-First:** No live video frames are ever sent to the cloud. Only Base64 evidence snapshots of actual intrusions are transmitted.

### 2. Multi-Class Object & Abandoned Luggage Detection
*   Recognizes up to **80 COCO classes** (Persons, Vehicles, Bags, Electronics, etc.).
*   Engineered with dynamic confidence thresholds (e.g., lowered to 30% for static objects) to successfully identify **Abandoned Objects** (like backpacks or suitcases) left in restricted areas by intruders.

### 3. Advanced Tracking & Temporal Logic
*   **Centroid Tracking Algorithm:** Implements a custom lightweight Euclidean distance tracker. It assigns a unique ID (e.g., `PERSON ID: 1`) to each object, preventing the system from spamming duplicate alerts for the same stationary intruder.
*   **3-Second Dwell-Time Logic:** Prevents false positives by differentiating between an object merely passing by and an object loitering. Alerts are only fired if the target remains inside the restricted zone for 3 continuous seconds.

### 4. Mathematical Virtual Fencing
*   **Ray-Casting Algorithm:** The system defines a precise `PERMANENT_ZONE` polygon array. It maps the bounding box centroids to this polygon using a point-in-polygon ray-casting algorithm to determine exact spatial breaches.
*   **Re-entry Reset Logic:** Automatically resets temporal timers and alert states the moment an intruder steps out of the zone, re-arming the system instantly.

---

## 🏗️ System Architecture

1.  **Frontend Node (Edge Device):**
    *   Hosted on **Vercel**.
    *   Built with HTML5, Tailwind CSS, and Vanilla JavaScript.
    *   Handles HTML5 Canvas feed mapping, `Float32Array` tensor normalization (`[1, 3, 640, 640]`), NMS (Non-Maximum Suppression) approximations, and UI rendering.
2.  **Backend Control Server:**
    *   Hosted on **Render**.
    *   Built with Node.js and Express.js.
    *   Uses **Socket.io** to broadcast real-time threat alerts to all connected operator dashboards instantly.
3.  **Database Layer:**
    *   **PostgreSQL** (via `pg` module).
    *   Stores permanent incident logs, including threat type, confidence scores, timestamps, and Base64 evidence snapshots.

---

## ⚙️ Installation & Local Setup

### Prerequisites
*   Node.js (v18 or higher)
*   PostgreSQL Database (Local or Cloud instance)

### 1. Clone the Repository
```bash
git clone [https://github.com/Nvn-135/IBVAP.git]
cd ibvap
