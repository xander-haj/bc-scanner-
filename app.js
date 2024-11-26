document.addEventListener('DOMContentLoaded', () => {
    const scanButton = document.getElementById('scan-button');
    const resultElement = document.getElementById('result');
    const productForm = document.getElementById('product-form');
    const cancelButton = document.getElementById('cancel-button');
    const dataEntry = document.getElementById('data-entry');
    const exportButton = document.getElementById('export-button');
    const importFileInput = document.getElementById('import-file');
    const arOverlay = document.getElementById('ar-overlay');
    
    let currentBarcode = null;
    let isScanning = false;
    let products = []; // Array to store product data

    // Initialize QuaggaJS
    Quagga.init({
        inputStream: {
            type: "LiveStream",
            target: document.querySelector('#video'), // Or '#scanner-container' for full container
            constraints: {
                facingMode: "environment" // Use rear camera
            }
        },
        decoder: {
            readers: ["code_128_reader", "ean_reader", "ean_8_reader", "upc_reader", "upc_e_reader", "code_39_reader"] // Add or remove barcode formats as needed
        },
        locate: true, // Enable locating
    }, function(err) {
        if (err) {
            console.error(err);
            resultElement.textContent = `Error initializing scanner: ${err}`;
            return;
        }
        Quagga.start();
        console.log("QuaggaJS initialized.");
    });

    // Barcode detection event
    Quagga.onDetected((data) => {
        if (!isScanning) {
            const code = data.codeResult.code;
            console.log(`Barcode detected: ${code}`);
            currentBarcode = code;
            // Indicate detection (e.g., green border)
            document.querySelector('#scanner-container').style.borderColor = 'green';
            // Enable the scan button
            scanButton.disabled = false;
        }
    });

    // Handle errors
    Quagga.onError((err) => {
        console.error(err);
        resultElement.textContent = `Error: ${err}`;
        alert('Camera access is required to scan barcodes.');
    });

    // Manual scan button click
    scanButton.addEventListener('click', () => {
        if (currentBarcode) {
            isScanning = true;
            Quagga.stop();
            scanButton.disabled = true;
            document.querySelector('#scanner-container').style.borderColor = '#ccc';
            resultElement.textContent = `Barcode Result: ${currentBarcode}`;
            // Show data entry form
            dataEntry.style.display = 'block';
            document.getElementById('barcode').value = currentBarcode;
        }
    });

    // Cancel button click
    cancelButton.addEventListener('click', () => {
        resetScanner();
    });

    // Handle form submission
    productForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const barcode = document.getElementById('barcode').value;
        const name = document.getElementById('name').value.trim();
        const location = document.getElementById('location').value.trim();
        const downstack = document.getElementById('downstack').value.trim();

        if (barcode && name && location && downstack) {
            // Check for duplicate barcode
            const duplicate = products.find(product => product.barcode === barcode);
            if (duplicate) {
                alert('This barcode already exists in the database.');
                return;
            }

            // Add to products array
            products.push({
                barcode: barcode,
                name: name,
                location: location,
                downstack: downstack
            });
            // Update result
            resultElement.textContent += `\nAdded Product: ${name}`;
            // Display AR label
            displayARLabel(name);
            // Reset scanner
            resetScanner();
            // Reset form
            productForm.reset();
            dataEntry.style.display = 'none';
        } else {
            alert('Please fill in all fields.');
        }
    });

    // Export CSV
    exportButton.addEventListener('click', () => {
        if (products.length === 0) {
            alert('No products to export.');
            return;
        }
        const csv = Papa.unparse(products);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', 'products.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });

    // Import CSV
    importFileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            Papa.parse(file, {
                header: true,
                skipEmptyLines: true,
                complete: function(results) {
                    const importedProducts = results.data.map(item => ({
                        barcode: item.barcode,
                        name: item.name,
                        location: item.location,
                        downstack: item.downstack
                    }));

                    // Check for duplicates and merge
                    importedProducts.forEach(importedProduct => {
                        const exists = products.find(product => product.barcode === importedProduct.barcode);
                        if (!exists) {
                            products.push(importedProduct);
                        }
                    });

                    resultElement.textContent = `Imported ${importedProducts.length} products from CSV.`;
                },
                error: function(err) {
                    console.error(err);
                    alert('Error parsing CSV file.');
                }
            });
        }
    });

    // Display AR label above the barcode (center for simplicity)
    function displayARLabel(objectName) {
        const label = document.createElement('div');
        label.className = 'ar-label';
        label.textContent = objectName;

        // Position the label at the center of the viewport
        label.style.top = '50%';
        label.style.left = '50%';

        arOverlay.appendChild(label);

        // Remove the label after 5 seconds
        setTimeout(() => {
            arOverlay.removeChild(label);
        }, 5000);
    }

    // Reset scanner to allow new scans
    function resetScanner() {
        isScanning = false;
        currentBarcode = null;
        scanButton.disabled = true;
        document.querySelector('#scanner-container').style.borderColor = '#ccc';
        resultElement.textContent = 'Scan a barcode to add a product.';
        Quagga.start();
    }
});
