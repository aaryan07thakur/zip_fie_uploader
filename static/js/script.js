document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("uploadForm");
    const fileInput = document.getElementById("fileInput");
    const messageDiv = document.getElementById("message");
    const fileNameDiv = document.getElementById("fileName");

    // Display selected file name
    fileInput.addEventListener("change", () => {
        if (fileInput.files.length > 0) {
            fileNameDiv.textContent = `Selected File: ${fileInput.files[0].name}`;
            messageDiv.textContent = "";
        }
    });

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (!fileInput.files.length) {
            messageDiv.textContent = "❌ Please select a file before uploading.";
            return;
        }

        const file = fileInput.files[0];

        // Validate file type (Only .zip allowed)
        if (!file.name.endsWith(".zip")) {
            messageDiv.textContent = "❌ Only .zip files are allowed!";
            return;
        }

        const formData = new FormData();
        formData.append("file", file);

        try {
            // Reset UI
            messageDiv.textContent = "Uploading file...";

            // Upload file
            const response = await fetch("/upload", {
                method: "POST",
                body: formData,
            });

            if (response.redirected) {
                window.location.href = response.url; // Redirect to result page
            } else {
                const data = await response.json();
                messageDiv.textContent = "✅ File uploaded successfully!";
            }
        } catch (error) {
            messageDiv.textContent = "❌ Error uploading file. Please try again.";
        }
    });
});
