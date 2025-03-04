document.addEventListener('DOMContentLoaded', function() {
    // Global state
    let currentUniqueId = null;
    let currentPath = '';
    let selectedFile = null;

    // DOM Elements
    const uploadSection = document.getElementById('upload-section');
    const resultsSection = document.getElementById('results-section');
    const explorerSection = document.getElementById('explorer-section');
    const previewSection = document.getElementById('preview-section');
    const previousUploadSection = document.getElementById('previous-upload-section')

    const uploadForm = document.getElementById('upload-form');
    const fileInput = document.getElementById('file-input');
    const browseButton = document.getElementById('browse-button');
    const selectedFileDiv = document.getElementById('selected-file');
    const fileNameSpan = document.getElementById('file-name');
    const removeFileButton = document.getElementById('remove-file');
    const uploadButton = document.getElementById('upload-button');
    const uploadProgress = document.getElementById('upload-progress');
    const uploadError = document.getElementById('upload-error');

    const resultId = document.getElementById('result-id');
    const resultFilename = document.getElementById('result-filename');
    const viewFilesBtn = document.getElementById('view-files-btn');
    const downloadZipBtn = document.getElementById('download-zip-btn');
    const viewWebpageBtn = document.getElementById('view-webpage-btn');
    const uploadNewBtn = document.getElementById('upload-new-btn');

    const backToResults = document.getElementById('back-to-results');
    const backToExplorer = document.getElementById('back-to-explorer');
    const breadcrumb = document.getElementById('breadcrumb');
    const fileLoading = document.getElementById('file-loading');
    const fileList = document.getElementById('file-list');

    const previewTitle = document.getElementById('preview-title');
    const previewContent = document.getElementById('preview-content');

    const retrieveForm = document.getElementById('retrieve-form');
    const retrieveError = document.getElementById('retrieve-error');

    // Event Listeners
    browseButton.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            selectedFile = e.target.files[0];
            if (!selectedFile.name.toLowerCase().endsWith('.zip')) {
                showError('Please select a ZIP file');
                selectedFile = null;
                fileInput.value = '';
                return;
            }
            fileNameSpan.textContent = selectedFile.name;
            selectedFileDiv.classList.remove('hidden');
            uploadButton.disabled = false;
        }
    });

    removeFileButton.addEventListener('click', () => {
        selectedFile = null;
        fileInput.value = '';
        selectedFileDiv.classList.add('hidden');
        uploadButton.disabled = true;
    });

    uploadForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!selectedFile) return;

        uploadProgress.classList.remove('hidden');
        uploadError.classList.add('hidden');
        uploadButton.disabled = true;

        const formData = new FormData();
        formData.append('file', selectedFile);

        try {
            const response = await fetch('/zip-uploader/upload', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Upload failed');
            }

            // For this SPA version, we expect a JSON response instead of redirect
            const data = await response.json();
            currentUniqueId = data.unique_id;

            // Update result section
            resultId.textContent = data.unique_id;
            resultFilename.textContent = data.filename;
            downloadZipBtn.href = `/zip-uploader/download/${data.unique_id}`;

            if (data.webpage_url) {
                viewWebpageBtn.href = data.webpage_url;
                viewWebpageBtn.onclick = null; // Remove any previous click handlers
            } else {
                viewWebpageBtn.href = "#"; // Empty href
                // Add click handler to show popup message
                viewWebpageBtn.onclick = function(e) {
                    e.preventDefault(); // Prevent default link behavior
                    showAlert("No index.html file was found in the ZIP archive. A valid HTML file is required to view as a webpage.");
                };
            }

            viewWebpageBtn.classList.remove('hidden');
            // Switch to results section
            uploadSection.classList.add('hidden');
            previousUploadSection.classList.add('hidden');
            resultsSection.classList.remove('hidden');

            // Reset upload form
            selectedFile = null;
            fileInput.value = '';
            selectedFileDiv.classList.add('hidden');

        } catch (error) {
            showError(error.message);
        } finally {
            uploadProgress.classList.add('hidden');
            uploadButton.disabled = false;
        }
    });

    viewFilesBtn.addEventListener('click', () => {
        if (currentUniqueId) {
            resultsSection.classList.add('hidden');
            explorerSection.classList.remove('hidden');
            currentPath = '';
            loadFiles(currentUniqueId, currentPath);
        }
    });

    uploadNewBtn.addEventListener('click', () => {
        resultsSection.classList.add('hidden');
        uploadSection.classList.remove('hidden');
        previousUploadSection.classList.remove('hidden');
        uploadButton.disabled = true;
    });

    backToResults.addEventListener('click', () => {
        explorerSection.classList.add('hidden');
        resultsSection.classList.remove('hidden');
        currentPath = '';
    });

    backToExplorer.addEventListener('click', () => {
        previewSection.classList.add('hidden');
        explorerSection.classList.remove('hidden');
    });

    // Add context menu functionality
    const contextMenu = document.getElementById('context-menu');
    const contextOpen = document.getElementById('context-open');
    const contextNewTab = document.getElementById('context-new-tab');
    const contextDownload = document.getElementById('context-download');
    let activeItem = null;

    function showContextMenu(e, item) {
        // Store the active item for reference
        activeItem = item;

        // Position the context menu
        contextMenu.style.top = `${e.pageY}px`;
        contextMenu.style.left = `${e.pageX}px`;

        // Update menu items based on file or folder
        if (item.is_file) {
            contextOpen.textContent = 'Open';
            contextNewTab.style.display = 'block';
        } else {
            contextOpen.textContent = 'Open Folder';
            contextNewTab.style.display = 'none';
        }

        // Show the menu
        contextMenu.classList.remove('hidden');

        // Adjust position if menu goes off-screen
        const menuRect = contextMenu.getBoundingClientRect();
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;

        if (menuRect.right > windowWidth) {
            contextMenu.style.left = `${e.pageX - menuRect.width}px`;
        }

        if (menuRect.bottom > windowHeight) {
            contextMenu.style.top = `${e.pageY - menuRect.height}px`;
        }
    }

    // Hide context menu when clicking elsewhere
    document.addEventListener('click', () => {
        contextMenu.classList.add('hidden');
        activeItem = null;
    });

    // Prevent context menu from closing when clicking inside it
    contextMenu.addEventListener('click', (e) => {
        e.stopPropagation();
    });

    // Context menu action handlers
    contextOpen.addEventListener('click', (e) => {
        e.preventDefault();
        if (!activeItem) return;

        if (activeItem.is_file) {
            showFilePreview(activeItem.name, activeItem.url);
        } else {
            const newPath = currentPath ? `${currentPath}/${activeItem.name}` : activeItem.name;
            loadFiles(currentUniqueId, newPath);
        }

        contextMenu.classList.add('hidden');
    });

    contextNewTab.addEventListener('click', (e) => {
        e.preventDefault();
        if (!activeItem || !activeItem.is_file) return;

        window.open(activeItem.url, '_blank');
        contextMenu.classList.add('hidden');
    });

    contextDownload.addEventListener('click', (e) => {
        e.preventDefault();
        if (!activeItem) return;

        if (activeItem.is_file) {
            const a = document.createElement('a');
            a.href = activeItem.url;
            a.download = activeItem.name;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        } else {
            const folderPath = currentPath ? `${currentPath}/${activeItem.name}` : activeItem.name;
            window.location.href = `/tools/zip-uploader/download-folder/${currentUniqueId}/${folderPath}`;
        }

        contextMenu.classList.add('hidden');
    });

    // Prevent default context menu on file list items
    fileList.addEventListener('contextmenu', (e) => {
        e.preventDefault();
    });

    async function loadFiles(uniqueId, path) {
        fileLoading.classList.remove('hidden');
        fileList.innerHTML = '';

        try {
            const fullPath = path ? `${uniqueId}/${path}` : uniqueId;
            const response = await fetch(`/zip-uploader/list/${fullPath}`);

            if (!response.ok) {
                throw new Error('Failed to load files');
            }

            const data = await response.json();

            // Update breadcrumb
            updateBreadcrumb(path);

            // Add a "Go up" item if we're in a subfolder
            if (path) {
                const upItem = document.createElement('div');
                upItem.className = 'bg-white border rounded-lg p-3 hover:shadow-md transition-shadow cursor-pointer relative';
                upItem.innerHTML = `
                    <div class="flex flex-col h-full">
                        <svg class="h-16 w-16 mx-auto mb-2 text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 10l7-7m0 0l7 7m-7-7v18" />
                        </svg>
                        <div class="text-center mb-2 truncate">
                            <span class="text-sm font-medium">Go Back</span>
                        </div>
                        <div class="text-center text-xs text-gray-500">
                            Parent Directory
                        </div>
                    </div>
                `;

                upItem.addEventListener('click', () => {
                    // Go up one directory
                    const pathParts = path.split('/');
                    pathParts.pop();
                    const newPath = pathParts.join('/');
                    currentPath = newPath;
                    loadFiles(uniqueId, newPath);
                });

                fileList.appendChild(upItem);
            }

            // Render files
            data.items.forEach(item => {
                const itemElement = document.createElement('div');
            itemElement.className = 'bg-white border rounded-lg p-3 hover:shadow-md transition-shadow cursor-pointer relative';
            itemElement.dataset.type = item.is_file ? 'file' : 'folder';
            itemElement.dataset.name = item.name;
            itemElement.dataset.url = item.url || '';
            itemElement.dataset.path = path ? `${path}/${item.name}` : item.name;

            const icon = item.is_file ?
                '<svg class="h-16 w-16 mx-auto mb-2 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>' :
                '<svg class="h-16 w-16 mx-auto mb-2 text-yellow-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>';

            const size = formatFileSize(item.size);

            // Create card layout
            itemElement.innerHTML = `
                <div class="flex flex-col h-full">
                    ${icon}
                    <div class="text-center mb-2 truncate" title="${item.name}">
                        <span class="text-sm font-medium">${item.name}</span>
                    </div>
                    <div class="text-center text-xs text-gray-500">
                        ${size}
                    </div>
                </div>
            `;

            // Add double-click handler
            itemElement.addEventListener('dblclick', () => {
                if (item.is_file) {
                    showFilePreview(item.name, item.url);
                } else {
                    const newPath = path ? `${path}/${item.name}` : item.name;
                    currentPath = newPath;
                    loadFiles(uniqueId, newPath);
                }
            });

            // Add context menu handler
            itemElement.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                showContextMenu(e, item);
            });

            fileList.appendChild(itemElement);
            });

        } catch (error) {
            fileList.innerHTML = `
                <div class="p-4 text-center text-red-500">
                    ${error.message}
                </div>
            `;
        } finally {
            fileLoading.classList.add('hidden');
        }
    }

    function updateBreadcrumb(path) {
        const parts = path ? path.split('/') : [];

        // Clear existing breadcrumb except for Root
        while (breadcrumb.children.length > 1) {
            breadcrumb.removeChild(breadcrumb.lastChild);
        }

        let currentPath = '';

        parts.forEach((part, index) => {
            // Add separator
            const separator = document.createElement('span');
            separator.className = 'mx-2 text-gray-400';
            separator.textContent = '/';
            breadcrumb.appendChild(separator);

            // Add path part
            currentPath = currentPath ? `${currentPath}/${part}` : part;
            const pathPart = document.createElement('span');
            pathPart.className = 'hover:text-blue-500 cursor-pointer';
            pathPart.textContent = part;
            pathPart.dataset.path = currentPath;

            pathPart.addEventListener('click', function() {
                loadFiles(currentUniqueId, this.dataset.path);
            });

            breadcrumb.appendChild(pathPart);
        });

        // Make Root clickable too
        breadcrumb.firstChild.addEventListener('click', function() {
            loadFiles(currentUniqueId, '');
        });
    }

    function showFilePreview(fileName, fileUrl) {
        explorerSection.classList.add('hidden');
        previewSection.classList.remove('hidden');
        previewTitle.textContent = `Preview: ${fileName}`;

        // Set up action buttons
        const previewOpenBtn = document.getElementById('preview-open-btn');
        const previewDownloadBtn = document.getElementById('preview-download-btn');

        previewOpenBtn.onclick = () => window.open(fileUrl, '_blank');
        previewDownloadBtn.onclick = () => {
            const a = document.createElement('a');
            a.href = fileUrl;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        };

        const extension = fileName.split('.').pop().toLowerCase();

        // Handle different file types
        if (['jpg', 'jpeg', 'png', 'gif', 'svg'].includes(extension)) {
            // Image preview
            previewContent.innerHTML = `
                <div class="flex justify-center">
                    <img src="${fileUrl}" alt="${fileName}" class="max-w-full max-h-96 object-contain" />
                </div>
            `;
        } else if (['html', 'htm'].includes(extension)) {
            // HTML preview with iframe
            previewContent.innerHTML = `
                <iframe src="${fileUrl}" class="w-full h-96 border rounded"></iframe>
            `;
        } else if (['txt', 'md', 'css', 'js', 'json', 'xml', 'csv'].includes(extension)) {
            // Text preview
            fetch(fileUrl)
                .then(response => response.text())
                .then(text => {
                    previewContent.innerHTML = `
                        <div class="bg-gray-100 p-4 rounded overflow-auto max-h-96">
                            <pre class="text-sm whitespace-pre-wrap">${escapeHtml(text)}</pre>
                        </div>
                    `;
                })
                .catch(() => {
                    previewContent.innerHTML = `
                        <div class="p-4 text-center text-red-500">
                            Failed to load file content
                        </div>
                    `;
                });
        } else {
            // Download link for other file types
            previewContent.innerHTML = `
                <div class="p-8 text-center">
                    <p class="mb-4">Preview not available for this file type</p>
                </div>
            `;
        }
    }

    function formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + ' ' + sizes[i];
    }

    function escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function showRetrieveError(message) {
        retrieveError.textContent = message;
        retrieveError.classList.remove('hidden');
    }

    retrieveForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const uniqueId = document.getElementById('unique-id').value.trim();

        if (!uniqueId) {
            showRetrieveError('Please enter a valid unique ID');
            return;
        }

        retrieveError.classList.add('hidden');

        try {
            // First check if the ID exists by trying to fetch file info
            const response = await fetch(`/zip-uploader/check/${uniqueId}`);

            if (!response.ok) {
                if (response.status === 404) {
                    showRetrieveError('ID not found. Please check and try again.');
                } else {
                    throw new Error('Failed to retrieve file');
                }
                return;
            }

            const data = await response.json();

            // Update result section
            resultId.textContent = data.unique_id;
            resultFilename.textContent = data.filename;
            downloadZipBtn.href = `/tools/zip-uploader/download/${data.unique_id}`;

            if (data.webpage_url) {
                viewWebpageBtn.href = data.webpage_url;
                viewWebpageBtn.onclick = null; // Remove any previous click handlers
            } else {
                viewWebpageBtn.href = "#"; // Empty href
                // Add click handler to show popup message
                viewWebpageBtn.onclick = function(e) {
                    e.preventDefault(); // Prevent default link behavior
                    showAlert("No index.html file was found in the ZIP archive. A valid HTML file is required to view as a webpage.");
                };
            }

            // Show the results section
            uploadSection.classList.add('hidden');
            previousUploadSection.classList.add('hidden');
            resultsSection.classList.remove('hidden');

            // Set the current ID for future operations
            currentUniqueId = data.unique_id;

        } catch (error) {
            showRetrieveError(error.message);
        }
    });
});

function showAlert(message) {
    const alertPopup = document.getElementById('alert-popup');
    const alertMessage = alertPopup.querySelector('p');
    if (alertMessage) {
        alertMessage.textContent = message;
    }
    alertPopup.classList.remove('hidden');
}

// Add an event listener for the close button
document.getElementById('close-alert').addEventListener('click', () => {
    document.getElementById('alert-popup').classList.add('hidden');
});

document.getElementById('copy-button').addEventListener('click', function() {
    const idText = document.getElementById('result-id').textContent;
    navigator.clipboard.writeText(idText)
        .then(() => {
            // Provide visual feedback that copy was successful
            const button = document.getElementById('copy-button');
            const originalText = button.textContent;
            button.textContent = 'Copied!';
            button.classList.remove('bg-blue-500', 'hover:bg-blue-600');
            button.classList.add('bg-green-500', 'hover:bg-green-600');

            // Reset button after 2 seconds
            setTimeout(() => {
                button.textContent = originalText;
                button.classList.remove('bg-green-500', 'hover:bg-green-600');
                button.classList.add('bg-blue-500', 'hover:bg-blue-600');
            }, 2000);
        })
        .catch(err => {
            console.error('Failed to copy text: ', err);
            alert('Failed to copy text to clipboard');
        });
});
