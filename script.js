// script.js

// Initialize variables
let csvData = [];
let currentUPC = '';
const csvFileName = 'data.csv'; // Initial CSV file name
let barcodeDetected = false; // Flag to track barcode detection

// Elements
const startButton = document.getElementById('startButton');
const exportButton = document.getElementById('exportButton');
const message = document.getElementById('message');
const infoModal = document.getElementById('infoModal');
const modalUPC = document.getElementById('modalUPC');
const saveInfoButton = document.getElementById('saveInfo');
const video = document.getElementById('video');
const overlay = document.getElementById('overlay');
const overlayCtx = overlay.getContext('2d');
const loadingSpinner = document.getElementById('loadingSpinner');
const beepSound = document.getElementById('beepSound');

// Load initial CSV data from GitHub Pages
// Since GitHub Pages is static, you need to host the CSV file in the repository and fetch it
async function loadCSV() {
    try {
        const storedData = localStorage.getItem('csvData');
        if (storedData) {
            csvData = JSON.parse(storedData);
            console.log('Loaded CSV data from localStorage.');
        } else {
            const response = await fetch(csvFileName);
            if (!response.ok) {
                // If data.csv is empty or not found, initialize an empty array
                if (response.status === 404 || response.status === 400) {
                    csvData = [];
                    console.warn('CSV file not found or empty. Initializing with empty data.');
                } else {
                    throw new Error('Failed to fetch CSV file.');
                }
            } else {
                const csvText = await response.text();
                if (csvText.trim() === '') {
                    csvData = [];
                    console.warn('CSV file is empty. Initializing with empty data.');
                } else {
                    const parsedData = Papa.parse(csvText, { header: true });
                    csvData = parsedData.data.filter(row => row.upc); // Filter out empty rows
                    console.log('Loaded CSV data from data.csv:', csvData);
                }
                // Save to localStorage
                localStorage.setItem('csvData', JSON.stringify(csvData));
            }
        }
    } catch (error) {
        console.error('Error loading CSV:', error);
        showMessage('Error loading CSV file.');
        csvData = []; // Initialize empty if not found
    }
}

// Function to show messages
function showMessage(msg, isError = true) {
    message.textContent = msg;
    message.style.display = 'block';
    message.style.backgroundColor = isError ? '#dc3545' : '#28a745';
    console.log(`Message shown: ${msg}`);
    setTimeout(() => {
        message.style.display = 'none';
    }, 3000);
}

// Function to start the scanner
function startScanner() {
    loadingSpinner.style.display = 'block'; // Show spinner

    Quagga.init({
        inputStream: {
            type: "LiveStream",
            constraints: {
                width: { ideal: 640 },
                height: { ideal: 480 },
                facingMode: "environment" // Use rear camera
            },
            target: document.querySelector('#video-container') // Ensure this is correct
        },
        decoder: {
            readers: ["upc_reader", "upc_e_reader"] // Specify barcode types
        },
        locate: true,
        numOfWorkers: navigator.hardwareConcurrency || 4,
        frequency: 10,
        debug: {
            showCanvas: true, // Enable for debugging
            showPatches: true, // Enable for debugging
            showFoundPatches: true, // Enable for debugging
            showSkeleton: true, // Enable for debugging
            showLabels: true, // Enable for debugging
            showPatchLabels: true, // Enable for debugging
            showRemainingPatchLabels: true, // Enable for debugging
            boxFromPatches: {
                showTransformed: true, // Enable for debugging
                showTransformedBox: true, // Enable for debugging
                showBB: true // Enable for debugging
            }
        }
    }, function(err) {
        if (err) {
            console.error(err);
            showMessage('Error initializing scanner.');
            loadingSpinner.style.display = 'none'; // Hide spinner on error
            return;
        }
        Quagga.start();
        console.log('Quagga started.');
        loadingSpinner.style.display = 'none'; // Hide spinner once started
    });

    Quagga.onDetected(onDetected);
    Quagga.onProcessed(onProcessed);
}

// Handler when a barcode is detected
function onDetected(result) {
    const code = result.codeResult.code;
    if (code !== currentUPC) { // Prevent multiple detections of the same UPC
        currentUPC = code;
        barcodeDetected = true; // Set flag to change rectangle color and display text
        Quagga.pause(); // Pause scanning while processing
        console.log('Detected UPC:', code);
        handleUPC(code);
    }
}

// Handler for processed frames to draw AR elements and the rectangle guide
function onProcessed(result) {
    overlayCtx.clearRect(0, 0, overlay.width, overlay.height);
    if (result) {
        if (result.boxes) {
            result.boxes.filter(box => box !== result.box).forEach(box => {
                drawPath(box, 'rgba(0, 255, 0, 0.3)');
            });
        }

        if (result.box) {
            drawPath(result.box, '#00FF00');
        }

        if (result.codeResult && result.codeResult.code) {
            drawPath(result.line, '#FF0000');
        }
    }

    // Draw the rectangle guide with appropriate color and text
    if (barcodeDetected) {
        drawGuideRectangle('rgba(0, 255, 0, 0.7)', 'Scanned!');
        beepSound.play(); // Play beep sound upon scanning
        barcodeDetected = false; // Reset flag
    } else {
        drawGuideRectangle(); // Default red color and text
    }
}

// Function to draw paths on the canvas
function drawPath(path, color) {
    if (!path || path.length === 0) return;
    overlayCtx.beginPath();
    overlayCtx.moveTo(path[0].x, path[0].y);
    path.forEach(point => {
        overlayCtx.lineTo(point.x, point.y);
    });
    overlayCtx.lineWidth = 2;
    overlayCtx.strokeStyle = color;
    overlayCtx.stroke();
}

// Function to draw the rectangle guide and floating text
function drawGuideRectangle(color = 'rgba(255, 0, 0, 0.7)', text = 'Please align barcode') {
    const width = overlay.width;
    const height = overlay.height;
    const rectWidth = width * 0.6; // 60% of the video width
    const rectHeight = height * 0.2; // 20% of the video height
    const rectX = (width - rectWidth) / 2; // Center horizontally
    const rectY = (height - rectHeight) / 2; // Center vertically

    // Draw the rectangle
    overlayCtx.beginPath();
    overlayCtx.lineWidth = 4;
    overlayCtx.strokeStyle = color; // Dynamic color based on detection
    overlayCtx.rect(rectX, rectY, rectWidth, rectHeight);
    overlayCtx.stroke();

    // Draw the floating text above the rectangle
    overlayCtx.font = '20px Arial';
    overlayCtx.fillStyle = '#FFFFFF'; // White text color for visibility
    overlayCtx.textAlign = 'center';
    overlayCtx.textBaseline = 'bottom';
    const textX = width / 2;
    const textY = rectY - 10; // 10 pixels above the rectangle
    overlayCtx.fillText(text, textX, textY);
}

// Handle UPC after detection
function handleUPC(upc) {
    const item = csvData.find(row => row.upc === upc);
    if (item && item['item name'] && item['aisle location'] && item['downstack pallet']) {
        // Item exists with all information
        showAROverlay(item);
    } else {
        // Missing information
        currentUPC = upc;
        infoModal.style.display = 'block';
        modalUPC.textContent = upc;
        console.log('UPC not found or missing data:', upc);
    }
}

// Show AR Overlay
function showAROverlay(item) {
    // Clear any existing drawings
    overlayCtx.clearRect(0, 0, overlay.width, overlay.height);
    
    // Display information on the screen as AR elements
    showMessage(`Item: ${item['item name']} | Aisle: ${item['aisle location']} | Pallet: ${item['downstack pallet']}`, false);
    console.log('Displaying item information:', item);
    
    // Optionally, you can implement more advanced AR overlays here
    
    // Resume scanning after displaying
    setTimeout(() => {
        currentUPC = ''; // Reset currentUPC to allow re-detection
        Quagga.start();
        console.log('Quagga resumed.');
    }, 3000);
}

// Save information from modal
saveInfoButton.addEventListener('click', () => {
    const itemName = document.getElementById('itemName').value.trim();
    const aisleLocation = document.getElementById('aisleLocation').value.trim();
    const pallet = document.getElementById('pallet').value.trim();

    if (!itemName || !aisleLocation || !pallet) {
        alert('Please fill in all fields.');
        return;
    }

    // Check if UPC already exists
    const existingIndex = csvData.findIndex(row => row.upc === currentUPC);
    if (existingIndex !== -1) {
        csvData[existingIndex]['item name'] = itemName;
        csvData[existingIndex]['aisle location'] = aisleLocation;
        csvData[existingIndex]['downstack pallet'] = pallet;
        console.log('Updated existing item:', csvData[existingIndex]);
    } else {
        // Add new entry to csvData
        const newEntry = {
            upc: currentUPC,
            'item name': itemName,
            'aisle location': aisleLocation,
            'downstack pallet': pallet
        };
        csvData.push(newEntry);
        console.log('Added new item:', newEntry);
    }

    // Save to localStorage
    localStorage.setItem('csvData', JSON.stringify(csvData));

    // Clear input fields
    document.getElementById('itemName').value = '';
    document.getElementById('aisleLocation').value = '';
    document.getElementById('pallet').value = '';

    // Close modal and resume scanning
    infoModal.style.display = 'none';
    showMessage('Information saved.', false);
    Quagga.start();
    console.log('Quagga resumed after saving information.');
});

// Export CSV
function exportCSV() {
    if (csvData.length === 0) {
        showMessage('No data to export.');
        return;
    }
    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    saveAs(blob, "updated_data.csv");
    showMessage('CSV exported successfully.', false);
    console.log('CSV exported.');
}

// Event Listeners
startButton.addEventListener('click', () => {
    startScanner();
    startButton.style.display = 'none';
    console.log('Start Scanner button clicked.');
});

exportButton.addEventListener('click', exportCSV);
console.log('Export CSV button initialized.');

// Close modal when clicking outside of it
window.onclick = function(event) {
    if (event.target == infoModal) {
        infoModal.style.display = "none";
        Quagga.start();
        console.log('Modal closed by clicking outside.');
    }
}

// Initialize the app
window.onload = loadCSV;
console.log('Page loaded. CSV data is being loaded.');

// Adjust canvas size when video metadata is loaded
video.addEventListener('loadedmetadata', () => {
    overlay.width = video.clientWidth;
    overlay.height = video.clientHeight;
    console.log('Canvas size set to video dimensions.');
});
