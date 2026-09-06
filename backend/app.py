"""
NeuroLens AI — Flask Backend
Handles file uploads, data analysis, and AI-powered insights.
"""

import os
import json
import pandas as pd
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
CORS(app)

UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), "uploads")
ALLOWED_EXTENSIONS = {"csv", "xlsx", "xls", "json"}
app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER
app.config["MAX_CONTENT_LENGTH"] = 16 * 1024 * 1024  # 16 MB max


def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


def load_dataset(filepath):
    ext = filepath.rsplit(".", 1)[1].lower()
    if ext == "csv":
        return pd.read_csv(filepath)
    elif ext in ("xlsx", "xls"):
        return pd.read_excel(filepath)
    elif ext == "json":
        return pd.read_json(filepath)
    return None


# ──────────────────────────────────────────────
# Routes
# ──────────────────────────────────────────────

@app.route("/", methods=["GET"])
def index():
    return jsonify({"status": "NeuroLens AI API is running", "version": "1.0.0"})


@app.route("/api/upload", methods=["POST"])
def upload_file():
    """Upload a dataset file."""
    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files["file"]
    if file.filename == "":
        return jsonify({"error": "No file selected"}), 400

    if not allowed_file(file.filename):
        return jsonify({"error": f"File type not allowed. Use: {', '.join(ALLOWED_EXTENSIONS)}"}), 400

    filename = file.filename
    filepath = os.path.join(app.config["UPLOAD_FOLDER"], filename)
    file.save(filepath)

    # Quick preview
    df = load_dataset(filepath)
    if df is None:
        return jsonify({"error": "Could not parse file"}), 500

    return jsonify({
        "message": "File uploaded successfully",
        "filename": filename,
        "rows": len(df),
        "columns": list(df.columns),
        "preview": df.head(5).to_dict(orient="records"),
    })


@app.route("/api/analyze/<filename>", methods=["GET"])
def analyze(filename):
    """Return basic statistics for an uploaded dataset."""
    filepath = os.path.join(app.config["UPLOAD_FOLDER"], filename)
    if not os.path.exists(filepath):
        return jsonify({"error": "File not found"}), 404

    df = load_dataset(filepath)
    if df is None:
        return jsonify({"error": "Could not parse file"}), 500

    numeric_cols = df.select_dtypes(include="number").columns.tolist()
    stats = df[numeric_cols].describe().to_dict() if numeric_cols else {}

    return jsonify({
        "filename": filename,
        "shape": {"rows": len(df), "columns": len(df.columns)},
        "columns": list(df.columns),
        "dtypes": df.dtypes.astype(str).to_dict(),
        "missing_values": df.isnull().sum().to_dict(),
        "statistics": stats,
    })


@app.route("/api/chat", methods=["POST"])
def chat():
    """
    AI chat endpoint — ask questions about your data.
    Requires ANTHROPIC_API_KEY in .env
    """
    try:
        import anthropic
    except ImportError:
        return jsonify({"error": "anthropic package not installed"}), 500

    data = request.get_json()
    question = data.get("question", "").strip()
    context = data.get("context", "")  # dataset summary passed from frontend

    if not question:
        return jsonify({"error": "No question provided"}), 400

    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        return jsonify({"error": "ANTHROPIC_API_KEY not set in environment"}), 500

    client = anthropic.Anthropic(api_key=api_key)
    system = (
        "You are NeuroLens AI, a data analysis assistant. "
        "Answer questions about datasets clearly and concisely. "
        "If dataset context is provided, use it to give specific answers."
    )
    prompt = f"Dataset context:\n{context}\n\nQuestion: {question}" if context else question

    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1024,
        system=system,
        messages=[{"role": "user", "content": prompt}],
    )

    return jsonify({"answer": message.content[0].text})


@app.route("/api/files", methods=["GET"])
def list_files():
    """List all uploaded files."""
    files = []
    for fname in os.listdir(app.config["UPLOAD_FOLDER"]):
        if allowed_file(fname):
            fpath = os.path.join(app.config["UPLOAD_FOLDER"], fname)
            files.append({
                "name": fname,
                "size_kb": round(os.path.getsize(fpath) / 1024, 1),
            })
    return jsonify({"files": files})


if __name__ == "__main__":
    os.makedirs(UPLOAD_FOLDER, exist_ok=True)
    app.run(debug=True, port=5000)
  
