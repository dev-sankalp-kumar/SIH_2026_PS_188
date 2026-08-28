import os
import json
from pathlib import Path

from fastapi import FastAPI, UploadFile, File, Form
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
    print(">>> Image received:", len(image_data), "bytes")



    prompt = f"""
You are an AI document information extraction system.

The user has uploaded a {document_type} document.

Analyze the image carefully.

Extract ONLY information that is actually visible
in the document.

Do not guess or invent information.

If a field cannot be read or is not present,
return an empty string.

Return ONLY valid JSON.
Do not include markdown.
Do not include explanations.

Use the following JSON structure according
to the document type.

PASSPORT:

{{
    "document_type": "passport",
    "name": "",
    "passport_number": "",
    "nationality": "",
    "date_of_birth": "",
    "gender": "",
    "date_of_issue": "",
    "date_of_expiry": ""
}}

VISA:

{{
    "document_type": "visa",
    "name": "",
    "visa_number": "",
    "visa_type": "",
    "entry_type": "",
    "valid_from": "",
    "valid_until": "",
    "stay_duration": ""
}}

AADHAAR:

{{
    "document_type": "aadhaar",
    "name": "",
    "aadhaar_number": "",
    "date_of_birth": "",
    "gender": "",
    "address": ""
}}

DRIVING LICENSE:

{{
    "document_type": "driving_license",
    "name": "",
    "license_number": "",
    "date_of_birth": "",
    "date_of_issue": "",
    "date_of_expiry": "",
    "vehicle_classes": "",
    "address": ""
}}

PERMIT:

{{
    "document_type": "permit",
    "name": "",
    "permit_number": "",
    "permit_type": "",
    "valid_from": "",
    "valid_until": "",
    "issuing_authority": "",
    "purpose": ""
}}

The selected document type is:

{document_type}
"""


    print(">>> Sending request to Gemini")

    response = client.models.generate_content(
        model="gemini-3.6-flash",
        contents=[
            {
                "inline_data": {
                    "mime_type": file.content_type,
                    "data": image_data
                }
            },
            prompt
        ]
    )


    print(">>> Gemini response received")
    text = response.text

    print(">>> AI response:")
    print(text)
    text = text.replace("```json", "")
    text = text.replace("```", "")
    text = text.strip()

    return json.loads(text)


@app.post("/validate")
async def validate_document(data: dict):

    print(">>> Validation request received")

    print(">>> Extracted data:")
    print(data)

    try:

        with open(
            DATABASE_FILE,
            "r",
            encoding="utf-8"
        ) as f:

            database = json.load(f)

    except FileNotFoundError:

        return {
            "database_status": "ERROR",
            "document_status": "UNKNOWN",
            "message": "Database file not found."
        }

    except json.JSONDecodeError:

        return {
            "database_status": "ERROR",
            "document_status": "UNKNOWN",
            "message": "Database JSON is invalid."
        }

    document_type = (
        data.get("document_type", "")
        .lower()
        .strip()
    )

    if document_type == "passport":

        passport_number = (
            data.get("passport_number", "")
            .strip()
        )

        records = database.get(
            "passports",
            []
        )

        record = next(
            (
                item
                for item in records
                if item.get("passport_number", "").upper()
                == passport_number.upper()
            ),
            None
        )

        if not record:

            return {
                "database_status": "NOT_FOUND",
                "document_status": "SUSPICIOUS",
                "message": "Passport not found in central database.",
                "matches": {},
                "mismatches": {}
            }

        fields = [
            "name",
            "nationality",
            "date_of_birth",
            "gender",
            "date_of_issue",
            "date_of_expiry"
        ]


    elif document_type == "visa":

        visa_number = (
            data.get("visa_number", "")
            .strip()
        )

        records = database.get(
            "visas",
            []
        )


        record = next(
            (
                item
                for item in records
                if item.get("visa_number", "").upper()
                == visa_number.upper()
            ),
            None
        )


        if not record:

            return {
                "database_status": "NOT_FOUND",
                "document_status": "SUSPICIOUS",
                "message": "Visa not found in central database.",
                "matches": {},
                "mismatches": {}
            }


        fields = [
            "name",
            "visa_type",
            "entry_type",
            "valid_from",
            "valid_until",
            "stay_duration"
        ]



    else:

        return {
            "database_status": "UNSUPPORTED",
            "document_status": "UNKNOWN",
            "message": (
                "This document type is not "
                "supported by the database yet."
            )
        }


    matches = {}
    mismatches = {}


    for field in fields:

        extracted_value = str(
            data.get(field, "")
        ).strip()

        database_value = str(
            record.get(field, "")
        ).strip()


        if (
            extracted_value.upper()
            == database_value.upper()
        ):

            matches[field] = {
                "extracted": extracted_value,
                "database": database_value
            }

        else:

            mismatches[field] = {
                "extracted": extracted_value,
                "database": database_value
            }


    if len(mismatches) == 0:

        document_status = "VERIFIED"

    else:

        document_status = "SUSPICIOUS"


    return {

        "database_status": "FOUND",

        "document_status": document_status,

        "document_number": (
            data.get("passport_number")
            or data.get("visa_number")
            or ""
        ),

        "matches": matches,

        "mismatches": mismatches,

        "database_record": record
    }