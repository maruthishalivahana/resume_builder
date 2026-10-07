# RESUME.ENG — Backend API (Milestone 1)

Backend service for the **RESUME.ENG** LaTeX platform. This service handles file uploads, validation, and persistent storage of `.tex` documents and project metadata in MongoDB Atlas.

---

## Current Milestone

> **CURRENT MILESTONE:** `.tex` file upload and MongoDB persistence.

### Features in this milestone
- In-memory `.tex` file validation and upload via Multer (max 2 MB)
- UTF-8 text decoding of `.tex` buffer
- Automatic `LatexProject` document creation
- Associated `LatexFile` document creation with project reference
- Standardized API responses (HTTP 201) and centralized error handling (HTTP 400/500)
- Health check endpoint

### NOT Implemented Yet (Planned for Future Milestones)
- Authentication / User accounts
- Multi-file project trees
- ZIP archives & extraction
- LaTeX compilation (`pdflatex` / Docker worker)
- PDF preview generation
- Redis caching
- BullMQ job queues
- AI resume assistant
- ATS diagnostics
- Version history

---

## Tech Stack

- **Runtime:** Node.js (v20+)
- **Language:** Strict TypeScript
- **Framework:** Express.js (v4)
- **Database:** MongoDB Atlas via Mongoose (v8)
- **File Ingestion:** Multer (`memoryStorage`)
- **Environment:** `dotenv`
- **Security:** `cors`

---

## Project Structure

```
backend/
├── src/
│   ├── config/
│   │   └── db.ts                   # Mongoose connection to MongoDB Atlas
│   ├── controllers/
│   │   └── latex.controller.ts     # uploadTexFile logic & project derivation
│   ├── middleware/
│   │   ├── error.middleware.ts     # Centralized error handler & AppError
│   │   └── upload.middleware.ts    # Multer memory storage & .tex filter
│   ├── models/
│   │   ├── LatexFile.ts            # LatexFile Mongoose schema & index
│   │   └── LatexProject.ts         # LatexProject Mongoose schema
│   ├── routes/
│   │   └── latex.routes.ts         # POST /api/latex/upload route
│   ├── app.ts                      # Express app setup, CORS & middleware
│   └── server.ts                   # Bootstrapping & server listening
├── .env.example
├── .gitignore
├── package.json
├── tsconfig.json
└── README.md
```

---

## Installation & Setup

### 1. Install dependencies

From the `backend` directory:

```bash
npm install
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Set your values in `.env`:

```env
PORT=5000
MONGODB_URI=mongodb+srv://YOUR_USERNAME:YOUR_PASSWORD@YOUR_CLUSTER.mongodb.net/resume_eng
CLIENT_URL=http://localhost:3000
```

> **Note:** The backend fails immediately on startup if `MONGODB_URI` is not provided.

### 3. MongoDB Atlas Setup

1. Create a free cluster at [MongoDB Atlas](https://www.mongodb.com/cloud/atlas).
2. Under **Database Access**, create a user with Read/Write privileges.
3. Under **Network Access**, add your IP address (or `0.0.0.0/0` for development).
4. Go to **Clusters > Connect > Drivers** and copy your connection string.
5. Replace `<password>` with your database user password and update `MONGODB_URI` in `.env`.

---

## Running the Backend

### Development Mode (auto-reload)

```bash
npm run dev
```

Server will start on `http://localhost:5000`.

### Production Build & Run

```bash
npm run build
npm run start
```

---

## API Endpoints

### 1. Health Check

- **Method:** `GET`
- **URL:** `http://localhost:5000/api/health`
- **Response:**
  ```json
  {
    "success": true,
    "message": "RESUME.ENG backend is running"
  }
  ```

---

### 2. Upload `.tex` File

- **Method:** `POST`
- **URL:** `http://localhost:5000/api/latex/upload`
- **Content-Type:** `multipart/form-data`
- **Body Field:**
  - `file`: (Binary `.tex` file)

#### Successful Response (`HTTP 201 Created`):

```json
{
  "success": true,
  "message": "LaTeX file uploaded successfully",
  "data": {
    "project": {
      "id": "673f8a...",
      "name": "resume",
      "compiler": "pdflatex"
    },
    "file": {
      "id": "673f8b...",
      "name": "resume.tex",
      "path": "resume.tex",
      "content": "\\documentclass{article}\n\\begin{document}\n...\n\\end{document}"
    }
  }
}
```

#### Error Responses (`HTTP 400 Bad Request`):

- **No file provided:**
  ```json
  {
    "success": false,
    "message": "No file uploaded. Please upload a .tex file using the 'file' field"
  }
  ```

- **Invalid file extension (e.g. `.txt`):**
  ```json
  {
    "success": false,
    "message": "Invalid file type. Only .tex files are allowed"
  }
  ```

- **File size exceeds 2 MB:**
  ```json
  {
    "success": false,
    "message": "File size exceeds 2 MB limit"
  }
  ```

---

## Postman / cURL Testing Instructions

### cURL Examples

#### Health check:
```bash
curl http://localhost:5000/api/health
```

#### Upload valid `.tex` file:
```bash
curl -X POST http://localhost:5000/api/latex/upload \
  -F "file=@sample_resume.tex"
```

#### Upload invalid `.txt` file (should fail with 400):
```bash
curl -X POST http://localhost:5000/api/latex/upload \
  -F "file=@notes.txt"
```

### Postman Testing:
1. Open Postman and create a new request.
2. Select **POST** and enter `http://localhost:5000/api/latex/upload`.
3. In the **Body** tab, choose **form-data**.
4. Set the key to `file`, change the dropdown from *Text* to *File*.
5. Select a `.tex` file from your disk.
6. Click **Send**.
7. Observe `201 Created` with project and file JSON.
