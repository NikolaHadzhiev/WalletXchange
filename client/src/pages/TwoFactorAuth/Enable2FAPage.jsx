import { useState } from "react";
import { Enable2FA } from "../../api/users";
import { QRCodeCanvas } from "qrcode.react";
import { useSelector } from "react-redux";

function EnableTwoFactorAuth () {
  const [otpauthUrl, setOtpAuthUrl] = useState("");
  const { user } = useSelector((state) => state.users);

  const handleEnable2FA = async () => {
    try {
      const response = await Enable2FA({ userId: user._id });

      if (response.success) {
        setOtpAuthUrl(response.data.otpauthUrl);
      } else {
        alert(response.message);
      }
    } catch (error) {
      console.error("Error enabling 2FA:", error);
    }
  };

  return (
    <div className="flex items-center justify-center h-80-p">
      <div className="card w-400 p-2">
        <h1 className="text-xl mb-2">Enable Two-Factor Authentication</h1>
        <button onClick={handleEnable2FA} className="btn btn-primary w-full">
          Generate 2FA Secret
        </button>

        {otpauthUrl && (
          <div className="mt-4">
            <h2 className="text-lg">Scan this QR Code:</h2>
            <QRCodeCanvas value={otpauthUrl} size={200} />
            <p className="text-sm mt-2">
              Use an authenticator app (e.g., Google Authenticator) to scan this QR code.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default EnableTwoFactorAuth;
