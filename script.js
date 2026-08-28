const fileInput = document.getElementById("fileInput");
const docType = document.getElementById("docType");
const preview = document.getElementById("preview");
const processBtn = document.getElementById("processBtn");
const status = document.getElementById("status");
const ocrResult = document.getElementById("ocrResult");

fileInput.addEventListener("change", () => {
    const file = fileInput.files[0];

    if (!file) return;

    const imageURL = URL.createObjectURL(file);
    preview.src = imageURL;
    preview.style.display = "block";
    status.textContent = "Document uploaded.";
});


processBtn.addEventListener("click", async () => {
    const file = fileInput.files[0];
    const type = docType.value;

    if (!file || !type) {

        status.textContent =
            "Upload document and select type.";

        return;
    }

    status.textContent = "AI is analyzing the document...";
    const formData = new FormData();
    formData.append("file", file);
    formData.append("document_type", type);


    try {
        const response = await fetch(
            "http://127.0.0.1:8000/extract",
            {
                method: "POST",
                body: formData
            }
        );


        if (!response.ok) {
            throw new Error(
                "Extraction server error: " + response.status);
        }




        const data =
            await response.json();
        console.log("AI Extraction:", data);
        displayData(data);


        status.textContent =
            "Verifying with central database...";


        const validationResponse =
            await fetch(
                "http://127.0.0.1:8000/validate",
                {
                    method: "POST",

                    headers: {
                        "Content-Type": "application/json"
                    },

                    body: JSON.stringify(data)
                }
            );


        if (!validationResponse.ok) {
            throw new Error("Validation server error: " + validationResponse.status);
        }

        const validation =
            await validationResponse.json();


        console.log("Database Validation:", validation);
        displayValidation(validation);
        status.textContent = "Verification completed.";


    } catch (error) {
        console.error(
            "Error:",
            error
        );

        status.textContent = "Failed to process document.";
    }
});



function displayData(data) {

    ocrResult.textContent = "";


    for (
        const [key, value]
        of Object.entries(data)
    ) {

        const label = key
            .replaceAll("_", " ")
            .replace(
                /\b\w/g,
                char => char.toUpperCase()
            );


        ocrResult.textContent += `${label}: ${value}\n`;
    }
}



function displayValidation(result) {
    ocrResult.textContent += "\n\n";
    ocrResult.textContent += "============================\n";
    ocrResult.textContent += "DATABASE VERIFICATION\n";
    ocrResult.textContent += "============================\n\n";
    ocrResult.textContent += `Database: ${result.database_status}\n`;
    ocrResult.textContent += `Status: ${result.document_status}\n`;

    if (result.message) {
        ocrResult.textContent += `Message: ${result.message}\n`;
    }


    if (
        result.matches &&
        Object.keys(result.matches).length > 0
    ) {

        ocrResult.textContent += "\nMATCHES:\n";
        for (
            const [field, values]
            of Object.entries(result.matches)
        ) {
            const label = field.replaceAll("_", " ");
            ocrResult.textContent += `✓ ${label}: ${values.extracted}\n`;
        }
    }


    if (
        result.mismatches &&
        Object.keys(result.mismatches).length > 0
    ) {

        ocrResult.textContent += "\nMISMATCHES:\n";
        for (
            const [field, values]
            of Object.entries(result.mismatches)
        ) {

            const label = field.replaceAll("_", " ");
            ocrResult.textContent += `✗ ${label}\n`;
            ocrResult.textContent += `  Document: ${values.extracted}\n`;
            ocrResult.textContent += `  Database: ${values.database}\n`;
        }
    }
}