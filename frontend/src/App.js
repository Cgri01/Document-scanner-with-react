import React, {useState , useRef} from "react";
import axios from "axios";
import "./App.css";
import Camera from "./components/Camera";

function App() {

  const [selectedFile , setSelectedFile] = useState(null);
  const [previewUrl , setPreviewUrl] = useState(null);
  const [uploadResult , setUploadResult] = useState(null);
  const [isLoading , setIsLoading] = useState(false);
  const [showCamera , setShowCamera] = useState(false);

  const fileInputRef = useRef();

  // Handle file selection (dosya seçildiğinde çalışacak fonksiyon:)

  const handleFileSelect = (event) => {

    const file = event.target.files[0];
    if (file) {
      setSelectedFile(file);
      setUploadResult(null);

      // Dosya önizlemesi için URL olşulturma:
      const fileReader = new FileReader();
      fileReader.onload = () => {
        setPreviewUrl(fileReader.result);
      };
      fileReader.readAsDataURL(file);


    }
  };

  const handleCameraCapture = (file , previewData) => {
    setSelectedFile(file);
    setPreviewUrl(previewData);
    setUploadResult(null);
    setShowCamera(false); //Kamerayı kapat
  }

  //Dosya yükleme butonına tıklanınca çalışacak fonksiyon:
  const handleUpload = async () => {
    if (!selectedFile) {
      alert("Please select a file first.");
      return;
    }

    setIsLoading(true);
    setUploadResult(null);

    //Backende dosya göndermek için formData kullanma:
    const formData = new FormData();
    formData.append("document" , selectedFile);

    try {

      console.log("Uploading file...", selectedFile.name);

      //Axios ile backend APIsine POST isteği gönderme:
      const response = await axios.post("http://localhost:5000/api/upload" , formData , {
        headers: {
          "Content-Type" : "multipart/form-data"
        },
      });
      

      setUploadResult(response.data);
      console.log("Upload successful:", response.data);

    } catch (error) {
      console.error("Error uploading file:", error);
      setUploadResult({
        success: false,
        error: "Error uploading file" + error.message
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Dosya seçme butonuna tıklanınca çalışacak fonksiyon:
  const handleSelectClick = () => {
    fileInputRef.current.click();
  };

  //Kamera Açma butonu:
  const handleCameraClick = () => {
    setShowCamera(true);
  };

  return (
    
    <div className="App">

    <header className="App-header">
      <h1>Document Scanner</h1>
      <p>Select or photo or take a photo</p>

    </header>

    <main className = "main-content">
      {/* Dosya Seçme Bölümü ve kamera butonu */}
      <div className="upload-section">
        
        <input
          type="file"
          ref = {fileInputRef}
          onChange = {handleFileSelect}
          accept = "image/*"
          style = {{display: "none"}}
        />

        <div className="button-group">
          <button className = "select-btn" onClick={handleSelectClick}>Choose a file</button>
          <button className="camera-toggle-btn" onClick={handleCameraClick}>Open Camera</button>
        </div>



        {/* Seçilen Dosya Bilgisi: */}
        {selectedFile && (
          <div className = "file-info">
            <p> Selected File: <strong>{selectedFile.name}</strong></p>
            <p> Size: { (selectedFile.size / 1024 / 1024  ).toFixed(2)} MB</p>
          </div>
        )}


      </div>

      {/* Önizleme */}
      {previewUrl && (
        <div className = "preview-section">
          <h3>Preview:</h3>
          <div className="image-container">
            <img
            src={previewUrl}
            alt="Choosen Document"
            className="preview-image"

          />
          </div>
          
        
        <button
          className={`upload-btn ${isLoading ? 'loading' : ''}`}
          onClick={handleUpload}
          disabled={isLoading}

          >

            {isLoading ? "Uploading" : "Upload and scan"}

        </button>
        </div>
      )}

      {/* Sonuç Bölümü */}
      {uploadResult && (
        <div className={`result-section ${uploadResult.success ? 'success' : 'error'}`}>

          <h3>Result: </h3>
          {uploadResult.success ? (
            <div className="analysis-results">

              <p>{uploadResult.message}</p>
              <p>File: {uploadResult.file.originalname}</p>
              <p>Size: {(uploadResult.file.size / 1024 /1024).toFixed(2)} MB </p>

              {/* Analiz Sonucları */}
              {uploadResult && uploadResult.success && uploadResult.analysis && (
                <div className="analysis-details">
                  <h4>Image Analysis</h4>

                  <div className="analysis-grid">
                    <div className="analysis-item">

                      <strong>Resolution:</strong>
                      <span>{uploadResult.analysis.dimensions.width} x {uploadResult.analysis.dimensions.height}</span>
                      <span>({uploadResult.analysis.dimensions.megapixels} MP)</span>

                    </div>

                    <div className="analysis-item">
                      <strong>Quality Score:</strong>
                      <span className={`score-${Math.floor(uploadResult.analysis.quality.score / 20)}`}>
                        {uploadResult.analysis.quality.score} / 100
                      </span>
                    </div>

                    <div className="analysis-item">
                      <strong>Brightness:</strong>
                      <span>{uploadResult.analysis.quality.brightness}</span>
                    </div>

                    <div className="analysis-item">
                      <strong>Contrast:</strong>
                      <span>{uploadResult.analysis.quality.contrast}</span>
                    </div>

                  </div>

              {/* OCR Sonucları */}
              {uploadResult && uploadResult.success && uploadResult.ocr &&  (
                <div className="ocr-results">

                  <h4>Text Detection Results</h4>

                  <div className="ocr-stats">
                    <div className="ocr-stat">
                      <strong>Detection Reliability:</strong>
                      <span className={`confidence-${Math.floor(uploadResult.ocr.confidence / 20)}`}> 
                        {uploadResult.ocr.confidence}%
                      </span>
                    </div>

                    <div className="ocr-stat">
                      <strong>Languages:</strong>
                      <span>{uploadResult.ocr.language || "english"}</span>
                    </div>

                  </div>

                  {/* Tanınan Metin */}
                  <div className="extracted-text">
                    <h5>Extracted Text:</h5>
                    <div className="text-container">
                      {uploadResult.ocr.success && uploadResult.ocr.text ? (
                        <pre className="recognized-text"> {uploadResult.ocr.text} </pre>
                      ) : (
                        <p className="no-text"> Text not recognized or text not found in image </p>
                      )}
                    </div>
                  </div>

                  {/* OCR Bilgisi */}
                  <div className="ocr-info">
                    <p> <strong>Note:</strong> OCR accuracy depends on image quality, lighting, and font</p>
                  </div>

                </div>
              )}
              



                  {/* Kenar Tespiti */}
                  {uploadResult.analysis.edgeDetection && uploadResult.analysis.edgeDetection.detected && (
                    <div className="edge-detection-section">

                      <h5>Edge Detection Result:</h5>
                      <div className="edge-image-container">

                        <img 
                          src={`http://localhost:5000${uploadResult.analysis.edgeDetection.edgesUrl}`}
                          alt="Edge detection result"
                          className="edge-image"
                        />

                      </div>

                      <p className="edge-description"> The result of the document's edge detection is shown above.</p>

                    </div>
                  )}

                  {/* Öneriler: */}
                  {uploadResult.analysis.suggestions.length > 0 && (
                    <div className="suggestions">
                      <h5>Suggestions for improvement:</h5>
                      <ul>
                        {uploadResult.analysis.suggestions.map((suggestions , index) => (
                          <li key={index}>{suggestions}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Tespit Durumu */}
                  <div className="detection-status">
                    <strong>Document status:</strong>
                    <span className={uploadResult.analysis.detected ? "detected" : "not-detected"}>
                      {uploadResult.analysis.detected ? "Image quality is sufficient for document scanning." : "Document could not be detected."}
                    </span>
                  </div>

                </div>
              )}

            </div>
          ) : (

            <p>{uploadResult.error}</p>

          )}

        </div>
      )}

      {/* Kamera Bileşeni */}
      {showCamera && (
        <Camera
          onCapture={handleCameraCapture}
          onClose={() => setShowCamera(false)}
        />
      )}



    </main>
      
    </div>

  );

  }

  export default App;


