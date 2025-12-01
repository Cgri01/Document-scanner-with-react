const tesseract = require('tesseract.js');
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

//express uygulaması olusturma:
const app = express();
const PORT = 5000;

//Güvenlik ve dosya işlemleri için middleware'ler:
app.use(cors()); //React uygulmasının backende erişimine izin vermek
app.use(express.json());
app.use("/uploads" , express.static("uploads")) //yüklenen dosyaları paylaşmka

//Multer yapılandırması (dosya yükleme için):
const storage = multer.diskStorage({
    destination : (req , file , cb) => {
        //Yüklenen dosyaların kaydedileceği klasör:
        const uploadDir = "uploads";
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir);
        }
        cb(null , uploadDir);
    },
    filename: (req , file , cb) => {
        //Dosya ismini benzersiz yapıyoruz:
        const uniqueName = Date.now() + "-" + Math.round(Math.random() * 1E9) + "-" + file.originalname;
        cb(null , uniqueName);
    }
    
});

const upload = multer({
    storage: storage,
    fileFilter: (req , file , cb) => {
        //Sadece resim dosyalarına izin veriyoruz:
        if (file.mimetype.startsWith("image/")) {
            cb(null , true);
        } else {
            cb(new Error("Only image files are allowed!!!") , false);
        }
    },
    limits: {
        fileSize: 5 * 1024 * 1024 //5MB sınırı
    }
});

//Test endpointi çalısıyor mu kontrolü için:
app.get("/api/test" , (req , res) => {
    res.json({ message: "API is working!!!"})
});

//Görüntü işleme fonksiyonu:
const {createCanvas , loadImage} = require("canvas");
const { text } = require('stream/consumers');
const { error } = require('console');

//Kenar tespit fonksiyonu:
async function detectEdges(imagePath) {
    try {
        const image = sharp(imagePath);

        //Resmi gri tona çevirme ve kenar tespiti uygulama:
        const edgesBuffer = await image
        .grayscale() //Gri tona çevirme
        .normalise() //Kontrast artırma
        .convolve({
            width: 3,
            height: 3,
            kernel : [-1 , -1 , -1 ,-1 , 8 , -1 , -1 , -1 , -1]
        })
        .toBuffer();

        //Kenar tespit edilmiş sonucu kaydediyoruz:
        const edgesFilename = `edges-${Date.now()}.jpg`;
        const edgesPath = path.join("uploads" , edgesFilename);

        await sharp(edgesBuffer).jpeg({ quality : 80}).toFile(edgesPath);

        return {
            detected: true,
            edgesPath: edgesPath,
            edgesUrl: `/uploads/${edgesFilename}`
        };

    } catch (error) {
        console.error("Edge detection error:" , error);
        return {
            detected: false,
            edgesPath: null,
            edgesUrl: null
        }
    }
}

//OCR fonksiyonu:
async function extractTextFromImage(imagePath) {
    try {
        console.log("Starting OCR for image:" , imagePath);

        //Görüntü optimizasyonu:
        const processedImageBuffer = await sharp(imagePath)
            .grayscale()
            .normalise()
            .sharpen({sigma: 1})
            .toBuffer();

        const { data } = await tesseract.recognize(
            processedImageBuffer,
            "eng+tur", {
                logger: m => {
                    if (m.status === "recognizing text") {
                        console.log(`OCR Progress: %${Math.round(m.progress * 100)}`);
                    }
                }
            }
        );


        console.log("OCR completed. Trust score:" , data.confidence);
        console.log("Text Length: " , data.text.length);

        //Metni temizleme:
        const cleanedText = data.text
            .replace(/\n\s*\n/g, '\n') // Fazla boş satırları temizle
            .replace(/[^\S\n]+/g, ' ') // Fazla boşlukları temizle
            .trim();

        const languageDetected = detectLanguge(cleanedText);

        //Metin var mı kontrolü:
        const hasRealText = cleanedText.replace(/[\s\W_]+/g, '').length > 3; 

        return {
            success: true,
            text: cleanedText,
            confidence: Math.round(data.confidence),
            language: languageDetected,
            textLength : cleanedText.length,
            hasText: hasRealText
        };

    } catch (error) {
        console.error("OCR error:" , error);

        //Hata durumunda fallback:
        try{
            console.log("Trying fallback OCR for image:" , imagePath);
            const { data } = await tesseract.recognize(imagePath , "eng" );
            const cleanedText = data.text.trim();
            const hasRealText = cleanedText.replace(/[\s\W_]+/g, '').length > 3;

             return {
                success: true,
                text: cleanedText,
                confidence: Math.round(data.confidence),
                language: languageDetected,
                textLength : cleanedText.length,
                hasText: hasRealText
            };
        } catch (fallbackError) {
            console.error("Fallback OCR error:" , fallbackError);
            return {
                success: false,
                text: "",
                confidence: 0,
                error: "OCR failed " + fallbackError.message,
                hasText: false
            };
        }
        
        
    }


           
    
}

//Dil tespit fonksiyonu:
function detectLanguge(text) {
    const turkishChars = /[çğıöşüÇĞİÖŞÜ]/;
    //const englishChars = /[a-zA-Z]/;

    const hasTurkish = turkishChars.test(text);
    //const hasEnglish = englishChars.test(text);

    if (hasTurkish) {
        return "Turkish";
    }
    else {
        return "English";
    }
}

//Basit görüntü analizi:
async function analyzeImage(imagePath) {

    try {
        //Sharp kutuphanesi ile resmi yüklüyoruz:
        const image = await sharp(imagePath);
        const metadata = await image.metadata();
        
        //Resim istatistikleri:
        const stats = await image.stats();

        //Parlaklık analizi:
        const brightness = stats.channels[0].mean; //kırmızı kanal ortalaması

        //Kontrast analizi:
        const contrast = Math.sqrt(
            stats.channels[0].stdev * stats.channels[0].stdev +
            stats.channels[1].stdev * stats.channels[1].stdev +
            stats.channels[2].stdev * stats.channels[2].stdev
        ) / 3;

        //Kenar tespiti:
        const edgeDetection = await detectEdges(imagePath);

        //kalite puanı hesaplama(basit)
        let qualityScore = 50; //Temel puan

        
        // Çözünürlük puanı
        const megapixels = (metadata.width * metadata.height) / 1000000;
        if (megapixels > 5) qualityScore += 20;
        else if (megapixels > 2) qualityScore += 10;
        
        // Parlaklık puanı
        if (brightness > 100 && brightness < 200) qualityScore += 15;
        else if (brightness > 50 && brightness < 250) qualityScore += 5;
        
        // Kontrast puanı
        if (contrast > 40) qualityScore += 15; 

        const suggestions = [];
        if (brightness < 100) suggestions.push("The photo seems dark, take a photo from brighter place!");
        if (brightness > 200) suggestions.push("The photo is so bright!");

        if (contrast < 30) suggestions.push("Contrast is low , use more clear background!");
        if(megapixels < 2) suggestions.push("Resolution is low, hold the camera closer.");
        
        return{
            dimensions : {
                width : metadata.width,
                height : metadata.height,
                megapixels : parseFloat(megapixels.toFixed(2))

            },
            quality : {
                score: Math.min(100 , Math.round(qualityScore)),
                brightness: Math.round(brightness),
                contrast: Math.round(contrast)
            },
            suggestions: suggestions,
            detected: qualityScore > 60, //ilerde burada metin tespiti olacak
            edgeDetection: edgeDetection
        };

    } catch (error) {
        console.error("Image analysis error:" , error);
        return{
            dimensions: { width: 0 , height: 0 , megapixels: 0},
            quality: { score: 0, brightness: 0 , contrast: 0},
            suggestions: ["Image can not analysis"],
            detected: false,
            edgeDetection: { detected: false , edgesPath: null , edgesUrl: null}
        };
    }
        
    
}


//Resim yükleme endpointi:
app.post("/api/upload" , upload.single("document") , async(req , res) => {
    try{
        if (!req.file) {
            return res.status(400).json({ error: "File is not uploaded!!!"})
        }

        //Yüklenen dosya bilgileri:
        const uploadedFile = req.file;
        console.log("File received:" , uploadedFile.originalname);

      //   // Burada ileride görüntü işleme yapacağız
      //  // Şimdilik sadece dosya bilgilerini döndürüyoruz
    
      //Goruntu Analizi:
      console.log("Starting image analysis for:" , uploadedFile.path);
      const analysis = await analyzeImage(uploadedFile.path);

      //OCR işlemi:
      console.log("Starting OCR for:" , uploadedFile.path);
      const ocrResult = await extractTextFromImage(uploadedFile.path);
      console.log("OCR Completed");



        res.json({
            success: true,
            message: "The file uploaded successfully!!!",
            file: {
                filename: uploadedFile.filename,
                originalname: uploadedFile.originalname,
                path: uploadedFile.path,
                size: uploadedFile.size,
                url: `/uploads/${uploadedFile.filename}`
            },
            analysis: analysis, //Analiz sonuçlarını da gönderiyoruz
            ocr: ocrResult
        });
    }catch (error) {
        console.error("Error during file upload: " , error);
        res.status(500).json({ 
            error: "Internal server error during file upload!!!",
            details: error.message
         });
        }

    }
);

//Sunucuyu başlatma:
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
})
