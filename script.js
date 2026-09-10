const API_URL = "https://sih-2026-ps-188.onrender.com";

const fileInput = document.getElementById("fileInput");
const dropZone = document.getElementById("dropZone");
const previewBox = document.getElementById("previewBox");
const preview = document.getElementById("preview");
const processBtn = document.getElementById("processBtn");
const status = document.getElementById("status");
const ocrResult = document.getElementById("ocrResult");

const docButtons = document.querySelectorAll(".doc-btn");

let selectedDocumentType = "";


// ==========================================
// MOVE PREVIEW IMAGE INSIDE UPLOAD BOX
// ==========================================

if (preview) {
    dropZone.appendChild(preview);
}


// ==========================================
// DOCUMENT TYPE SELECTION
// ==========================================

docButtons.forEach(button => {

    button.addEventListener("click", () => {

        docButtons.forEach(btn => {
            btn.classList.remove("active");
        });

        button.classList.add("active");

        selectedDocumentType = button.dataset.value;

        status.textContent =
            `${selectedDocumentType} selected.`;

        status.className = "";

        // Hide previous result
        ocrResult.style.display = "none";
        ocrResult.innerHTML = "";
    });

});


// ==========================================
// CLICK UPLOAD BOX
// ==========================================

dropZone.addEventListener("click", () => {
    fileInput.click();
});


// Prevent clicking the file input from triggering
// the dropZone click again
fileInput.addEventListener("click", (event) => {
    event.stopPropagation();
});


// ==========================================
// SHOW IMAGE PREVIEW
// ==========================================

function showPreview(file) {

    if (!file) {
        return;
    }

    if (!file.type.startsWith("image/")) {

        status.textContent =
            "Please upload an image file.";

        status.className =
            "status-danger";

        return;
    }

    const imageURL =
        URL.createObjectURL(file);

    preview.src = imageURL;

    preview.style.display = "block";

    // This tells CSS that an image exists
    dropZone.classList.add("has-file");

    status.textContent =
        "Document uploaded.";

    status.className = "";

    // Hide previous result
    ocrResult.style.display = "none";
    ocrResult.innerHTML = "";
}


// ==========================================
// FILE SELECTION
// ==========================================

fileInput.addEventListener("change", () => {

    const file = fileInput.files[0];

    if (!file) {
        return;
    }

    showPreview(file);
});


// ==========================================
// DRAG AND DROP
// ==========================================

dropZone.addEventListener("dragover", (event) => {

    event.preventDefault();

    dropZone.classList.add("dragging");
});


dropZone.addEventListener("dragleave", () => {

    dropZone.classList.remove("dragging");
});


dropZone.addEventListener("drop", (event) => {

    event.preventDefault();

    dropZone.classList.remove("dragging");

    const file =
        event.dataTransfer.files[0];

    if (!file) {
        return;
    }

    if (!file.type.startsWith("image/")) {

        status.textContent =
            "Please upload an image file.";

        status.className =
            "status-danger";

        return;
    }

    // Put dropped file into file input
    const dataTransfer =
        new DataTransfer();

    dataTransfer.items.add(file);

    fileInput.files =
        dataTransfer.files;

    showPreview(file);
});


// ==========================================
// PROCESS DOCUMENT
// ==========================================

processBtn.addEventListener("click", async () => {

    const file =
        fileInput.files[0];

    if (!file || !selectedDocumentType) {

        status.textContent =
            "Upload a document and select its type.";

        status.className =
            "status-danger";

        return;
    }


    processBtn.disabled = true;

    processBtn.textContent =
        "Processing...";

    status.textContent =
        "AI is analyzing the document...";

    status.className = "";


    // Hide old result
    ocrResult.style.display = "none";
    ocrResult.innerHTML = "";


    const formData =
        new FormData();

    formData.append(
        "file",
        file
    );

    formData.append(
        "document_type",
        selectedDocumentType
    );


    try {

        // ======================================
        // MODULE 1
        // AI DOCUMENT EXTRACTION
        // ======================================

        const response =
            await fetch(
                `${API_URL}/extract`,
                {
                    method: "POST",
                    body: formData
                }
            );


        const data =
            await getResponseData(response);


        console.log(
            "AI Extraction:",
            data
        );


        displayExtraction(data);


        // ======================================
        // MODULE 2
        // DATABASE VERIFICATION
        // ======================================

        status.textContent =
            "Verifying with central database...";


        const validationResponse =
            await fetch(
                `${API_URL}/validate`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify(data)
                }
            );


        const validation =
            await getResponseData(
                validationResponse
            );


        console.log(
            "Database Validation:",
            validation
        );


        displayValidation(validation);


        // ======================================
        // FINAL STATUS
        // ======================================

        if (
            validation.document_status ===
            "VERIFIED"
        ) {

            status.textContent =
                "Document verified successfully.";

            status.className =
                "status-success";

        }
        else if (
            validation.document_status ===
            "SUSPICIOUS"
        ) {

            status.textContent =
                "Document requires further review.";

            status.className =
                "status-danger";

        }
        else {

            status.textContent =
                "Verification completed.";

            status.className = "";
        }


    }
    catch (error) {

        console.error(
            "Processing error:",
            error
        );


        status.textContent =
            error.message ||
            "Failed to process document.";

        status.className =
            "status-danger";


        ocrResult.style.display =
            "block";


        ocrResult.innerHTML = `

            <div class="result-header">

                <div class="result-title">

                    <h2>Screening Result</h2>

                    <p>Processing Error</p>

                </div>

                <span class="status-badge suspicious">
                    ERROR
                </span>

            </div>

            <div class="result-error">
                ${escapeHTML(
                    error.message ||
                    "Unable to process the document."
                )}
            </div>

        `;
    }


    finally {

        processBtn.disabled =
            false;

        processBtn.textContent =
            "START PROCESSING";
    }
});


// ==========================================
// READ API RESPONSE
// ==========================================

async function getResponseData(response) {

    const text =
        await response.text();

    let data;


    try {

        data =
            JSON.parse(text);

    }
    catch {

        throw new Error(
            `Server returned an invalid response (${response.status}).`
        );
    }


    if (!response.ok) {

        throw new Error(
            data.detail ||
            `Server error: ${response.status}`
        );
    }


    return data;
}


// ==========================================
// MODULE 1
// EXTRACTED INFORMATION
// ==========================================

function displayExtraction(data) {

    const labels = {

        document_type:
            "Document Type",

        name:
            "Name",

        passport_number:
            "Passport Number",

        nationality:
            "Nationality",

        date_of_birth:
            "Date of Birth",

        gender:
            "Gender",

        date_of_issue:
            "Date of Issue",

        date_of_expiry:
            "Date of Expiry",

        visa_number:
            "Visa Number",

        visa_type:
            "Visa Type",

        entry_type:
            "Entry Type",

        valid_from:
            "Valid From",

        valid_until:
            "Valid Until",

        stay_duration:
            "Stay Duration",

        aadhaar_number:
            "Aadhaar Number",

        license_number:
            "License Number",

        vehicle_classes:
            "Vehicle Classes",

        address:
            "Address",

        permit_number:
            "Permit Number",

        permit_type:
            "Permit Type",

        issuing_authority:
            "Issuing Authority",

        purpose:
            "Purpose"
    };


    let informationHTML = "";


    for (
        const [key, value]
        of Object.entries(data)
    ) {

        if (key === "document_type") {
            continue;
        }


        const label =
            labels[key] ||
            formatLabel(key);


        informationHTML += `

            <div class="info-item">

                <span class="info-label">
                    ${escapeHTML(label)}
                </span>

                <span class="info-value">
                    ${escapeHTML(
                        value || "—"
                    )}
                </span>

            </div>

        `;
    }


    const documentType =
        data.document_type ||
        selectedDocumentType ||
        "Document";


    ocrResult.style.display =
        "block";


    ocrResult.innerHTML = `

        <div class="result-header">

            <div class="result-title">

                <h2>
                    Screening Result
                </h2>

                <p>
                    ${escapeHTML(
                        formatLabel(
                            documentType
                        )
                    )} Analysis
                </p>

            </div>

            <span class="status-badge unknown">
                ANALYZING
            </span>

        </div>


        <div class="result-section">

            <div class="result-section-title">
                Extracted Information
            </div>

            <div class="info-grid">

                ${informationHTML}

            </div>

        </div>

    `;
}


// ==========================================
// MODULE 2
// DATABASE VERIFICATION
// ==========================================

function displayValidation(result) {

    const documentStatus =
        result.document_status ||
        "UNKNOWN";


    let badgeClass =
        "unknown";


    if (
        documentStatus ===
        "VERIFIED"
    ) {

        badgeClass =
            "verified";
    }


    if (
        documentStatus ===
        "SUSPICIOUS"
    ) {

        badgeClass =
            "suspicious";
    }


    const databaseStatus =
        result.database_status ||
        "—";


    let matchesHTML = "";


    if (
        result.matches &&
        Object.keys(result.matches).length > 0
    ) {

        for (
            const [field]
            of Object.entries(
                result.matches
            )
        ) {

            matchesHTML += `

                <div class="match-item">

                    <span class="match-icon">
                        ✓
                    </span>

                    <span>
                        ${escapeHTML(
                            formatLabel(field)
                        )}
                    </span>

                </div>

            `;
        }
    }


    let mismatchesHTML = "";


    if (
        result.mismatches &&
        Object.keys(result.mismatches).length > 0
    ) {

        for (
            const [field, values]
            of Object.entries(
                result.mismatches
            )
        ) {

            mismatchesHTML += `

                <div class="mismatch-item">

                    <div class="mismatch-field">

                        <span class="mismatch-icon">
                            ✕
                        </span>

                        <span>
                            ${escapeHTML(
                                formatLabel(field)
                            )}
                        </span>

                    </div>


                    <div class="comparison-values">

                        <div class="comparison-value">

                            <span>
                                Document
                            </span>

                            ${escapeHTML(
                                values.extracted ||
                                "—"
                            )}

                        </div>


                        <div class="comparison-value">

                            <span>
                                Database
                            </span>

                            ${escapeHTML(
                                values.database ||
                                "—"
                            )}

                        </div>

                    </div>

                </div>

            `;
        }
    }


    let messageHTML = "";


    if (result.message) {

        messageHTML = `

            <div class="result-section">

                <div class="result-section-title">
                    Verification Summary
                </div>

                <div class="result-message">
                    ${escapeHTML(
                        result.message
                    )}
                </div>

            </div>

        `;
    }


    const matchCount =
        result.matches
            ? Object.keys(
                result.matches
              ).length
            : 0;


    const mismatchCount =
        result.mismatches
            ? Object.keys(
                result.mismatches
              ).length
            : 0;


    const verificationHTML = `

        <div class="result-section">

            <div class="result-section-title">
                Database Verification
            </div>

            <div class="verification-box">

                <div class="verification-row">

                    <span class="verification-label">
                        Database Status
                    </span>

                    <span class="verification-value">
                        ${escapeHTML(
                            databaseStatus
                        )}
                    </span>

                </div>


                <div class="verification-row">

                    <span class="verification-label">
                        Verification Status
                    </span>

                    <span class="
                        verification-value
                        ${badgeClass}
                    ">
                        ${escapeHTML(
                            documentStatus
                        )}
                    </span>

                </div>

            </div>

        </div>

    `;


    let comparisonHTML = "";


    if (matchCount > 0) {

        comparisonHTML += `

            <div class="result-section">

                <div class="result-section-title">
                    Matching Fields (${matchCount})
                </div>

                <div class="match-list">
                    ${matchesHTML}
                </div>

            </div>

        `;
    }


    if (mismatchCount > 0) {

        comparisonHTML += `

            <div class="result-section">

                <div class="result-section-title">
                    Mismatched Fields (${mismatchCount})
                </div>

                <div class="mismatch-list">
                    ${mismatchesHTML}
                </div>

            </div>

        `;
    }


    const headerBadge =
        ocrResult.querySelector(
            ".status-badge"
        );


    if (headerBadge) {

        headerBadge.className =
            `status-badge ${badgeClass}`;

        headerBadge.textContent =
            documentStatus;
    }


    ocrResult.insertAdjacentHTML(
        "beforeend",
        verificationHTML +
        messageHTML +
        comparisonHTML
    );
}


// ==========================================
// FORMAT LABEL
// ==========================================

function formatLabel(key) {

    return String(key)
        .replaceAll("_", " ")
        .replace(
            /\b\w/g,
            char => char.toUpperCase()
        );
}


// ==========================================
// SECURITY: ESCAPE HTML
// ==========================================

function escapeHTML(value) {

    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}