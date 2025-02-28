document.addEventListener("DOMContentLoaded", () => {
    const gridContainer = document.getElementById("grid-container");
    const contextMenu = document.getElementById("context-menu");
    let selectedItem = null;

    // Handle right-click context menu
    gridContainer.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        const target = e.target.closest('[data-is-file]');
        if (!target) return;

        selectedItem = target;
        contextMenu.classList.remove('hidden');

        // Position context menu
        const { clientX, clientY } = e;
        const { innerWidth, innerHeight } = window;
        const menuRect = contextMenu.getBoundingClientRect();

        let left = clientX;
        let top = clientY;

        // Adjust position if near window edges
        if (clientX + menuRect.width > innerWidth) {
            left = innerWidth - menuRect.width - 10;
        }
        if (clientY + menuRect.height > innerHeight) {
            top = innerHeight - menuRect.height - 10;
        }

        contextMenu.style.left = `${left}px`;
        contextMenu.style.top = `${top}px`;
    });

    // Close context menu on click
    document.addEventListener('click', () => {
        contextMenu.classList.add('hidden');
    });

    // Handle download option
    document.getElementById("download-option").addEventListener("click", () => {
        if (!selectedItem) return;

        const url = selectedItem.getAttribute("data-url");
        const isFile = selectedItem.getAttribute("data-is-file") === "True";

        if (isFile) {
            // File download logic
            const link = document.createElement("a");
            link.href = url;
            link.download = url.split('/').pop();
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } else {
            // Folder download logic
            const pathParts = url.split('/');
            const uniqueId = pathParts[2]; // Extract root unique ID
            const downloadUrl = `/download-folder/${uniqueId}`;

            fetch(downloadUrl)
                .then(response => {
                    if (!response.ok) throw new Error('Download failed');
                    return response.blob();
                })
                .then(blob => {
                    const downloadUrl = URL.createObjectURL(blob);
                    const link = document.createElement("a");
                    link.href = downloadUrl;
                    link.download = `${uniqueId}.zip`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    URL.revokeObjectURL(downloadUrl);
                })
                .catch(error => {
                    console.error('Download error:', error);
                    alert('Error downloading folder. Please try again.');
                });
        }

        contextMenu.classList.add("hidden");
    });

    // Handle open option
    document.getElementById("open-option").addEventListener("click", () => {
        if (!selectedItem) return;
        window.location.href = selectedItem.getAttribute("data-url");
        contextMenu.classList.add("hidden");
    });

    // Handle double-click navigation
    gridContainer.addEventListener("dblclick", (e) => {
        const target = e.target.closest('[data-is-file]');
        if (!target) return;

        const isFile = target.getAttribute("data-is-file") === "True";
        const url = target.getAttribute("data-url");

        if (isFile) {
            // Open file in new tab
            window.open(url, '_blank');
        } else {
            // Navigate to folder
            window.location.href = url;
        }
    });

    // Close context menu on scroll
    window.addEventListener('scroll', () => {
        contextMenu.classList.add('hidden');
    }, true);
});