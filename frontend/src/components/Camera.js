import React , {useRef , useState , useCallback} from "react";
import "./Camera.css";

const Camera = ( {onCapture , onClose} ) => {

    //useref ile video elementine erişim:

    const videoRef = useRef(null);
    const canvasRef = useRef(null);

    //Kamera durum takibi için stateler ayarlıyoruz:
    const [stream , setStream] = useState(null);
    const [isCameraOn , setIsCameraOn] = useState(false);
    const [error , setError] = useState(null);

    //Kamerayı açma fonksiyonu:
    const startCamera = useCallback(async () => {
        try{
            setError(null);

            //Kullanıcının kamerasına erişim isteği:
            const mediaStream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: "environment", //Arka Kamera
                    width: {ideal : 1920},
                    height: {ideal: 1080}

                }
            });
            setStream(mediaStream);
            setIsCameraOn(true);

            //Video elementine kamera bağlama:
            if(videoRef.current) {
                videoRef.current.srcObject = mediaStream;

            }

        } catch (err) {
            console.error("Camera error: " , err);
            setError("The camera could not be accessed , please to be sure you've granted permission.");
        }
    } , [])

    //Kamerayı kapatma:
    const stopCamera = useCallback( () => {
        if ( stream ) {
            //Tüm stream(akıs) durduruyoruz:
            stream.getTracks().forEach(track => track.stop());
            setStream(null);
            setIsCameraOn(false);
        }
    } , [stream]);

    //Foto çekme:
    const capturePhoto = useCallback( () => {
        if ( videoRef.current && canvasRef.current) {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            const context = canvas.getContext("2d");

            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;

            //Videodan canvasa resim çiziyoruz:
            context.drawImage(video , 0 , 0, canvas.width , canvas.height);

            //Canvasdan base64 formatında resmi alıyoruz:
            const photoData = canvas.toDataURL("image/jpeg" , 0.8);

            //Base64ü file objesine dönüştürüyoruz:
            const file = dataURLtoFile(photoData , `captured-documnet-${Date.now()}.jpg`);

            //Ana bileşene dosyayı gönderiyoruz:
            onCapture(file , photoData);

            stopCamera();

        }
    } , [onCapture , stopCamera])

    //base64 stringini file objesine çeviren fonksiyon:
    const dataURLtoFile = (dataurl , filename) => {
        const arr = dataurl.split(",");
        const mime = arr[0].match(/:(.*?);/)[1];
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);

        while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
        }
    
        return new File([u8arr], filename, { type: mime });
    };

    //Bileşen kapanırken kamerayı durdurma:
    React.useEffect( () => {
        return() => {
            stopCamera();

        };

    } , [stopCamera]);

    return (
        <div className="camera-overlay">
            
            <div className="camera-container">

                <div className="camera-header">

                    <h3>Camera Mode</h3>
                    <button className="close-btn" onClick={onClose}> ✕ </button>

                </div>

                {error && (
                    <div className="camera-error">
                        <p>{error}</p>
                    </div>
                )}

                <div className="video-container">

                    <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="camera-video"
                    />
                    {/* Gizli canvas foto çekmek için */}
                    <canvas ref={canvasRef} style={{display : "none"}} />

                </div>

                {/* Kamera Kontrolleri */}
                <div className="camera-controls">

                    {!isCameraOn ? (
                        <button className="camera-btn start-btn" onClick={startCamera}>
                            Open the Camera
                        </button>
                    ) : (
                        <button className="camera-btn capture-btn" onClick={capturePhoto}>

                            Take a photo

                        </button>
                    )}

                    {isCameraOn && (
                        <button className="camera-btn stop-btn" onClick={stopCamera}>Stop the Camera</button>
                    )}

                </div>

                {/* İpuçları */}

                <div className="camera-tips">

                    <p> Tips: Shoot the document in a well-lit area </p>
                    <p> Try to keep the document parallel to the camera </p>

                </div>

            </div>

        </div>
    );

};

export default Camera;