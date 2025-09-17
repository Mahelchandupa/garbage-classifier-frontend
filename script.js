// Global variables
let classificationHistory = [];
const API_BASE_URL = () => document.getElementById('apiUrl').value.trim();

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    setupEventListeners();
    loadStatistics();
    animateElements();
});

function setupEventListeners() {
    const fileInput = document.getElementById('fileInput');
    const uploadArea = document.getElementById('uploadArea');

    // File input change
    fileInput.addEventListener('change', handleFileSelect);

    // Drag and drop
    uploadArea.addEventListener('dragover', handleDragOver);
    uploadArea.addEventListener('dragleave', handleDragLeave);
    uploadArea.addEventListener('drop', handleDrop);
    uploadArea.addEventListener('click', () => fileInput.click());
}

function animateElements() {
    // Add animations to cards on scroll
    const cards = document.querySelectorAll('.card');
    cards.forEach((card, index) => {
        card.style.animationDelay = `${index * 0.1}s`;
    });
}

function handleFileSelect(event) {
    const file = event.target.files[0];
    if (file) {
        showImagePreview(file);
        classifyImage(file);
    }
}

function handleDragOver(event) {
    event.preventDefault();
    event.currentTarget.classList.add('dragover');
}

function handleDragLeave(event) {
    event.currentTarget.classList.remove('dragover');
}

function handleDrop(event) {
    event.preventDefault();
    event.currentTarget.classList.remove('dragover');
    
    const files = event.dataTransfer.files;
    if (files.length > 0) {
        const file = files[0];
        if (file.type.startsWith('image/')) {
            showImagePreview(file);
            classifyImage(file);
        }
    }
}

function showImagePreview(file) {
    const preview = document.getElementById('imagePreview');
    const previewImg = document.getElementById('previewImg');
    
    const reader = new FileReader();
    reader.onload = function(e) {
        previewImg.src = e.target.result;
        preview.style.display = 'block';
    };
    reader.readAsDataURL(file);
}

function removeImage() {
    const preview = document.getElementById('imagePreview');
    const fileInput = document.getElementById('fileInput');
    const uploadStatus = document.getElementById('uploadStatus');
    
    preview.style.display = 'none';
    fileInput.value = '';
    uploadStatus.innerHTML = '';
}

async function testConnection() {
    const statusDiv = document.getElementById('connectionStatus');
    const apiUrl = API_BASE_URL();
    
    try {
        statusDiv.innerHTML = '<div class="loading"><div class="spinner"></div>Testing connection...</div>';
        
        // Try to access a simple endpoint
        const response = await fetch(`${apiUrl}/`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        });
        
        if (response.ok) {
            statusDiv.innerHTML = `
                <div class="success">
                    <i class="fas fa-check-circle"></i> Connected successfully! Backend is running.
                </div>
            `;
        } else {
            throw new Error(`HTTP error: ${response.status}`);
        }
    } catch (error) {
        statusDiv.innerHTML = `
            <div class="error">
                <i class="fas fa-exclamation-circle"></i> Connection failed: ${error.message}. 
                Make sure your backend is running at ${apiUrl}
            </div>
        `;
    }
}

async function classifyImage(file) {
    const statusDiv = document.getElementById('uploadStatus');
    const resultsDiv = document.getElementById('resultsContent');
    
    try {
        // Show loading state
        statusDiv.innerHTML = '<div class="loading"><div class="spinner"></div>Classifying image...</div>';
        resultsDiv.innerHTML = '<div class="loading"><div class="spinner"></div>Processing...</div>';
        
        // Prepare form data
        const formData = new FormData();
        formData.append('file', file);
        
        // Make API request
        const response = await fetch(`${API_BASE_URL()}/classify`, {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Server error: ${response.status} - ${errorText}`);
        }
        
        const result = await response.json();
        
        // Show success
        statusDiv.innerHTML = '<div class="success"><i class="fas fa-check-circle"></i> Classification completed!</div>';
        
        // Display results
        displayResults(result);
        
        // Update statistics
        addToHistory(result);
        updateStatistics();
        
        // Celebrate with confetti for high confidence
        if (result.prediction.confidence > 0.8) {
            celebrate();
        }
        
    } catch (error) {
        console.error('Classification error:', error);
        statusDiv.innerHTML = `
            <div class="error">
                <i class="fas fa-exclamation-circle"></i> Error: ${error.message}
            </div>
        `;
        resultsDiv.innerHTML = `
            <div class="error">
                <p>Failed to classify image. Please check:</p>
                <ul>
                    <li>Your backend is running at ${API_BASE_URL()}</li>
                    <li>The /classify endpoint exists</li>
                    <li>Your CORS settings allow requests from this page</li>
                </ul>
            </div>
        `;
    }
}

function displayResults(result) {
    const resultsDiv = document.getElementById('resultsContent');
    
    // Handle different response formats
    const prediction = result.prediction || result;
    const allPredictions = result.all_predictions || {};
    const recommendations = result.recommendations || [
        "Rinse the item before recycling",
        "Check local recycling guidelines",
        "Remove any non-recyclable components"
    ];
    
    // Calculate confidence percentage if not provided
    const confidencePercentage = prediction.confidence_percentage || 
                               (prediction.confidence ? (prediction.confidence * 100).toFixed(1) : "N/A");
    
    let html = `
        <div class="prediction-result">
            <div class="prediction-class">
                ${getClassIcon(prediction.class)} ${prediction.class.toUpperCase()}
            </div>
            <div class="confidence-bar">
                <div class="confidence-fill" style="width: ${confidencePercentage}%">
                    ${confidencePercentage}%
                </div>
            </div>
        </div>
        
        <div class="all-predictions">
            <h4>All Predictions:</h4>
    `;
    
    // Display all predictions if available
    if (Object.keys(allPredictions).length > 0) {
        // Sort predictions by confidence
        const sortedPredictions = Object.entries(allPredictions)
            .sort(([,a], [,b]) => b - a);
        
        sortedPredictions.forEach(([className, confidence], index) => {
            const isHighest = index === 0;
            html += `
                <div class="prediction-item ${isHighest ? 'highest' : ''}">
                    <span>${getClassIcon(className)} ${className}</span>
                    <span>${(confidence * 100).toFixed(1)}%</span>
                </div>
            `;
        });
    } else {
        html += `<p>No detailed predictions available</p>`;
    }
    
    html += '</div>';
    
    // Add recommendations
    html += `
        <div class="recommendations">
            <h3><i class="fas fa-recycle"></i> Recycling Recommendations</h3>
            <ul>
    `;
    
    recommendations.forEach(rec => {
        html += `<li>${rec}</li>`;
    });
    
    html += '</ul></div>';
    
    resultsDiv.innerHTML = html;
    
    // Animate the confidence bar
    setTimeout(() => {
        const confidenceFill = document.querySelector('.confidence-fill');
        if (confidenceFill) {
            confidenceFill.style.width = `${confidencePercentage}%`;
        }
    }, 100);
}

function getClassIcon(className) {
    const icons = {
        'plastic': '<i class="fas fa-wine-bottle"></i>',
        'metal': '<i class="fas fa-utensils"></i>',
        'paper': '<i class="fas fa-sticky-note"></i>',
        'glass': '<i class="fas fa-glass-martini-alt"></i>',
        'cardboard': '<i class="fas fa-archive"></i>',
        'trash': '<i class="fas fa-trash"></i>',
        'compost': '<i class="fas fa-leaf"></i>'
    };
    return icons[className.toLowerCase()] || '<i class="fas fa-question"></i>';
}

function addToHistory(result) {
    const prediction = result.prediction || result;
    
    classificationHistory.push({
        class: prediction.class,
        confidence: prediction.confidence || 0,
        timestamp: new Date()
    });
    
    // Keep only last 100 classifications
    if (classificationHistory.length > 100) {
        classificationHistory = classificationHistory.slice(-100);
    }
    
    // Save to localStorage
    localStorage.setItem('classificationHistory', JSON.stringify(classificationHistory));
}

function loadStatistics() {
    const saved = localStorage.getItem('classificationHistory');
    if (saved) {
        classificationHistory = JSON.parse(saved);
        updateStatistics();
    }
}

function updateStatistics() {
    if (classificationHistory.length === 0) return;
    
    // Total classifications
    document.getElementById('totalClassifications').textContent = classificationHistory.length;
    
    // Average confidence
    const avgConfidence = classificationHistory.reduce((sum, item) => sum + item.confidence, 0) / classificationHistory.length;
    document.getElementById('averageConfidence').textContent = `${(avgConfidence * 100).toFixed(1)}%`;
    
    // Most common class
    const classCounts = {};
    classificationHistory.forEach(item => {
        classCounts[item.class] = (classCounts[item.class] || 0) + 1;
    });
    
    const mostCommon = Object.entries(classCounts).reduce((max, [className, count]) => 
        count > max.count ? {class: className, count} : max, {class: '', count: 0});
    
    document.getElementById('mostCommonClass').textContent = mostCommon.class || '-';
}

function celebrate() {
    // Create confetti effect
    confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#4361ee', '#3a0ca3', '#4cc9f0', '#f72585', '#7209b7']
    });
    
    // Add celebration animation to results
    const results = document.querySelector('.prediction-result');
    if (results) {
        results.classList.add('animate__animated', 'animate__tada');
        setTimeout(() => {
            results.classList.remove('animate__animated', 'animate__tada');
        }, 1000);
    }
}