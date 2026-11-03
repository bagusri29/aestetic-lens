self.onmessage = function(e) {
    const { imageData, grainAmount } = e.data;
    const data = imageData.data;
    const length = data.length;
    
    // Algoritma Film Grain / Dust Generator (Pixel Manipulation)
    // Dijalankan di background thread agar tidak memblokir UI browser
    for (let i = 0; i < length; i += 4) {
        // Hasilkan noise acak antara -grainAmount dan +grainAmount
        const noise = (Math.random() - 0.5) * grainAmount;
        
        // Aplikasikan noise ke channel RGB
        // Menjaga nilai piksel tetap dalam rentang 0-255
        data[i] = Math.max(0, Math.min(255, data[i] + noise));     // Red
        data[i+1] = Math.max(0, Math.min(255, data[i+1] + noise)); // Green
        data[i+2] = Math.max(0, Math.min(255, data[i+2] + noise)); // Blue
        
        // Simulasi 'Dust' ringan: 0.05% peluang piksel menjadi debu putih atau hitam
        if (grainAmount > 10 && Math.random() < 0.0005) {
            const dustColor = Math.random() > 0.5 ? 240 : 15;
            data[i] = dustColor;
            data[i+1] = dustColor;
            data[i+2] = dustColor;
        }
    }

    // Kembalikan ImageData yang telah diproses ke main thread
    self.postMessage({ imageData: imageData });
};
