// Global variables
let selectedFiles = [];
let mergedPdfBytes = null;
const MAX_FILES = 20;

// DOM elements
const dropArea = document.getElementById('drop-area');
const fileInput = document.getElementById('file-upload');
const mergeBtn = document.getElementById('merge-btn');
const fileListContainer = document.getElementById('file-list-container');
const fileList = document.getElementById('file-list');
const progressContainer = document.getElementById('progress-container');
const progressBar = document.getElementById('progress-bar');
const progressText = document.getElementById('progress-text');
const resultContainer = document.getElementById('result-container');
const downloadBtn = document.getElementById('download-btn');
const clearBtn = document.getElementById('clear-btn');
const resetBtn = document.getElementById('reset-btn');

// Initialize the application
function init() {
    // Setup event listeners
    fileInput.addEventListener('change', handleFileSelect);
    mergeBtn.addEventListener('click', mergePdfs);
    clearBtn.addEventListener('click', clearFiles);
    resetBtn.addEventListener('click', resetMerger);
    downloadBtn.addEventListener('click', downloadPdf);
    
    // Setup drag and drop
    setupDragAndDrop();
    
    // Initialize sortable list
    initSortable();
}

// Setup drag and drop functionality
function setupDragAndDrop() {
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
        dropArea.addEventListener(eventName, highlight, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, unhighlight, false);
    });

    function highlight() {
        dropArea.classList.add('active');
    }

    function unhighlight() {
        dropArea.classList.remove('active');
    }

    dropArea.addEventListener('drop', handleDrop, false);
}

// Initialize sortable list for drag-and-drop reordering
function initSortable() {
    Sortable.create(fileList, {
        animation: 150,
        ghostClass: 'sortable-ghost',
        chosenClass: 'sortable-chosen',
        onEnd: function(evt) {
            // Update the selectedFiles array based on the new order
            const newIndex = evt.newIndex;
            const oldIndex = evt.oldIndex;
            const element = selectedFiles.splice(oldIndex, 1)[0];
            selectedFiles.splice(newIndex, 0, element);
        }
    });
}

// Handle dropped files
function handleDrop(e) {
    const dt = e.dataTransfer;
    const files = dt.files;
    handleFiles(files);
}

// Handle file selection from input
function handleFileSelect(e) {
    const files = e.target.files;
    handleFiles(files);
}

// Process selected files
function handleFiles(files) {
    const validFiles = Array.from(files).filter(file => {
        const fileType = file.type.toLowerCase();
        return fileType === 'application/pdf';
    });

    if (validFiles.length === 0) {
        alert('Please select only PDF files.');
        return;
    }

    // Check if adding these files would exceed the limit
    if (selectedFiles.length + validFiles.length > MAX_FILES) {
        alert(`You can only add up to ${MAX_FILES} PDF files. Only the first ${MAX_FILES - selectedFiles.length} will be added.`);
        selectedFiles = [...selectedFiles, ...validFiles.slice(0, MAX_FILES - selectedFiles.length)];
    } else {
        selectedFiles = [...selectedFiles, ...validFiles];
    }

    updateFileList();
    updateMergeButton();
}

// Format file size for display
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Update the file list display
function updateFileList() {
    if (selectedFiles.length > 0) {
        fileListContainer.classList.remove('hidden');
        fileList.innerHTML = '';
        
        selectedFiles.forEach((file, index) => {
            const li = document.createElement('li');
            li.className = 'file-item';
            li.dataset.index = index;
            
            // File info with icon
            const fileInfo = document.createElement('div');
            fileInfo.className = 'file-info';
            
            const icon = document.createElement('img');
            icon.className = 'pdf-icon';
            icon.src = 'assets/icons/pdf-file.svg';
            icon.alt = 'PDF';
            
            const fileDetails = document.createElement('div');
            
            const fileName = document.createElement('div');
            fileName.className = 'file-name';
            fileName.textContent = file.name;
            
            const fileSize = document.createElement('span');
            fileSize.className = 'file-size';
            fileSize.textContent = formatFileSize(file.size);
            
            fileDetails.appendChild(fileName);
            fileDetails.appendChild(fileSize);
            
            fileInfo.appendChild(icon);
            fileInfo.appendChild(fileDetails);
            
            // File controls
            const controls = document.createElement('div');
            controls.className = 'file-controls';
            
            const removeBtn = document.createElement('button');
            removeBtn.className = 'control-button';
            removeBtn.innerHTML = '×';
            removeBtn.title = 'Remove';
            removeBtn.onclick = (e) => {
                e.stopPropagation();
                removeFile(index);
            };
            controls.appendChild(removeBtn);
            
            li.appendChild(fileInfo);
            li.appendChild(controls);
            fileList.appendChild(li);
        });
    } else {
        fileListContainer.classList.add('hidden');
    }
}

// Remove a file from the list
function removeFile(index) {
    selectedFiles.splice(index, 1);
    updateFileList();
    updateMergeButton();
}

// Clear all selected files
function clearFiles() {
    selectedFiles = [];
    fileInput.value = '';
    updateFileList();
    updateMergeButton();
}

// Update merge button state
function updateMergeButton() {
    mergeBtn.disabled = selectedFiles.length < 2;
}

// Merge PDFs
async function mergePdfs() {
    if (selectedFiles.length < 2) {
        alert('Please select at least 2 PDF files to merge.');
        return;
    }
    
    const pdfName = document.getElementById('pdf-name').value.trim() || 'merged_document';
    
    // Show progress
    progressContainer.classList.remove('hidden');
    progressBar.style.width = '0%';
    progressText.textContent = '0%';
    
    // Hide other containers
    fileListContainer.classList.add('hidden');
    mergeBtn.disabled = true;
    
    try {
        const { PDFDocument } = PDFLib;
        
        // Create a new PDF document
        const mergedPdf = await PDFDocument.create();
        
        for (let i = 0; i < selectedFiles.length; i++) {
            const file = selectedFiles[i];
            
            // Update progress
            const currentProgress = Math.round((i / selectedFiles.length) * 90); // Leave 10% for final processing
            progressBar.style.width = `${currentProgress}%`;
            progressText.textContent = `${currentProgress}%`;
            
            // Read the PDF file
            const fileData = await readFileAsArrayBuffer(file);
            
            // Load the PDF document
            const pdfDoc = await PDFDocument.load(fileData);
            
            // Copy all pages from the source document
            const pages = await mergedPdf.copyPages(pdfDoc, pdfDoc.getPageIndices());
            
            // Add each copied page to the merged document
            pages.forEach(page => {
                mergedPdf.addPage(page);
            });
            
            // Small delay to allow UI to update
            await new Promise(resolve => setTimeout(resolve, 50));
        }
        
        // Save the merged PDF
        mergedPdfBytes = await mergedPdf.save();
        
        // Update progress to 100%
        progressBar.style.width = '100%';
        progressText.textContent = '100%';
        
        // Show result container
        setTimeout(() => {
            progressContainer.classList.add('hidden');
            resultContainer.classList.remove('hidden');
        }, 500);
        
    } catch (error) {
        console.error('Error merging PDFs:', error);
        alert('An error occurred while merging your PDFs. Please try again.');
        progressContainer.classList.add('hidden');
        fileListContainer.classList.remove('hidden');
        mergeBtn.disabled = false;
    }
}

// Read file as ArrayBuffer
function readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
}

// Download the merged PDF
function downloadPdf() {
    if (mergedPdfBytes) {
        try {
            const pdfName = document.getElementById('pdf-name').value.trim() || 'merged_document';
            download(mergedPdfBytes, `${pdfName}.pdf`, 'application/pdf');
        } catch (error) {
            console.error('Error downloading PDF:', error);
            alert('An error occurred while downloading your PDF. Please try again.');
        }
    } else {
        alert('PDF not ready. Please try merging again.');
    }
}

// Reset the merger
function resetMerger() {
    // Reset all states
    selectedFiles = [];
    mergedPdfBytes = null;
    fileInput.value = '';
    document.getElementById('pdf-name').value = 'merged_document';
    
    // Reset UI
    resultContainer.classList.add('hidden');
    fileListContainer.classList.add('hidden');
    updateMergeButton();
}

// Initialize the app when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', init);
