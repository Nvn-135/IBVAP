from ultralytics import YOLO

print("YOLOv8n model loading.....")
model = YOLO('yolov8n.pt')

print("Export in ONNX format")
# Yeh ek nayi file banayega 'yolov8n.onnx' naam se
success = model.export(format="onnx")

if success:
    print("✅ Export successful!.")