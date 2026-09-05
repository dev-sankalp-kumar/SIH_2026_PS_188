const dropZone = document.getElementById("dropZone");
const fileInput = document.getElementById("fileInput");
const preview = document.getElementById("preview");
const previewBox = document.getElementById("previewBox");
const processBtn = document.getElementById("processBtn");
const status = document.getElementById("status");
const ocrResult = document.getElementById("ocrResult");
const docButtons = document.querySelectorAll(".doc-btn");

// Store files and previews independently for each document type
const documentData = {
    "Passport": { file: null, previewUrl: "" },
    "Visa": { file: null, previewUrl: "" },
    "Aadhaar": { file: null, previewUrl: "" },
    "Driving Licence": { file: null, previewUrl: "" },
    "Permit": { file: null, previewUrl: "" }
};

let currentDocType = "Driving Licence"; // Default active type

// Handle clicking the upload box to open file dialog
dropZone.addEventListener("click", () => {
    fileInput.click();
});

// Handle switching between document type buttons
docButtons.forEach(button => {
    button.addEventListener("click", () => {
        docButtons.forEach(btn => btn.classList.remove("active"));
        button.classList.add("active");
        
        currentDocType = button.getAttribute("data-value");
        
        // Restore the specific preview and status for this document type
        const savedData = documentData[currentDocType];
        if (savedData.file) {
            preview.src = savedData.previewUrl;
            previewBox.style.display = "block";
            status.textContent = `${currentDocType} document loaded.`;
            status.style.color = "#38bdf8";
        } else {
            preview.src = "";
            previewBox.style.display = "none";
            status.textContent = `Please upload your ${currentDocType}.`;
            status.style.color = "#94a3b8";
        }
    });
});

// Handle file selection and save it ONLY to the current active document type
fileInput.addEventListener("change", () => {
    const file = fileInput.files[0];
    if (!file) return;

    const imageURL = URL.createObjectURL(file);
    
    // Save state for this specific document type
    documentData[currentDocType].file = file;
    documentData[currentDocType].previewUrl = imageURL;

    // Update UI preview
    preview.src = imageURL;
    previewBox.style.display = "block";
    status.textContent = `${currentDocType} uploaded successfully.`;
    status.style.color = "#38bdf8";
    
    // Reset file input so selecting the same file again triggers change if needed
    fileInput.value = "";
});

// Process the specific file tied to the currently selected document type
processBtn.addEventListener("click", async () => {
    const currentFile = documentData[currentDocType].file;

    if (!currentFile) {
        status.textContent = `Please upload a ${currentDocType} first.`;
        status.style.color = "#f87171";
        return;
    }

    status.textContent = `Analyzing ${currentDocType}...`;
    status.style.color = "#38bdf8";
    ocrResult.textContent = "";

    const formData = new FormData();
    formData.append("file", currentFile);
    formData.append("document_type", currentDocType);

    try {
        const response = await fetch("http://127.0.0.1:8000/extract", {
            method: "POST",
            body: formData
        });

        if (!response.ok) {
            throw new Error("Extraction server error: " + response.status);
        }

        const data = await response.json();
        displayData(data, currentDocType);

        status.textContent = "Verifying with central database...";

        const validationResponse = await fetch("http://127.0.0.1:8000/validate", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(data)
        });

        if (!validationResponse.ok) {
            throw new Error("Validation server error: " + validationResponse.status);
        }

        const validation = await validationResponse.json();
        displayValidation(validation);
        status.textContent = "Verification completed.";
        status.style.color = "#4ade80";

    } catch (error) {
        console.error("Error:", error);
        status.textContent = `Failed to process document: ${error.message}`;
        status.style.color = "#f87171";
    }
});

function displayData(data, type) {
    ocrResult.textContent = `=== ${type.toUpperCase()} EXTRACTION ===\n`;
    for (const [key, value] of Object.entries(data)) {
        const label = key
            .replaceAll("_", " ")
            .replace(/\b\w/g, char => char.toUpperCase());
        ocrResult.textContent += `${label}: ${value}\n`;
    }
}

function displayValidation(result) {
    ocrResult.textContent += "\n============================\n";
    ocrResult.textContent += "DATABASE VERIFICATION\n";
    ocrResult.textContent += "============================\n\n";
    ocrResult.textContent += `Database: ${result.database_status}\n`;
    ocrResult.textContent += `Status: ${result.document_status}\n`;

    if (result.message) {
        ocrResult.textContent += `Message: ${result.message}\n`;
    }

    if (result.matches && Object.keys(result.matches).length > 0) {
        ocrResult.textContent += "\nMATCHES:\n";
        for (const [field, values] of Object.entries(result.matches)) {
            const label = field.replaceAll("_", " ");
            ocrResult.textContent += `✓ ${label}: ${values.extracted}\n`;
        }
    }

    if (result.mismatches && Object.keys(result.mismatches).length > 0) {
        ocrResult.textContent += "\nMISMATCHES:\n";
        for (const [field, values] of Object.entries(result.mismatches)) {
            const label = field.replaceAll("_", " ");
            ocrResult.textContent += `✗ ${label}\n`;
            ocrResult.textContent += `   Document: ${values.extracted}\n`;
            ocrResult.textContent += `   Database: ${values.database}\n`;
        }
    }
}