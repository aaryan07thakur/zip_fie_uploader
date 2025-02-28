document.addEventListener("DOMContentLoaded", () => {
    // Handle "No HTML File Found" modal
    const noHtmlModal = document.getElementById("noHtmlModal");
    const overlay = document.getElementById("overlay");

    

    if (noHtmlModal) {
        function closeModal() {
            noHtmlModal.style.display = "none";
            overlay.style.display = "none";
        }

        document.querySelector("#noHtmlModal button").addEventListener("click", closeModal);
    }
    // Select the button by its ID
    const webpageBtn = document.getElementById("webpage-btn");

    // Add a click event listener to the button
    webpageBtn.addEventListener("click", function (event) {
        // Get the href attribute value
        const webpageUrl = this.getAttribute("href");

        // Check if the URL is None or empty
        if (!webpageUrl || webpageUrl === "None") {
            // Prevent the default navigation behavior
            event.preventDefault();

            // Display the message
            alert("NO index.html file");
        }
    });
});
