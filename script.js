const fileInput = document.getElementById("fileInput");
let selectedDocumentType = "";
const dropZone = document.getElementById("dropZone");
const uploadContent = document.getElementById("uploadContent");
const previewBox = document.getElementById("previewBox");
const docButtons = document.querySelectorAll(".doc-btn");
const preview = document.getElementById("preview");
const processBtn = document.getElementById("processBtn");
const status = document.getElementById("status");
const ocrResult = document.getElementById("ocrResult");


// -----------------------------
// Document preview
// -----------------------------
fileInput.addEventListener("change", () => {
    const file = fileInput.files[0];

    if (!file) {
        dropZone.classList.remove("has-file");
        previewBox.style.display = "none";
        return;
    }

    const imageURL = URL.createObjectURL(file);

    preview.src = imageURL;
    dropZone.classList.add("has-file");
    previewBox.style.display = "flex";

    status.textContent = "Document uploaded.";
    ocrResult.textContent = "";
    ocrResult.style.display = "none";
});


// -----------------------------
// Process document
// -----------------------------
processBtn.addEventListener("click", async () => {
    const file = fileInput.files[0];
    const type = selectedDocumentType;

    if (!file || !type) {
        status.textContent = "Upload document and select type.";
        return;
    }

    processBtn.disabled = true;
    processBtn.textContent = "Processing...";
    status.textContent = "AI is analyzing the document...";
    ocrResult.textContent = "";
    ocrResult.style.display = "none";

    const formData = new FormData();
    formData.append("file", file);
    formData.append("document_type", type);

    try {
        // MODULE 1: AI extraction
        const response = await fetch(
            "http://127.0.0.1:8000/extract",
            {
                method: "POST",
                body: formData
            }
        );

        const data = await getResponseData(response);

        console.log("AI Extraction:", data);

        // Show extracted information in the teammate's result area.
        displayExtraction(data);

        // MODULE 2: database validation
        status.textContent = "Verifying with central database...";

        const validationResponse = await fetch(
            "http://127.0.0.1:8000/validate",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(data)
            }
        );

        const validation = await getResponseData(validationResponse);

        console.log("Database Validation:", validation);

        // Add verification information below extraction.
        displayValidation(validation);

        status.textContent =
            validation.document_status === "VERIFIED"
                ? "Document verified successfully."
                : "Verification completed. Review the result.";

    } catch (error) {
        console.error("Processing error:", error);
        status.textContent = error.message || "Failed to process document.";
        ocrResult.textContent =
            "Unable to process the document.\n\n" +
            "Check that the FastAPI server is running.";
    } finally {
        processBtn.disabled = false;
        processBtn.textContent = "Process Document";
    }
});


// -----------------------------
// Read API response safely
// -----------------------------
async function getResponseData(response) {
    const text = await response.text();

    let data;

    try {
        data = JSON.parse(text);
    } catch {
        throw new Error(
            `Server returned an invalid response (${response.status}).`
        );
    }

    if (!response.ok) {
        throw new Error(
            data.detail || `Server error: ${response.status}`
        );
    }

    return data;
}


// -----------------------------
// MODULE 1 result
// -----------------------------
function displayExtraction(data) {
    const labels = {
        document_type: "Document Type",
        name: "Name",
        passport_number: "Passport No",
        nationality: "Nationality",
        date_of_birth: "DOB",
        gender: "Gender",
        date_of_issue: "Issue",
        date_of_expiry: "Expiry",

        visa_number: "Visa Number",
        visa_type: "Visa Type",
        entry_type: "Entry Type",
        valid_from: "Valid From",
        valid_until: "Valid Until",
        stay_duration: "Stay Duration",

        aadhaar_number: "Aadhaar Number",
        license_number: "License Number",
        vehicle_classes: "Vehicle Classes",
        address: "Address",

        permit_number: "Permit Number",
        permit_type: "Permit Type",
        issuing_authority: "Issuing Authority",
        purpose: "Purpose"
    };

    let output = "EXTRACTED INFORMATION\n";
    output += "============================\n\n";

    for (const [key, value] of Object.entries(data)) {
        const label = labels[key] || formatLabel(key);
        output += `${label}: ${value || "—"}\n`;
    }

    ocrResult.textContent = output;
    ocrResult.style.display = "block";
}


// -----------------------------
// MODULE 2 result
// -----------------------------
function displayValidation(result) {
    ocrResult.style.display = "block";
    ocrResult.textContent +=
        "\n\nDATABASE VERIFICATION\n" +
        "============================\n\n";

    ocrResult.textContent +=
        `Database: ${result.database_status || "—"}\n`;

    ocrResult.textContent +=
        `Status: ${result.document_status || "—"}\n`;

    if (result.document_number) {
        ocrResult.textContent +=
            `Document Number: ${result.document_number}\n`;
    }

    if (result.message) {
        ocrResult.textContent +=
            `Message: ${result.message}\n`;
    }

    if (
        result.matches &&
        Object.keys(result.matches).length > 0
    ) {
        ocrResult.textContent += "\nMATCHES\n";

        for (const [field, values] of Object.entries(result.matches)) {
            ocrResult.textContent +=
                `✓ ${formatLabel(field)}: ${values.extracted || "—"}\n`;
        }
    }

    if (
        result.mismatches &&
        Object.keys(result.mismatches).length > 0
    ) {
        ocrResult.textContent += "\nMISMATCHES\n";

        for (const [field, values] of Object.entries(result.mismatches)) {
            ocrResult.textContent +=
                `✗ ${formatLabel(field)}\n` +
                `  Document: ${values.extracted || "—"}\n` +
                `  Database: ${values.database || "—"}\n`;
        }
    }

    if (
        result.database_record &&
        Object.keys(result.database_record).length > 0
    ) {
        ocrResult.textContent +=
            "\nCENTRAL DATABASE RECORD\n";

        for (const [field, value] of Object.entries(result.database_record)) {
            ocrResult.textContent +=
                `${formatLabel(field)}: ${value || "—"}\n`;
        }
    }
}


// -----------------------------
// Utility
// -----------------------------
function formatLabel(key) {
    return key
        .replaceAll("_", " ")
        .replace(/\b\w/g, char => char.toUpperCase());
}


// -----------------------------
// Document type selection
// -----------------------------
docButtons.forEach(button => {
    button.addEventListener("click", () => {
        docButtons.forEach(btn => btn.classList.remove("active"));
        button.classList.add("active");
        selectedDocumentType = button.dataset.value;
        status.textContent = `${selectedDocumentType} selected.`;
    });
});

// Clicking the upload area opens the file picker.
dropZone.addEventListener("click", () => {
    fileInput.click();
});
