import os
import json
from pathlib import Path

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from google import genai

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

client = genai.Client(
    api_key=os.getenv("GEMINI_API_KEY")
)

DATABASE_FILE = Path(__file__).parent / "document.json"


@app.post("/extract")
async def extract_document(
    file: UploadFile = File(...),
    document_type: str = Form(...)
):
    print(">>> Request received")
    print(">>> Document type:", document_type)
    print(">>> File:", file.filename)

    image_data = await file.read()

    if not image_data:
        raise HTTPException(status_code=400, detail="Empty file.")

    # Keep the document type consistent with the JSON returned by Gemini.
    type_map = {
        "passport": "passport",
        "visa": "visa",
        "aadhaar": "aadhaar",
        "driving license": "driving_license",
        "driving_license": "driving_license",
        "permit": "permit",
    }

    normalized_type = type_map.get(document_type.lower().strip())

    if not normalized_type:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported document type: {document_type}"
        )

    schemas = {
        "passport": {
            "document_type": "passport",
            "name": "",
            "passport_number": "",
            "nationality": "",
            "date_of_birth": "",
            "gender": "",
            "date_of_issue": "",
            "date_of_expiry": "",
        },
        "visa": {
            "document_type": "visa",
            "name": "",
            "visa_number": "",
            "visa_type": "",
            "entry_type": "",
            "valid_from": "",
            "valid_until": "",
            "stay_duration": "",
        },
        "aadhaar": {
            "document_type": "aadhaar",
            "name": "",
            "aadhaar_number": "",
            "date_of_birth": "",
            "gender": "",
            "address": "",
        },
        "driving_license": {
            "document_type": "driving_license",
            "name": "",
            "license_number": "",
            "date_of_birth": "",
            "date_of_issue": "",
            "date_of_expiry": "",
            "vehicle_classes": "",
            "address": "",
        },
        "permit": {
            "document_type": "permit",
            "name": "",
            "permit_number": "",
            "permit_type": "",
            "valid_from": "",
            "valid_until": "",
            "issuing_authority": "",
            "purpose": "",
        },
    }

    schema = schemas[normalized_type]

    prompt = f"""
You are an AI document information extraction system.

The uploaded document is a {normalized_type}.

Analyze the image carefully and extract only information that is
actually visible in the document.

Do not guess, infer, or invent information.
If a field cannot be read or is not present, return an empty string.

Return ONLY valid JSON.
Do not use markdown or explanations.

Use exactly this JSON structure:
{json.dumps(schema, indent=2)}
"""

    print(">>> Image received:", len(image_data), "bytes")
    print(">>> Sending request to Gemini")

    try:
        response = client.models.generate_content(
            model="gemini-3.6-flash",
            contents=[
                {
                    "inline_data": {
                        "mime_type": file.content_type or "image/jpeg",
                        "data": image_data,
                    }
                },
                prompt,
            ],
        )
    except Exception as e:
        print(">>> Gemini error:", repr(e))
        raise HTTPException(
            status_code=502,
            detail=f"AI service error: {str(e)}"
        )

    print(">>> Gemini response received")

    text = (response.text or "").strip()
    print(">>> AI response:")
    print(text)

    # Remove accidental markdown fences.
    if text.startswith("```"):
        text = text.replace("```json", "", 1)
        text = text.replace("```", "", 1).strip()

    try:
        result = json.loads(text)
    except json.JSONDecodeError:
        raise HTTPException(
            status_code=502,
            detail="AI returned invalid JSON."
        )

    # Force the normalized document type so extraction and validation agree.
    result["document_type"] = normalized_type

    return result


@app.post("/validate")
async def validate_document(data: dict):
    print(">>> Validation request received")
    print(">>> Extracted data:", data)

    try:
        with open(DATABASE_FILE, "r", encoding="utf-8") as f:
            database = json.load(f)
    except FileNotFoundError:
        return {
            "database_status": "ERROR",
            "document_status": "UNKNOWN",
            "message": "Database file not found.",
        }
    except json.JSONDecodeError:
        return {
            "database_status": "ERROR",
            "document_status": "UNKNOWN",
            "message": "Database JSON is invalid.",
        }

    document_type = str(data.get("document_type", "")).lower().strip()

    if document_type == "passport":
        number_field = "passport_number"
        records = database.get("passports", [])
        fields = [
            "name",
            "nationality",
            "date_of_birth",
            "gender",
            "date_of_issue",
            "date_of_expiry",
        ]
    elif document_type == "visa":
        number_field = "visa_number"
        records = database.get("visas", [])
        fields = [
            "name",
            "visa_type",
            "entry_type",
            "valid_from",
            "valid_until",
            "stay_duration",
        ]
    else:
        return {
            "database_status": "UNSUPPORTED",
            "document_status": "UNKNOWN",
            "message": f"Database validation for {document_type or 'this document'} is not implemented yet.",
            "matches": {},
            "mismatches": {},
        }

    document_number = str(data.get(number_field, "")).strip()

    if not document_number:
        return {
            "database_status": "NOT_FOUND",
            "document_status": "SUSPICIOUS",
            "message": f"{number_field.replace('_', ' ').title()} could not be extracted.",
            "matches": {},
            "mismatches": {},
        }

    record = next(
        (
            item for item in records
            if str(item.get(number_field, "")).strip().upper()
            == document_number.upper()
        ),
        None,
    )

    if not record:
        return {
            "database_status": "NOT_FOUND",
            "document_status": "SUSPICIOUS",
            "message": f"{document_type.title()} not found in central database.",
            "document_number": document_number,
            "matches": {},
            "mismatches": {},
        }

    matches = {}
    mismatches = {}

    for field in fields:
        extracted_value = str(data.get(field, "") or "").strip()
        database_value = str(record.get(field, "") or "").strip()

        if extracted_value.casefold() == database_value.casefold():
            matches[field] = {
                "extracted": extracted_value,
                "database": database_value,
            }
        else:
            mismatches[field] = {
                "extracted": extracted_value,
                "database": database_value,
            }

    document_status = "VERIFIED" if not mismatches else "SUSPICIOUS"

    return {
        "database_status": "FOUND",
        "document_status": document_status,
        "document_number": document_number,
        "matches": matches,
        "mismatches": mismatches,
        "database_record": record,
    }
